const DEFAULT_ORIGIN = 'https://claudio41cg-max.github.io';
const GEMINI_WS_HTTP = 'https://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const MAX_CLIENT_ID = 80;

function clean(value, max = 200) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function allowedOrigins(env) {
  return new Set(
    String(env.ALLOWED_ORIGINS || DEFAULT_ORIGIN)
      .split(',')
      .map(v => v.trim())
      .filter(Boolean)
  );
}

function selectGeminiKey(env) {
  const dedicated = String(env.GEMINI_LIVE_API_KEY || '').trim();
  const fallback = String(env.GEMINI_API_KEY || '').trim();
  const paid = String(env.GEMINI_LIVE_PAID_API_KEY || '').trim();
  const free = String(env.GEMINI_LIVE_FREE_API_KEY || '').trim();

  if (dedicated) return { key: dedicated, source: 'live' };
  if (fallback) return { key: fallback, source: 'default' };
  if (paid) return { key: paid, source: 'paid' };
  if (free) return { key: free, source: 'free' };
  return { key: '', source: 'none' };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function safeClose(ws, code = 1000, reason = '') {
  try {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close(code, clean(reason, 120));
    }
  } catch (_) {}
}

function relay(from, to, label) {
  from.addEventListener('message', event => {
    try {
      if (to.readyState === WebSocket.OPEN) to.send(event.data);
    } catch (error) {
      console.warn(`Radar Live proxy relay ${label}`, clean(error?.message || error, 300));
      safeClose(from, 1011, 'relay_error');
      safeClose(to, 1011, 'relay_error');
    }
  });
}

async function openGeminiSocket(apiKey) {
  const target = `${GEMINI_WS_HTTP}?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(target, {
    headers: { Upgrade: 'websocket' }
  });

  if (!response.webSocket) {
    let body = '';
    try { body = clean(await response.text(), 600); } catch (_) {}
    const error = new Error(body || `Gemini WebSocket HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const socket = response.webSocket;
  try { socket.accept({ allowHalfOpen: true }); }
  catch (_) { socket.accept(); }
  return socket;
}

async function handleLiveWebSocket(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!allowedOrigins(env).has(origin)) {
    return new Response('Origem não autorizada.', { status: 403 });
  }

  if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  const selected = selectGeminiKey(env);
  if (!selected.key) {
    return new Response('Gemini Live não configurado no Worker.', { status: 503 });
  }

  const url = new URL(request.url);
  const clientId = clean(url.searchParams.get('client'), MAX_CLIENT_ID);

  let upstream;
  try {
    upstream = await openGeminiSocket(selected.key);
  } catch (error) {
    const upstreamStatus = Number(error?.status) || 0;
    console.warn('Radar Live upstream handshake failed', {
      upstreamStatus,
      keySource: selected.source,
      clientId: clientId || 'none',
      message: clean(error?.message || error, 500)
    });
    return new Response(
      `Gemini Live upstream recusou a conexão${upstreamStatus ? ` (${upstreamStatus})` : ''}.`,
      { status: 502 }
    );
  }

  const pair = new WebSocketPair();
  const client = pair[0];
  const browser = pair[1];

  try { browser.accept({ allowHalfOpen: true }); }
  catch (_) { browser.accept(); }

  relay(browser, upstream, 'browser->gemini');
  relay(upstream, browser, 'gemini->browser');

  browser.addEventListener('close', event => {
    safeClose(upstream, event.code || 1000, event.reason || 'browser_closed');
  });

  upstream.addEventListener('close', event => {
    safeClose(browser, event.code || 1000, event.reason || 'gemini_closed');
  });

  browser.addEventListener('error', () => {
    safeClose(upstream, 1011, 'browser_error');
  });

  upstream.addEventListener('error', () => {
    safeClose(browser, 1011, 'gemini_error');
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
    headers: {
      'Cache-Control': 'no-store'
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      const selected = selectGeminiKey(env);
      return json({
        ok: true,
        service: 'radar-gemini-live-websocket-proxy',
        version: '202',
        configured: Boolean(selected.key),
        keySource: selected.source,
        mode: 'direct-websocket-proxy',
        upstream: 'BidiGenerateContent'
      });
    }

    if (url.pathname === '/v1/live-ws') {
      return handleLiveWebSocket(request, env);
    }

    return json({ ok: false, error: 'Rota não encontrada.' }, 404);
  }
};
