// Worker для Party Games Studio.
//   1. закрывает приложение паролем;
//   2. отдаёт собранную страницу (dist/app.html);
//   3. проксирует запросы к внешним API и к WordPress, подставляя ключи из секретов —
//      в браузер они не попадают.
import appHtml from '../dist/app.html';
import { isLoggedIn, sessionCookie, clearCookie, checkPassword, loginPage } from './auth';

export interface Env {
  APP_PASSWORD: string;       // пароль на вход в приложение
  ANTHROPIC_API_KEY?: string; // ключ Claude
  RUNWARE_API_KEY?: string;   // ключ Runware
  PEXELS_API_KEY?: string;    // ключ Pexels
  WP_USER?: string;           // логин WordPress
  WP_PASS?: string;           // пароль приложения WordPress
  ALLOWED_WP_HOSTS: string;   // куда разрешено проксировать (через запятую)
}

// какие файлы на сайте разрешено дёргать — только твои два прокси, ничего больше
const WP_FILES = new Set(['wp-proxy.php', 'wp-media-proxy.php']);

const notFound = () => new Response('Not found', { status: 404 });
const redirect = (to: string, cookie?: string) =>
  new Response(null, { status: 302, headers: { Location: to, ...(cookie ? { 'Set-Cookie': cookie } : {}) } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!env.APP_PASSWORD) {
      return new Response('Пароль не задан. Выполни: wrangler secret put APP_PASSWORD', { status: 500 });
    }

    // ── вход ──
    if (url.pathname === '/login') {
      if (request.method === 'GET') {
        return (await isLoggedIn(request, env.APP_PASSWORD)) ? redirect('/') : loginPage();
      }
      if (request.method === 'POST') {
        const form = await request.formData();
        const given = String(form.get('password') || '');
        if (!checkPassword(given, env.APP_PASSWORD)) return loginPage('Неверный пароль');
        return redirect('/', await sessionCookie(env.APP_PASSWORD));
      }
      return notFound();
    }
    if (url.pathname === '/logout') return redirect('/login', clearCookie);

    // ── дальше только для своих ──
    if (!(await isLoggedIn(request, env.APP_PASSWORD))) {
      // фоновым запросам полезнее честный 401, чем страница логина
      if (url.pathname.startsWith('/api/')) return new Response('Требуется вход', { status: 401 });
      return loginPage();
    }

    switch (url.pathname) {
      // приложение спрашивает при запуске, какие ключи уже есть на сервере,
      // чтобы погасить ненужные поля в Настройках
      case '/api/keys':
        return Response.json({
          claude:  Boolean(env.ANTHROPIC_API_KEY),
          runware: Boolean(env.RUNWARE_API_KEY),
          pexels:  Boolean(env.PEXELS_API_KEY),
          wp:      Boolean(env.WP_USER && env.WP_PASS),
        });
      case '/api/claude':  return proxyClaude(request, env);
      case '/api/runware': return proxyRunware(request, env);
      case '/api/pexels':  return proxyPexels(url, request, env);
      case '/api/wp':      return proxyToWordPress(request, url, env);
    }

    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(appHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    return notFound();
  },
} satisfies ExportedHandler<Env>;

// Если секрет задан — берём его. Если нет — пропускаем то, что прислал браузер,
// чтобы приложение продолжало работать на ключах из Настроек, как раньше.
const noKey = (what: string) =>
  new Response('Ключ ' + what + ' не задан ни в секретах, ни в Настройках', { status: 400 });

async function proxyClaude(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  const key = env.ANTHROPIC_API_KEY || request.headers.get('x-api-key') || '';
  if (!key) return noKey('Anthropic');
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: request.body,
  });
}

async function proxyRunware(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  const fromClient = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const key = env.RUNWARE_API_KEY || fromClient;
  if (!key) return noKey('Runware');
  return fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: request.body,
  });
}

async function proxyPexels(url: URL, request: Request, env: Env): Promise<Response> {
  const key = env.PEXELS_API_KEY || request.headers.get('Authorization') || '';
  if (!key) return noKey('Pexels');
  const target = new URL('https://api.pexels.com/v1/search');
  for (const [k, v] of url.searchParams) target.searchParams.set(k, v);
  return fetch(target.toString(), { headers: { Authorization: key } });
}

// Пробрасывает запрос на wp-proxy.php / wp-media-proxy.php твоего сайта.
// Логин и пароль подставляются из секретов; если их нет — идут те, что в Настройках.
async function proxyToWordPress(request: Request, url: URL, env: Env): Promise<Response> {
  const siteParam = url.searchParams.get('site') || '';
  const file = url.searchParams.get('file') || '';

  if (!WP_FILES.has(file)) return new Response('Недопустимый файл: ' + file, { status: 400 });

  let site: URL;
  try { site = new URL(siteParam); } catch { return new Response('Некорректный адрес сайта', { status: 400 }); }
  if (site.protocol !== 'https:') return new Response('Сайт должен быть на https', { status: 400 });

  const allowed = env.ALLOWED_WP_HOSTS.split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
  const host = site.hostname.toLowerCase();
  if (!allowed.some(a => host === a || host.endsWith('.' + a))) {
    return new Response('Домен ' + host + ' не разрешён. Добавь его в ALLOWED_WP_HOSTS в wrangler.toml', { status: 403 });
  }

  // собираем адрес на сайте: базовый путь + нужный php + все параметры, кроме служебных
  const target = new URL(site.pathname.replace(/\/*$/, '/') + file, site.origin);
  for (const [k, v] of url.searchParams) if (k !== 'site' && k !== 'file') target.searchParams.set(k, v);

  const headers = new Headers();
  for (const name of ['X-WP-User', 'X-WP-Pass', 'X-WP-Method', 'Content-Type']) {
    const v = request.headers.get(name);
    if (v) headers.set(name, v);
  }
  if (env.WP_USER && env.WP_PASS) {
    headers.set('X-WP-User', env.WP_USER);
    headers.set('X-WP-Pass', env.WP_PASS);
  }

  let body: BodyInit | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    // загрузка картинок идёт формой, логин лежит полями внутри неё — их тоже подменяем
    if (file === 'wp-media-proxy.php' && env.WP_USER && env.WP_PASS) {
      const form = await request.formData();
      form.set('wp_user', env.WP_USER);
      form.set('wp_pass', env.WP_PASS);
      body = form;
      headers.delete('Content-Type');   // fetch проставит свой, с разделителем
    } else {
      body = request.body ?? undefined;
    }
  }

  const upstream = await fetch(target.toString(), { method: request.method, headers, body });

  // отдаём ответ как есть, но чужие куки в браузер не пускаем
  const out = new Headers(upstream.headers);
  out.delete('Set-Cookie');
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
