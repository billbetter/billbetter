/**
 * Prove that _shared/sms.ts fails when Infobip rejects a message.
 *
 * -- Why this test exists ---------------------------------------------------
 *
 * Twilio signals a rejected message with a non-2xx, so branching on `res.ok`
 * was correct for Twilio. Infobip returns **HTTP 200** and puts the rejection
 * inside the body: messages[0].status.groupName is REJECTED or UNDELIVERABLE
 * while res.ok is true.
 *
 * Porting the old branch unchanged would therefore report success for every
 * rejected message -- a contractor told their quote was texted when it never
 * left. That is the exact failure this whole file guards, and it is invisible
 * to a boot test, to `npm run check`, and to any test that only asserts the
 * happy path.
 *
 * No credentials and no network: Deno.env and fetch are both stubbed, so this
 * runs anywhere and tests the LOGIC rather than the account.
 *
 * Usage: node scripts/test-sms-provider.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const esbuild = require('esbuild');

const SRC = path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'sms.ts');

let passed = 0;
let failed = 0;

function check(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
  }
}

/** An Infobip submit response with one message in the given status group. */
function infobipBody(groupName, description, messageId) {
  return {
    messages: [
      {
        messageId: messageId || 'MSG-1',
        status: { groupName, name: `${groupName}_X`, description },
        destination: '+15550001111',
      },
    ],
  };
}

