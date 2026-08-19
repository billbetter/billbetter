"""Push Edge Function secrets from .env to the linked Supabase project.

Edge Function secrets live on the Supabase project, not in .env — editing .env
alone changes nothing in production. This script is what closes that gap.
"""
import json
import urllib.request
import urllib.error

from _env import require, project_ref

TOKEN = require('SUPABASE_ACCESS_TOKEN')
REF = project_ref()

# Names pushed to Supabase, each read from .env. SUPABASE_* names are reserved
# and injected by the platform, so they are deliberately absent.
SECRET_NAMES = [
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'APP_BASE_URL',
]

secrets = [(name, require(name)) for name in SECRET_NAMES]

print(f'Pushing {len(secrets)} secrets to project {REF}...')
for name, value in secrets:
    print(f'  {name} = {value[:6]}...' if len(value) > 6 else f'  {name} = ...')

req = urllib.request.Request(
    f'https://api.supabase.com/v1/projects/{REF}/secrets',
    data=json.dumps([{'name': n, 'value': v} for n, v in secrets]).encode(),
    headers={
        'Authorization': f'Bearer {TOKEN}',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
    },
    method='POST',
)

try:
    urllib.request.urlopen(req)
    print('Secrets deployed successfully')
except urllib.error.HTTPError as e:
    print('ERROR:', e.code, e.read().decode())
