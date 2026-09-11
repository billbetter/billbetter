"""Snapshot every page's rendered DOM, to prove a refactor changed no output.

See snapshot-pages.cjs for what is captured and how it is kept deterministic.

    python scripts/snapshot-pages.py <outDir>            # capture
    git diff --no-index --stat <baselineDir> <outDir>   # compare

    --only a,b      only routes / scenarios whose name contains a or b
    --dist <dir>    serve that build instead of dist/ (a baseline worktree's)

Requires a build (`npx vite build`); serves dist/ with `vite preview`. Writes no
application data (see _page-harness.cjs); --public-links adds the client
invoice and quote pages, which each log one rate-limit row (see
audit-mobile.py).
"""
import sys

from _page_harness import run_browser_pass

PORT = 4183


def option(name):
    argv = sys.argv[1:]
    return argv[argv.index(name) + 1] if name in argv else None


if __name__ == '__main__':
    argv = sys.argv[1:]
    values = {option('--only'), option('--dist')}
    args = [a for a in argv if not a.startswith('--') and a not in values]
    if not args:
        raise SystemExit(__doc__)
    only = option('--only')
    sys.exit(run_browser_pass('snapshot-pages.cjs', args[0], PORT,
                              public_links='--public-links' in argv,
                              extra_args=[only] if only else [],
                              dist=option('--dist')))
