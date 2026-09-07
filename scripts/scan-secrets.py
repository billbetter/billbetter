"""Find live credentials in the working tree and in git history.

Written because two were already there. `scripts/deploy-secrets.py` hardcoded
the live Stripe secret key and webhook secret across ten commits, and
`supabase_token.txt` committed a base64-wrapped Supabase personal access token.
Both were still valid when the audit found them, months after being replaced.

-- Why it also reads history ---------------------------------------------

`.gitignore` stops the next commit; it does nothing about the last one. Both
leaks here are invisible to a working-tree scan: the files are gone from HEAD
and the secrets are still one `git show` away.

-- Why it reports reachability -------------------------------------------

Severity depends on whether a commit is on a remote. A secret only on a local
branch is recoverable by anyone with the machine and is one push from being
public; a secret on a remote branch is public now and must be treated as burned
regardless of any later rewrite. Those need different responses on different
timescales, so the report separates them rather than printing one alarm.

Usage:
  python scripts/scan-secrets.py            # working tree only, fast
  python scripts/scan-secrets.py --history  # every reachable commit too
  python scripts/scan-secrets.py --history --limit 500

Exit code is 1 if anything was found, so it can gate a pre-push hook or CI.
"""
import argparse
import base64
import re
import subprocess
import sys

# Patterns for credentials that are secret by construction. Deliberately NOT
# matching pk_live_/pk_test_ or a Supabase anon JWT: those are published in the
# client bundle on purpose, and flagging them trains people to ignore this tool.
PATTERNS = [
    ("Stripe live secret key", re.compile(r"sk_live_[A-Za-z0-9]{20,}")),
    ("Stripe test secret key", re.compile(r"sk_test_[A-Za-z0-9]{20,}")),
    ("Stripe restricted key", re.compile(r"rk_live_[A-Za-z0-9]{20,}")),
    ("Stripe webhook secret", re.compile(r"whsec_[A-Za-z0-9]{24,}")),
    ("Supabase access token", re.compile(r"sbp_[0-9a-f]{40}")),
    ("OpenAI key", re.compile(r"sk-proj-[A-Za-z0-9_\-]{20,}|sk-[A-Za-z0-9]{40,}")),
    ("Anthropic key", re.compile(r"sk-ant-[A-Za-z0-9_\-]{20,}")),
    ("AWS access key id", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("Resend key", re.compile(r"re_[A-Za-z0-9_\-]{20,}")),
    ("Google OAuth client secret", re.compile(r"GOCSPX-[A-Za-z0-9_\-]{20,}")),
    ("Twilio auth token", re.compile(r"\bSK[0-9a-f]{32}\b")),
    ("Private key block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
]

# Strings that match a pattern but are deliberately fake.
ALLOW = re.compile(
    r"placeholder|replace_me|example|dummy|fake|xxxx|your[-_]?key|<[^>]+>",
    re.I,
)

# base64 hides a credential from every pattern above. Only decode short,
# padded, standalone blobs -- decoding every long string is slow and noisy.
B64 = re.compile(r"\b[A-Za-z0-9+/]{32,120}={0,2}\b")

SKIP_PATH = re.compile(
    r"(^|/)(node_modules|dist|\.git|__pycache__|package-lock\.json)(/|$)"
)


def hits(text, where):
    out = []
    for label, rx in PATTERNS:
        for m in rx.finditer(text):
            frag = m.group(0)
            line_start = text.rfind("\n", 0, m.start()) + 1
            line_end = text.find("\n", m.end())
            line = text[line_start : line_end if line_end != -1 else len(text)]
            if ALLOW.search(line):
                continue
            out.append((label, frag[:12] + "…", where, line.strip()[:100]))
    # Second pass: the same patterns, base64-wrapped.
    for m in B64.finditer(text):
        blob = m.group(0)
        try:
            dec = base64.b64decode(blob + "=" * (-len(blob) % 4)).decode("utf-8", "strict")
        except Exception:
            continue
        for label, rx in PATTERNS:
            if rx.fullmatch(dec.strip()):
                out.append((label + " (base64)", dec[:12] + "…", where, blob[:40] + "…"))
    return out


def tracked_files():
    out = subprocess.run(
        ["git", "ls-files"], capture_output=True, text=True, check=True
    ).stdout.splitlines()
    return [f for f in out if not SKIP_PATH.search(f)]


def read_blob(rev, path):
    r = subprocess.run(
        ["git", "show", f"{rev}:{path}"], capture_output=True, text=True, errors="replace"
    )
    return r.stdout if r.returncode == 0 else ""


def remote_refs_containing(rev):
    r = subprocess.run(
        ["git", "for-each-ref", "--format=%(refname)", "refs/remotes"],
        capture_output=True, text=True,
    )
    out = []
    for ref in r.stdout.split():
        anc = subprocess.run(
            ["git", "merge-base", "--is-ancestor", rev, ref], capture_output=True
        )
        if anc.returncode == 0:
            out.append(ref)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--history", action="store_true", help="also scan every reachable commit")
    ap.add_argument("--limit", type=int, default=400, help="max commits to scan")
    args = ap.parse_args()

    found = []

    print("Scanning working tree…")
    for path in tracked_files():
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                found += hits(f.read(), path)
        except (OSError, IsADirectoryError):
            continue
    tree_hits = len(found)
    print(f"  {tree_hits} finding(s) in tracked files")

    hist = []
    if args.history:
        revs = subprocess.run(
            ["git", "rev-list", "--all", f"--max-count={args.limit}"],
            capture_output=True, text=True,
        ).stdout.split()
        print(f"Scanning {len(revs)} commit(s) of history…")
        # Only look at paths that ever plausibly held a secret; scanning every
        # blob of every commit is minutes, and this is seconds.
        suspects = set()
        for rev in revs:
            names = subprocess.run(
                ["git", "show", "--pretty=", "--name-only", rev],
                capture_output=True, text=True,
            ).stdout.splitlines()
            for n in names:
                if n and not SKIP_PATH.search(n) and re.search(
                    r"\.(py|js|cjs|mjs|ts|tsx|jsx|json|ya?ml|sh|txt|env.*)$|token|secret|credential",
                    n, re.I,
                ):
                    suspects.add((rev, n))
        seen_secret = {}
        for rev, path in suspects:
            for h in hits(read_blob(rev, path), f"{rev[:7]}:{path}"):
                key = (h[0], h[1])
                seen_secret.setdefault(key, []).append(rev)
                hist.append(h)
        print(f"  {len(seen_secret)} distinct secret(s) across history")

        for (label, frag), revs_with in seen_secret.items():
            remotes = remote_refs_containing(revs_with[0])
            where = (
                "PUBLIC — on " + ", ".join(remotes) if remotes else "local-only (not pushed)"
            )
            print(f"\n  {label}: {frag}")
            print(f"    in {len(revs_with)} commit(s), earliest {revs_with[-1][:7]}")
            print(f"    reachability: {where}")

    if tree_hits:
        print("\nWorking-tree findings:")
        for label, frag, where, line in found[:40]:
            print(f"  {where}: {label} {frag}\n      {line}")

    total = tree_hits + len(hist)
    print(f"\n{'FAIL' if total else 'PASS'}: {total} finding(s)")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
