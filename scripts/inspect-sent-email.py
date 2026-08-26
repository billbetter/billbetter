"""Read back a message that Resend already accepted, by id.

Split out from test-send-invoice-email.py so the body can be inspected (and
re-inspected) without sending another email. Sending is the side effect worth
doing once; reading is not.

Usage: python scripts/inspect-sent-email.py <resend_email_id>
"""
import json
import re
import sys
import urllib.error
import urllib.request

from _env import require

RESEND_KEY = require('RESEND_API_KEY')

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def resend_get(email_id):
    req = urllib.request.Request(
        f'https://api.resend.com/emails/{email_id}',
        # Cloudflare fronts the Resend API and 403s urllib's default
        # User-Agent with error 1010 -- the same block the Supabase Management
        # API applies.
        headers={
            'Authorization': f'Bearer {RESEND_KEY}',
            'User-Agent': 'invoicium-verify/1.0',
            'Accept': 'application/json',
        },
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {'error': f'{e.code} {e.read().decode()[:400]}'}


def main():
    if len(sys.argv) < 2:
        sys.exit('Usage: python scripts/inspect-sent-email.py <resend_email_id>')
    sent = resend_get(sys.argv[1])
    if 'error' in sent:
        sys.exit(f'could not read it back: {sent["error"]}')

    html = sent.get('html') or ''
    text = re.sub(r'<[^>]+>', ' ', html)
    text = re.sub(r'\s+', ' ', text).strip()

    print('=' * 72)
    print(f'From    : {sent.get("from")}')
    print(f'To      : {sent.get("to")}')
    print(f'Subject : {sent.get("subject")}')
    print(f'Status  : {sent.get("last_event")}')
    print(f'HTML    : {len(html)} chars')
    print('=' * 72)
    print('\n--- VISIBLE TEXT ---\n')
    print(text[:3000])
    print('\n--- LINKS ---\n')
    for href, label in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
        label = re.sub(r'<[^>]+>', '', label)
        label = re.sub(r'\s+', ' ', label).strip()
        print(f'  [{label or "(no text)"}]\n      -> {href}')

    with open('scripts/.last-email.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print('\n(full HTML written to scripts/.last-email.html)')


if __name__ == '__main__':
    main()