async function main() {
  // Transpile the seam exactly as written, so this tests the shipped file.
  const ts = fs.readFileSync(SRC, 'utf8');
  const { code } = await esbuild.transform(ts, { loader: 'ts', format: 'esm', target: 'es2022' });
  const tmp = path.join(os.tmpdir(), `sms-under-test-${process.pid}.mjs`);
  fs.writeFileSync(tmp, code);

  const env = {
    SMS_PROVIDER: 'infobip',
    INFOBIP_API_KEY: 'placeholder-not-a-real-key',
    INFOBIP_BASE_URL: 'https://example.api.infobip.com',
    INFOBIP_SENDER: 'Invoicium',
  };
  globalThis.Deno = { env: { get: (k) => env[k] } };

  let lastRequest = null;
  function stubFetch(status, body) {
    globalThis.fetch = async (url, init) => {
      lastRequest = { url, init };
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      };
    };
  }

  const { sendSMS, maskPhone } = await import('file://' + tmp.replace(/\\/g, '/'));

  const send = () => sendSMS({ to: '+15550001111', body: 'Test body' });

  async function expectThrow(label, status, body, mustInclude) {
    stubFetch(status, body);
    try {
      const r = await send();
      check(label, false, `did NOT throw, returned ${JSON.stringify(r)}`);
    } catch (e) {
      const msg = String(e.message || e);
      check(label, !mustInclude || msg.includes(mustInclude), `message was ${msg!==undefined?JSON.stringify(msg):''}`);
    }
  }

  async function expectOk(label, body, expectedId) {
    stubFetch(200, body);
    try {
      const r = await send();
      check(label, r.id === expectedId && r.provider === 'infobip',
            `got ${JSON.stringify(r)}`);
    } catch (e) {
      check(label, false, `threw: ${e.message}`);
    }
  }

  console.log('\nTHE BUG THIS GUARDS: rejection arrives as HTTP 200\n');
  await expectThrow('REJECTED inside a 200 throws', 200,
    infobipBody('REJECTED', 'Not enough credits'), 'Not enough credits');
  await expectThrow('UNDELIVERABLE inside a 200 throws', 200,
    infobipBody('UNDELIVERABLE', 'Invalid destination address'), 'Invalid destination');
  await expectThrow('EXPIRED inside a 200 throws', 200,
    infobipBody('EXPIRED', 'Message expired'), 'EXPIRED');

  console.log('\nunrecognised groups fail closed (allowlist, not denylist)\n');
  await expectThrow('an unknown group throws rather than passing', 200,
    infobipBody('SOMETHING_NEW', 'invented by a future API version'), 'SOMETHING_NEW');
  await expectThrow('a missing status object throws', 200, { messages: [{ messageId: 'X' }] });

  console.log('\naccepted submits succeed, and return a normalised id\n');
  await expectOk('PENDING is accepted', infobipBody('PENDING', 'Message sent to next instance', 'MSG-P'), 'MSG-P');
  // ACCEPTED (groupId 0) is what a good submit actually returns; DELIVERED only
  // appears later on a delivery report. Allowlisting PENDING/DELIVERED alone
  // would have thrown here, on a perfectly good send.
  await expectOk('ACCEPTED is accepted', infobipBody('ACCEPTED', 'Message accepted', 'MSG-A'), 'MSG-A');
  await expectOk('DELIVERED is accepted', infobipBody('DELIVERED', 'Message delivered', 'MSG-D'), 'MSG-D');

  console.log('\nthe envelope itself has to be there\n');
  await expectThrow('200 with no messages array throws', 200, { bulkId: 'B1' }, 'no message result');
  await expectThrow('200 with an empty messages array throws', 200, { messages: [] }, 'no message result');

  console.log('\nHTTP-level failures still surface their reason\n');
  await expectThrow('401 throws with the service exception text', 401,
    { requestError: { serviceException: { text: 'Invalid login details' } } },
    'Invalid login details');
  await expectThrow('500 throws', 500, { requestError: {} }, 'Infobip error 500');

  console.log('\nthe request Infobip receives is shaped correctly\n');
  stubFetch(200, infobipBody('PENDING', 'ok'));
  await send();
  const { url, init } = lastRequest;
  check('posts to /sms/2/text/advanced',
        url === 'https://example.api.infobip.com/sms/2/text/advanced', url);
  check('authorises with the literal word App, not Bearer',
        init.headers.Authorization === 'App placeholder-not-a-real-key',
        init.headers.Authorization);
  const sent = JSON.parse(init.body);
  check('body carries messages[].destinations[].to',
        sent.messages[0].destinations[0].to === '+15550001111', init.body);
  check('body carries from and text',
        sent.messages[0].from === 'Invoicium' && sent.messages[0].text === 'Test body', init.body);

  console.log('\na trailing slash / missing scheme on the base URL is tolerated\n');
  env.INFOBIP_BASE_URL = 'example.api.infobip.com/';
  stubFetch(200, infobipBody('PENDING', 'ok'));
  await send();
  check('normalised to one clean https URL',
        lastRequest.url === 'https://example.api.infobip.com/sms/2/text/advanced',
        lastRequest.url);
  env.INFOBIP_BASE_URL = 'https://example.api.infobip.com';

  console.log('\nmissing configuration fails loudly, naming the variable\n');
  const savedKey = env.INFOBIP_API_KEY;
  delete env.INFOBIP_API_KEY;
  await expectThrow('an absent API key names INFOBIP_API_KEY', 200,
    infobipBody('PENDING', 'ok'), 'INFOBIP_API_KEY');
  env.INFOBIP_API_KEY = savedKey;

  console.log('\nthe provider switch still reaches Twilio for a rollback\n');
  env.SMS_PROVIDER = 'twilio';
  env.TWILIO_ACCOUNT_SID = 'AC-placeholder';
  env.TWILIO_AUTH_TOKEN = 'placeholder';
  env.TWILIO_PHONE_NUMBER = '+15550009999';
  stubFetch(200, { sid: 'SM-1', status: 'queued' });
  const tw = await send();
  check('SMS_PROVIDER=twilio routes to Twilio', tw.provider === 'twilio', JSON.stringify(tw));
  check('and normalises sid into the same id field', tw.id === 'SM-1', JSON.stringify(tw));
  check('hitting the Twilio endpoint, not Infobip',
        String(lastRequest.url).includes('api.twilio.com'), String(lastRequest.url));

  env.SMS_PROVIDER = 'nonsense';
  stubFetch(200, infobipBody('PENDING', 'ok'));
  const fb = await send();
  check('an unrecognised SMS_PROVIDER falls back to infobip rather than failing',
        fb.provider === 'infobip', JSON.stringify(fb));
  env.SMS_PROVIDER = 'infobip';

  console.log('\nphone numbers are masked to four digits\n');
  check('maskPhone keeps only the last four', maskPhone('+1 555 000 1111') === '***1111',
        maskPhone('+1 555 000 1111'));
  check('a short value does not leak what it has', maskPhone('12') === '***', maskPhone('12'));
  check('null is handled', maskPhone(null) === '***', maskPhone(null));

  fs.unlinkSync(tmp);

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES ABOVE'} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
