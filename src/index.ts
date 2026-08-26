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
      case '/api/llm':     return proxyRunwareChat(request, env);
      // список текстовых моделей аккаунта — чтобы не вводить идентификаторы руками
      case '/api/llm/models': {
        const key = env.RUNWARE_API_KEY || (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
        if (!key) return noKey('Runware');
        return fetch('https://api.runware.ai/v1/models', { headers: { 'Authorization': 'Bearer ' + key } });
      }
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

// Cloudflare обрывает запрос, если за 100 секунд от нас не ушло ни байта. Генерация
// длинной статьи занимает больше. Раньше это работало, потому что браузер ходил
// в Anthropic напрямую, минуя Cloudflare; теперь запрос идёт через Worker.
//
// Поэтому: ждём ответ 20 секунд. Успел — отдаём как есть, с настоящим кодом ответа.
// Не успел — начинаем отдавать тело прямо сейчас и подсыпаем по пробелу каждые
// 10 секунд, пока ответ не придёт. Пробелы перед JSON допустимы, JSON.parse их
// не замечает, а соединение остаётся живым сколько угодно долго.
//
// Плата: на медленном пути код 200 уже обещан и поменять его нельзя, поэтому ошибку
// приходится класть в тело ответа. Приложение это понимает и разбирает.
const HOLD_AFTER_MS = 20_000;
const HOLD_TICK_MS = 10_000;

async function slowSafe(
  upstream: Promise<Response>,
  errorBody: (status: number, text: string) => unknown,
): Promise<Response> {
  const raced = await Promise.race([
    upstream.then(r => ({ r } as { r: Response | null })),
    new Promise<{ r: Response | null }>(res => setTimeout(() => res({ r: null }), HOLD_AFTER_MS)),
  ]);
  if (raced.r) return raced.r;   // уложились — обычный ответ со своим статусом

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  let finished = false;

  const keepalive = (async () => {
    while (!finished) {
      await new Promise(res => setTimeout(res, HOLD_TICK_MS));
      if (finished) break;
      try { await writer.write(enc.encode(' ')); } catch { break; }
    }
  })();

  (async () => {
    try {
      const res = await upstream;
      finished = true;
      await keepalive;
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } else {
        const text = await res.text().catch(() => '');
        await writer.write(enc.encode(JSON.stringify(errorBody(res.status, text))));
      }
    } catch (e) {
      finished = true;
      await keepalive;
      const msg = e instanceof Error ? e.message : String(e);
      try { await writer.write(enc.encode(JSON.stringify(errorBody(0, msg)))); } catch { /* уже закрыто */ }
    } finally {
      try { await writer.close(); } catch { /* уже закрыто */ }
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Ошибку от Anthropic приложение ищет в поле error — кладём туда же настоящий статус,
// чтобы повторы при 429 и 529 продолжали работать.
const anthropicError = (status: number, text: string) => {
  let message = text;
  try { message = JSON.parse(text)?.error?.message || text; } catch { /* не JSON */ }
  return { error: { type: 'upstream_error', status, message: message || ('Claude ' + status) } };
};

// Runware приложение проверяет по полю errors — повторяем его форму.
const runwareError = (status: number, text: string) => {
  let message = text;
  try { message = JSON.parse(text)?.errors?.[0]?.message || text; } catch { /* не JSON */ }
  return { errors: [{ code: 'upstream_error', status, message: message || ('Runware ' + status) }] };
};

// Отрезков два, и таймаут был на обоих.
//
// Браузер ↔ Worker закрыт удержанием соединения (slowSafe выше).
//
// Worker ↔ Anthropic — этот. Обычный запрос молчит всё время генерации, а перед
// api.anthropic.com стоит свой край Cloudflare, который рвёт молчащее соединение
// и отдаёт 524. Поэтому просим у Anthropic поток: он начинает слать события сразу
// и присылает ping, соединение не простаивает. Приложению поток не нужен — оно ждёт
// обычный JSON, — поэтому Worker собирает ответ обратно сам.
async function proxyClaude(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  const key = env.ANTHROPIC_API_KEY || request.headers.get('x-api-key') || '';
  if (!key) return noKey('Anthropic');

  const raw = await request.text();
  let body: Record<string, unknown> | null = null;
  try { body = JSON.parse(raw); } catch { /* отправим как есть */ }
  const clientWantsStream = Boolean(body && body.stream === true);
  if (body && !clientWantsStream) body.stream = true;

  const upstream = fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: body ? JSON.stringify(body) : raw,
  });

  // если поток заказал сам клиент — не вмешиваемся
  return slowSafe(clientWantsStream ? upstream : upstream.then(collectAnthropicStream), anthropicError);
}

// Собирает поток событий Anthropic обратно в тот же JSON, который пришёл бы
// без стриминга: те же блоки content, тот же stop_reason. Приложение разницы не видит.
async function collectAnthropicStream(res: Response): Promise<Response> {
  if (!res.ok || !res.body) return res;   // ошибку отдаём как есть, со своим статусом

  const json = (v: unknown, status: number) =>
    new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });

  let message: Record<string, any> | null = null;
  const blocks: any[] = [];
  const partialJson: Record<number, string> = {};
  let streamError: unknown = null;

  const handle = (e: any) => {
    switch (e.type) {
      case 'message_start':
        message = { ...e.message };
        break;
      case 'content_block_start': {
        const b = { ...e.content_block };
        if (b.type === 'text' && b.text == null) b.text = '';
        blocks[e.index] = b;
        if ('input' in b) partialJson[e.index] = '';   // tool_use и server_tool_use копят JSON по кускам
        break;
      }
      case 'content_block_delta': {
        const b = blocks[e.index]; if (!b) break;
        const d = e.delta || {};
        if (d.type === 'text_delta') b.text = (b.text || '') + d.text;
        else if (d.type === 'input_json_delta') partialJson[e.index] = (partialJson[e.index] || '') + d.partial_json;
        else if (d.type === 'thinking_delta') b.thinking = (b.thinking || '') + d.thinking;
        else if (d.type === 'signature_delta') b.signature = d.signature;
        else if (d.type === 'citations_delta') b.citations = [...(b.citations || []), d.citation];
        break;
      }
      case 'content_block_stop': {
        const b = blocks[e.index];
        if (b && partialJson[e.index] !== undefined) {
          try { b.input = JSON.parse(partialJson[e.index] || '{}'); } catch { b.input = {}; }
        }
        break;
      }
      case 'message_delta':
        if (message) {
          Object.assign(message, e.delta || {});
          if (e.usage) message.usage = { ...(message.usage || {}), ...e.usage };
        }
        break;
      case 'error':
        streamError = e.error;
        break;
    }
  };

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    for (;;) {
      const nl = buf.indexOf('\n');
      if (nl < 0) break;
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;      // event: и ping нам не нужны
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try { handle(JSON.parse(payload)); } catch { /* не наш кадр */ }
    }
  }

  if (streamError) return json({ error: streamError }, 500);
  if (!message) return json({ error: { message: 'Anthropic вернул пустой поток' } }, 502);
  // приведение нужно только компилятору: он не видит присваивания внутри handle()
  const out = message as Record<string, any>;
  out.content = blocks.filter(Boolean);
  return json(out, 200);
}

// Текстовые модели Runware через её OpenAI-совместимый эндпоинт. Ключ тот же самый,
// что для картинок, поэтому отдельного секрета не понадобилось.
async function proxyRunwareChat(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  const fromClient = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const key = env.RUNWARE_API_KEY || fromClient;
  if (!key) return noKey('Runware');
  return slowSafe(fetch('https://api.runware.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: request.body,
  }), anthropicError);   // форма {error:{message}} совпадает, приложение её понимает
}

async function proxyRunware(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  const fromClient = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const key = env.RUNWARE_API_KEY || fromClient;
  if (!key) return noKey('Runware');
  return slowSafe(fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: request.body,
  }), runwareError);
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
