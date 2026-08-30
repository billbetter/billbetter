"""Prove the AI key, provider and model BEFORE anything is deployed.

Same instrument as diagnose-twilio.py and diagnose-infobip.py, for the third
credential this product depends on. Those two established that a well-formed key
can still be rejected, and that finding out from a script beats finding out from
a contractor.

It separates the things that could actually be true:

  1. The deployed secret differs from .env (deploy-secrets.py never run).
  2. LLM_API_KEY does not match LLM_PROVIDER -- an sk-... OpenAI key sent to
     Anthropic, or an Anthropic key sent to OpenAI. Both answer 401, and that
     401 reads exactly like a bad key because it IS one, for that endpoint.
  3. The key is rejected outright, or the account has no credit.
  4. LLM_MODEL names something this account cannot use.
  5. The model can return the app's REAL schema, not just any JSON.

Check 5 is the one worth having. Every other check proves the account exists;
only this one proves the thing the product depends on -- structured output that
satisfies src/lib/ai/schemas.js. It sends ONE tiny request.

  This is the only diagnose script here that is not free. One small structured
  call is a fraction of a cent, not nothing. It is a deliberate trade: the
  alternative is discovering a schema incompatibility from a contractor whose
  invoice came back empty.

Usage: python scripts/diagnose-llm.py [--offline]   (--offline skips check 5)
"""
import hashlib
import json
import sys
import urllib.error
import urllib.request

from _env import require, ENV, project_ref

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

NAMES = ['LLM_PROVIDER', 'LLM_API_KEY', 'LLM_MODEL']

# Mirrors src/lib/ai/schemas.js LINE_ITEMS closely enough to prove the shape the
# app actually asks for -- an array of objects with a string and two numbers,
# and an optional field left out of `required`. That optional field is the whole
# reason OpenAI strict mode is off (see _shared/llm.ts), so it belongs here.
LINE_ITEMS_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "quantity": {"type": "number"},
                    "rate": {"type": "number"},
                },
                "required": ["description", "quantity", "rate"],
            },
        },
        "notes": {"type": "string"},
    },
    "required": ["items"],
}

PROMPT = ("Two hours of labour at 75 dollars an hour, and one box of tile at 40 "
          "dollars. Return them as line items. rate is the PER-UNIT price.")


def post(url, headers, payload):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode('utf-8'),
        headers={**headers, 'content-type': 'application/json',
                 'User-Agent': 'invoicium-diagnose/1.0'},
        method='POST')
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw
    except Exception as e:
        return 0, str(e)


def err_text(payload):
    if isinstance(payload, dict):
        e = payload.get('error')
        if isinstance(e, dict):
            return e.get('message') or json.dumps(e)[:180]
        return json.dumps(payload)[:180]
    return str(payload)[:180]


