"""Does writing booking_slug break the entire BusinessSettings save?

src/pages/Settings.jsx builds its payload as `{ ...formData }` -- a full spread.
src/components/settings/CalendarSettings.jsx renders an input bound to
formData.booking_slug. BusinessSettings has no booking_slug column. If PostgREST
rejects the whole PATCH rather than ignoring the unknown key, then typing in
that one field breaks saving EVERY setting on the page.

Read-only: probes with a SELECT of the column, which fails through the same
schema cache a PATCH would, and does not modify anything.
"""
import json
import urllib.request
import urllib.error

from _env import require

URL = require('VITE_SUPABASE_URL').rstrip('/')
SERVICE = require('SUPABASE_SERVICE_ROLE_KEY')


def rest(path, method='GET', body=None):
    req = urllib.request.Request(
        f'{URL}/rest/v1/{path}',
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            'apikey': SERVICE,
            'Authorization': f'Bearer {SERVICE}',
            'Content-Type': 'application/json',
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode()[:400]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]


print('SELECT booking_slug from BusinessSettings:')
status, body = rest('BusinessSettings?select=booking_slug&limit=1')
print(f'  {status}  {body}')

print('\nSELECT a column that DOES exist, as a control:')
status, body = rest('BusinessSettings?select=business_name&limit=1')
print(f'  {status}  {body}')

print('\nFILTER on booking_slug, which is exactly what PublicBooking does:')
status, body = rest('BusinessSettings?booking_slug=eq.demo&select=id')
print(f'  {status}  {body}')
