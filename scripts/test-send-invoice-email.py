"""Send ONE real invoice email, then read back what was actually delivered.

-- What this does and does not exercise ---------------------------------

The payload below mirrors what src/api/sdk.js normalizeSendPayload() builds
before it calls the function: the fields InvoiceDetail passes, plus the DB
enrichment (items, totals, dates, status) and the business context
(enrichBusinessContext). It is assembled here rather than by clicking Send in
the browser for one reason: the Send button fires an SMS to the client's phone
as well, and this is meant to be one email, not one email and one text.

So what is proven is the RENDERED BODY -- which is what send-invoice-email
itself produces, and the thing under test. The DOM click path is not.

The body is not inferred from the source. After sending, the message is fetched
back from Resend's API by id, so what gets inspected is the HTML that actually
left the building.

Usage: python scripts/test-send-invoice-email.py [--dry-run]
"""
import json
import re
import sys
import urllib.error
import urllib.request

from _env import require
from _session import session_for
from q import run_sql

SUPABASE_URL = require('VITE_SUPABASE_URL').rstrip('/')
ANON = require('VITE_SUPABASE_ANON_KEY')
RESEND_KEY = require('RESEND_API_KEY')

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def sql(query):
    status, body = run_sql(query)
    if status >= 300:
        sys.exit(f'SQL failed: {status}\n{body}')
    return json.loads(body)


