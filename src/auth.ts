// Простая защита паролем. Пароль лежит в секрете Worker'а (APP_PASSWORD) и в браузер
// никогда не попадает — в куке хранится только подпись, по ней Worker узнаёт «свой» вход.

const COOKIE = 'pgs_session';
const DAYS = 30;

const enc = new TextEncoder();

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// сравнение без «ранних выходов»: время работы не зависит от того, где строки разошлись
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isLoggedIn(request: Request, secret: string): Promise<boolean> {
  const raw = (request.headers.get('Cookie') || '')
    .split(';').map(c => c.trim()).find(c => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;               // кука просрочена
  return safeEqual(sig, await sign(secret, 'pgs|' + exp));
}

export async function sessionCookie(secret: string): Promise<string> {
  const exp = Date.now() + DAYS * 86400_000;
  const sig = await sign(secret, 'pgs|' + exp);
  return `${COOKIE}=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`;
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function checkPassword(given: string, expected: string): boolean {
  return Boolean(expected) && safeEqual(given, expected);
}

export function loginPage(error?: string): Response {
  const html = `<!DOCTYPE html><html lang="ru"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Party Games Studio</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎈</text></svg>">
<style>
:root{color-scheme:light dark}
body{min-height:100dvh;margin:0;display:grid;place-items:center;
  font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:#faf7f4;color:#2b2320}
@media (prefers-color-scheme:dark){body{background:#1a1614;color:#f0e9e4}}
form{width:min(340px,90vw);text-align:center}
h1{font-size:22px;margin:0 0 4px}
p{margin:0 0 24px;opacity:.65;font-size:14px}
input{width:100%;box-sizing:border-box;padding:11px 13px;font-size:15px;border-radius:9px;
  border:1px solid rgba(128,110,100,.4);background:transparent;color:inherit}
input:focus{outline:2px solid #d4736a;outline-offset:1px;border-color:transparent}
button{width:100%;margin-top:10px;padding:11px;font-size:15px;font-weight:600;border:0;
  border-radius:9px;background:#d4736a;color:#fff;cursor:pointer}
button:hover{background:#c2645c}
.err{color:#c2453c;font-size:14px;margin:14px 0 0}
</style></head><body>
<form method="POST" action="/login">
  <h1>🎈 Party Games Studio</h1>
  <p>Введите пароль</p>
  <input type="password" name="password" autofocus autocomplete="current-password" required>
  <button type="submit">Войти</button>
  ${error ? `<p class="err">${error}</p>` : ''}
</form></body></html>`;
  return new Response(html, {
    status: error ? 401 : 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