def main():
    provider = (ENV.get('LLM_PROVIDER') or 'anthropic').strip().lower()
    key = require('LLM_API_KEY')
    model = ENV.get('LLM_MODEL') or ''

    print(f'LLM_PROVIDER : {provider}')
    print(f'LLM_MODEL    : {model or "(default)"}')
    print(f'LLM_API_KEY  : {len(key)} chars, starts {key[:3]}...\n')

    if provider not in ('openai', 'anthropic'):
        print(f'  WRONG   _shared/llm.ts registers "anthropic" and "openai" only.')
        print(f'          {provider!r} would throw unknown_provider on every call.\n')
        sys.exit(1)

    # -- 0. Does the key shape match the provider? ------------------------
    #
    # Offline, free, and catches the mistake that wastes the most time, because
    # its symptom (401) is identical to a genuinely bad key.
    print('0. Does the key belong to the configured provider?\n')
    looks_openai = key.startswith('sk-')
    looks_anthropic = key.startswith('sk-ant-')
    if provider == 'openai' and looks_anthropic:
        print('  WRONG   this is an Anthropic key (sk-ant-...) but LLM_PROVIDER is openai.')
        print('          OpenAI will answer 401 and it will look like a bad key.\n')
    elif provider == 'anthropic' and looks_openai and not looks_anthropic:
        print('  WRONG   this looks like an OpenAI key (sk-...) but LLM_PROVIDER is anthropic.')
        print('          Anthropic will answer 401 and it will look like a bad key.\n')
    elif provider == 'openai' and not looks_openai:
        print(f'  UNUSUAL an OpenAI key normally starts "sk-"; this starts {key[:3]!r}.\n')
    else:
        print('  OK      the key shape matches the provider\n')

    # -- 1. Deployed vs .env ----------------------------------------------
    print('1. Is the DEPLOYED secret the same string as .env?\n')
    req = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{project_ref()}/secrets',
        headers={'Authorization': 'Bearer ' + require('SUPABASE_ACCESS_TOKEN'),
                 'User-Agent': 'invoicium-diagnose/1.0'})
    in_sync = None
    try:
        with urllib.request.urlopen(req) as r:
            deployed = {s['name']: s.get('value', '') for s in json.loads(r.read().decode())}
        in_sync = True
        for name in NAMES:
            local = ENV.get(name) or ''
            if not local:
                print(f'  ABSENT    {name} is not in .env')
                in_sync = False
                continue
            remote = deployed.get(name)
            if remote is None:
                print(f'  MISSING   {name} is not set on the project at all')
                in_sync = False
                continue
            same = hashlib.sha256(local.encode()).hexdigest() == remote
            in_sync &= same
            print(f'  {"MATCH  " if same else "DIFFERS"}   {name}')
        print(f'\n  -> {"deployed secrets match .env" if in_sync else "OUT OF SYNC -- run deploy-secrets.py"}\n')
    except Exception as e:
        print(f'  could not list secrets: {e}\n')

    # -- 2 + 3. Does the provider accept the key, and can it hit the schema?
    if '--offline' in sys.argv:
        print('2. Live check skipped (--offline).')
        return

    print('2. Does the provider accept the key, and satisfy the app\'s schema?\n')
    print('   (sending one small structured request -- this costs a fraction of a cent)\n')

    if provider == 'openai':
        status, body = post(
            'https://api.openai.com/v1/chat/completions',
            {'Authorization': f'Bearer {key}'},
            {'model': model or 'gpt-4o', 'max_tokens': 1024,
             'response_format': {'type': 'json_schema', 'json_schema': {
                 'name': 'respond', 'strict': False, 'schema': LINE_ITEMS_SCHEMA}},
             'messages': [{'role': 'user', 'content': PROMPT}]})
        raw = (((body or {}).get('choices') or [{}])[0].get('message') or {}).get('content')
    else:
        status, body = post(
            'https://api.anthropic.com/v1/messages',
            {'x-api-key': key, 'anthropic-version': '2023-06-01'},
            {'model': model or 'claude-sonnet-5', 'max_tokens': 1024,
             'tools': [{'name': 'respond', 'description': 'Return the structured result.',
                        'input_schema': LINE_ITEMS_SCHEMA}],
             'tool_choice': {'type': 'tool', 'name': 'respond'},
             'messages': [{'role': 'user', 'content': PROMPT}]})
        block = next((b for b in (body or {}).get('content', []) if b.get('type') == 'tool_use'), None)
        raw = json.dumps(block['input']) if block else None

    if status == 0:
        print(f'  could not reach the provider -- {body}')
        sys.exit(1)
    if status != 200:
        print(f'  HTTP {status} -- {err_text(body)}')
        print('\n  -> the key or the model was rejected.')
        if status == 401:
            print('     401 means the credential. Re-check section 0: a key for the')
            print('     OTHER provider produces exactly this.')
        if status == 404:
            print(f'     404 on a chat endpoint usually means the MODEL name:')
            print(f'     {model!r} may not exist or may not be enabled on this account.')
        if status == 429:
            print('     429 is rate limit or exhausted credit, not a bad key.')
        if in_sync:
            print('     The deployed secret matches .env, so production fails the same way.')
        sys.exit(1)

    print(f'  HTTP 200 -- key accepted')

    if not raw:
        print('  but the response carried no structured result.')
        sys.exit(1)
    try:
        parsed = json.loads(raw)
    except ValueError:
        print(f'  but the result was not valid JSON: {str(raw)[:120]}')
        sys.exit(1)

    items = parsed.get('items')
    ok = isinstance(items, list) and len(items) >= 1 and all(
        isinstance(i, dict) and isinstance(i.get('description'), str)
        and isinstance(i.get('quantity'), (int, float))
        and isinstance(i.get('rate'), (int, float))
        for i in items)
    print(f'  schema satisfied: {"YES" if ok else "NO"}')
    for i in (items or [])[:4]:
        if isinstance(i, dict):
            print(f'    - {i.get("description")!r}  qty={i.get("quantity")}  rate={i.get("rate")}')
    if not ok:
        print('\n  -> the account works but the model did not return the app\'s shape.')
        sys.exit(1)

    # The single most common real-world failure, per schemas.js: "2 hours at $75"
    # coming back as rate 150 instead of 75. Worth naming, not worth failing on.
    rates = [i.get('rate') for i in items if isinstance(i, dict)]
    if 150 in rates or 75 not in rates:
        print('\n  NOTE  check the rates above are PER-UNIT, not line totals.')
        print('        (2h @ $75 should be rate=75, not rate=150.) The consumer')
        print('        recomputes anyway, but a model that gets this wrong here')
        print('        will get it wrong in the product.')

    print('\n---')
    print('AI is configured and the provider satisfies the app schema.')
    print('Nothing else in the product is gated on this -- see the audit\'s AI')
    print('launch-gate section for the claims that depend on it being on.')


if __name__ == '__main__':
    main()