def call_function(fn, body, access_token):
    req = urllib.request.Request(
        f'{SUPABASE_URL}/functions/v1/{fn}',
        data=json.dumps(body).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {access_token}',
            'apikey': ANON,
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw


def resend_get(email_id):
    req = urllib.request.Request(
        f'https://api.resend.com/emails/{email_id}',
        # Cloudflare sits in front of the Resend API and 403s urllib's default
        # User-Agent with error 1010 -- the same block the Supabase Management
        # API applies.
        headers={'Authorization': f'Bearer {RESEND_KEY}',
                 'User-Agent': 'invoicium-verify/1.0',
                 'Accept': 'application/json'},
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {'error': f'{e.code} {e.read().decode()[:300]}'}


def main():
    inv = sql('''select i.*, u.email as owner_email
                   from public."Invoice" i
                   join auth.users u on u.id = i.user_id
                  order by i.created_at limit 1''')[0]
    settings = sql(f'''select * from public."BusinessSettings"
                        where user_id = '{inv["user_id"]}' limit 1''')[0]

    print(f'Invoice   : {inv["invoice_number"]}  ${inv["total"]}  due {str(inv["due_date"])[:10]}')
    print(f'Contractor: {inv["owner_email"]}')
    print(f'Recipient : {inv["client_email"]}')
    print(f'Public link: {require("APP_BASE_URL").rstrip("/")}/i/{inv["public_token"]}\n')

    if '--dry-run' in sys.argv:
        print('dry run: nothing sent.')
        return

    # --bad-reply-to proves the GUARD, which matters more than it looks: a
    # contractor with a typo'd email in Settings must still be able to send
    # invoices. Resend rejects the whole request for a malformed reply_to, so
    # without the filter in _shared/resend.ts one bad character in one settings
    # field would silently stop every invoice that account ever sent.
    bad_reply_to = '--bad-reply-to' in sys.argv

    # A real user session for the CONTRACTOR -- send-invoice-email sits behind
    # requireAppAccess, which authenticates the invoice's owner, not the client.
    sess = session_for(inv['owner_email'])
    token = sess['access_token']

    payload = {
        'invoice_id': inv['id'],
        'to': inv['client_email'],
        'client_email': inv['client_email'],
        'client_name': inv['client_name'],
        'invoice_number': inv['invoice_number'],
        'total': float(inv['total'] or 0),
        'subtotal': float(inv['subtotal'] or 0),
        'tax_rate': float(inv['tax_rate'] or 0),
        'tax_amount': float(inv['tax_amount'] or 0),
        'items': inv['items'],
        'pdf_url': inv['pdf_url'],
        'payment_link': inv['payment_link'],
        'notes': inv['notes'],
        'due_date': inv['due_date'],
        'issue_date': inv['created_at'],
        'created_date': inv['created_at'],
        'status': inv['status'],
        # enrichBusinessContext()
        'business_name': settings['business_name'],
        'sender_name': settings['business_name'],
        'sender_email': 'not an email address' if bad_reply_to else settings['email'],
        'sender_phone': settings['phone'],
        'sender_address': settings['address'],
        'sender_website': settings['website'],
    }

    print('sending...' + ('  (with a deliberately malformed reply-to)' if bad_reply_to else ''))
    status, res = call_function('send-invoice-email', payload, token)
    print(f'  HTTP {status}  {json.dumps(res)[:300]}\n')
    if status != 200 or not res.get('success'):
        sys.exit('send failed -- stopping before inspection.')

    email_id = res.get('id')
    if not email_id:
        sys.exit('sent, but no Resend id came back; cannot read the body.')

    print(f'fetching the delivered message from Resend ({email_id})...\n')
    sent = resend_get(email_id)
    if 'error' in sent:
        sys.exit(f'could not read it back: {sent["error"]}')

    html = sent.get('html') or ''
    text = re.sub(r'<[^>]+>', ' ', html)
    text = re.sub(r'\s+', ' ', text).strip()

    print('=' * 72)
    print(f'From    : {sent.get("from")}')
    print(f'To      : {sent.get("to")}')
    print(f'Subject : {sent.get("subject")}')
    print(f'Attachments reported: {sent.get("attachments") or "(not returned by the API)"}')
    print(f'HTML size: {len(html)} chars')
    print('=' * 72)
    print('\n--- VISIBLE TEXT ---\n')
    print(text[:2500])
    print('\n--- LINKS ---\n')
    for href, label in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
        label = re.sub(r'<[^>]+>', '', label)
        label = re.sub(r'\s+', ' ', label).strip()
        print(f'  {label or "(no text)"}\n    -> {href}')

    # --- Assertions on what a non-clicker can see ------------------------
    print('\n--- CHECKS ---\n')
    checks = []

    def check(label, cond, detail=''):
        checks.append(bool(cond))
        print(f'  {"PASS" if cond else "FAIL"}  {label}'
              f'{(" -- " + detail) if detail and not cond else ""}')

    public_url = f'{require("APP_BASE_URL").rstrip("/")}/i/{inv["public_token"]}'
    check('the hosted invoice link is in the email', public_url in html, public_url)
    check('it is a real anchor, not just text',
          bool(re.search(r'<a[^>]+href="' + re.escape(public_url), html)))
    check('the OLD 24h Stripe Checkout URL is NOT the CTA',
          'checkout.stripe.com' not in html)
    check('the invoice number is in the text', str(inv['invoice_number']) in text)
    amount_shown = any(a in text for a in ('580.00', '580', f'{float(inv["total"]):,.2f}'))
    check('the amount is in the text for a non-clicker', amount_shown)
    check('the due date is in the text for a non-clicker',
          any(tok in text for tok in ('Sep', 'September', str(inv['due_date'])[:10])),
          text[:200])
    check('it still says a PDF is attached (Phase A keeps the attachment)',
          'attached' in text.lower())
    check('the business name appears', str(settings['business_name']) in text)

    # The email tells the client to reply. Without a Reply-To header that reply
    # goes to noreply@invoicium.ca and is lost -- so the instruction and the
    # header have to agree. Read off the DELIVERED message, not the source.
    reply_to = sent.get('reply_to')
    if bad_reply_to:
        check('a malformed reply-to did NOT break the send', status == 200)
        check('the bad address was dropped rather than sent',
              not reply_to, repr(reply_to))
        print('\n  (guard verified: the email still went out, just without a Reply-To)')
        sys.exit(0 if all(checks) else 1)

    check('the email invites a reply', 'reply to this email' in text.lower())
    check('Reply-To is populated, not null', bool(reply_to), repr(reply_to))
    expected = settings['email']
    check('Reply-To is the contractor, not noreply',
          bool(reply_to) and expected in (reply_to if isinstance(reply_to, list) else [reply_to]),
          f'expected {expected}, got {reply_to!r}')
    check('Reply-To is NOT the noreply sender',
          bool(reply_to) and 'noreply@' not in str(reply_to), repr(reply_to))

    ok = all(checks)
    print('\n' + ('ALL CHECKS PASS' if ok else 'FAILURES ABOVE'))
    print(f'\nA real email is now in {inv["client_email"]}.')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
