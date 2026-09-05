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
#
# THIS LIST IS ALL-OR-NOTHING. require() calls sys.exit() on the first name it
# cannot find, so a name here that is missing from .env fails the ENTIRE push --
# Resend and Stripe included, not just the missing one. Add the value to .env
# before adding the name here.
#
# (The reverse is not true: removing a name never breaks the push, it just stops
# that secret being updated. Which is the real reason the TWILIO_* names below
# stay -- see them.)
SECRET_NAMES = [
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    # Which SMS provider _shared/sms.ts uses: 'infobip' (default) or 'twilio'.
    # Pushed rather than left to the code default so that rolling back is a
    # one-line .env change plus this script, instead of an undocumented click in
    # the Supabase dashboard.
    'SMS_PROVIDER',
    'INFOBIP_API_KEY',
    # Account-specific host (https://<account>.api.infobip.com). Infobip does not
    # serve every account from one hostname, and the shared api.infobip.com
    # returns auth failures that read exactly like a bad key.
    'INFOBIP_BASE_URL',
    'INFOBIP_SENDER',
    # Kept while SMS_PROVIDER can still be 'twilio'. These deployed values are
    # what that branch reads, so dropping them from this list would leave the
    # rollback path looking available and not working.
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    # AI. _shared/llm.ts reads all three; without LLM_API_KEY every AI feature
    # answers not_configured rather than guessing, which is the whole design.
    # LLM_API_KEY is PROVIDER-SPECIFIC -- an OpenAI key sent to Anthropic (or
    # the reverse) is a 401 that reads like a bad key.
    'LLM_PROVIDER',
    'LLM_API_KEY',
    'LLM_MODEL',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_CONNECT_WEBHOOK_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'APP_BASE_URL',
    # Shared secret pg_cron presents to the scheduled sweeps, starting with
    # sweep-demand-letters. That function refuses to run at all when this is
    # unset, so it fails closed rather than opening an unauthenticated endpoint.
    #
    # Commented out because this list is all-or-nothing: require() exits on the
    # first name it cannot find, so uncommenting before CRON_SECRET exists in
    # .env would fail the ENTIRE push, Stripe and Resend included. Generate a
    # value, put it in .env, uncomment, push -- then store the SAME value in
    # Vault as 'cron_secret' so the cron job and the function agree. See
    # supabase/migrations/20260904120100_demand_letter_sweep_cron.sql.
    # 'CRON_SECRET',
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
