// @ts-nocheck

const DEFAULT_ORIGIN = 'https://claudio41cg-max.github.io';
const GEMINI_WS = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

function keyFor(env) {
  return String(
    env.GEMINI_LIVE_API_KEY ||
    env.GEMINI_API_KEY ||
    env.GEMINI_LIVE_PAID_API_KEY ||
    env.GEMINI_LIVE_FREE_API_KEY ||
    ''
  ).trim();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function safeClose(ws, code = 1000, reason = '') {
  try {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close(code, String(reason || '').slice(0, 120));
    }
  } catch (_) {}
}

function sendDiag(ws, stage, extra = {}) {
  try {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ __radarProxy: { version: '205', stage, ...extra } }));
    }
  } catch (_) {}
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || DEFAULT_ORIGIN)
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

function handleLive(request, env) {
  if (!allowedOrigin(request, env)) {
    return new Response('Origem não autorizada.', { status: 403 });
  }

  if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
    return new Response('WebSocket necessário.', { status: 426 });
  }

  const apiKey = keyFor(env);
  if (!apiKey) {
    return new Response('Chave Gemini não configurada.', { status: 503 });
  }

  const pair = new WebSocketPair();
  const client = pair[0];
  const browser = pair[1];
  browser.accept({ allowHalfOpen: true });

  const upstream = new WebSocket(`${GEMINI_WS}?key=${encodeURIComponent(apiKey)}`);
  const queue = [];
  let firstClientMessage = true;
  let firstUpstreamMessage = true;

  sendDiag(browser, 'proxy-created');

  upstream.addEventListener('open', () => {
    console.log('Radar Live v205 upstream open');
    sendDiag(browser, 'gemini-websocket-open');
    while (queue.length && upstream.readyState === WebSocket.OPEN) {
      upstream.send(queue.shift());
    }
  });

  browser.addEventListener('message', event => {
    const payload = event.data;
    if (firstClientMessage) {
      firstClientMessage = false;
      sendDiag(browser, 'setup-received-by-worker');
    }

    try {
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(payload);
        if (!firstClientMessage) sendDiag(browser, 'client-message-forwarded');
      } else if (upstream.readyState === WebSocket.CONNECTING) {
        queue.push(payload);
        sendDiag(browser, 'client-message-queued');
      } else {
        sendDiag(browser, 'gemini-websocket-not-open', { readyState: upstream.readyState });
        safeClose(browser, 1011, 'gemini_not_open');
      }
    } catch (error) {
      console.warn('Radar Live v205 browser relay', String(error?.message || error));
      sendDiag(browser, 'client-relay-error');
      safeClose(browser, 1011, 'relay_error');
      safeClose(upstream, 1011, 'relay_error');
    }
  });

  upstream.addEventListener('message', event => {
    try {
      if (firstUpstreamMessage) {
        firstUpstreamMessage = false;
        sendDiag(browser, 'first-gemini-message-received');
      }
      if (browser.readyState === WebSocket.OPEN) browser.send(event.data);
    } catch (error) {
      console.warn('Radar Live v205 upstream relay', String(error?.message || error));
      safeClose(browser, 1011, 'upstream_relay_error');
      safeClose(upstream, 1011, 'upstream_relay_error');
    }
  });

  upstream.addEventListener('error', event => {
    console.warn('Radar Live v205 upstream error', event);
    sendDiag(browser, 'gemini-websocket-error');
  });

  upstream.addEventListener('close', event => {
    console.warn('Radar Live v205 upstream close', { code: event.code, reason: event.reason });
    sendDiag(browser, 'gemini-websocket-close', { code: event.code, reason: event.reason || '' });
    safeClose(browser, event.code || 1011, event.reason || 'gemini_closed');
  });

  browser.addEventListener('close', event => {
    safeClose(upstream, event.code || 1000, event.reason || 'browser_closed');
  });

  browser.addEventListener('error', () => {
    safeClose(upstream, 1011, 'browser_error');
  });

  return new Response(null, {
    status: 101,
    webSocket: client
  });
}

export default {
  fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return json({
        ok: true,
        service: 'radar-gemini-live-websocket-proxy',
        version: '205',
        configured: Boolean(keyFor(env)),
        mode: 'worker-websocket-client',
        upstream: 'BidiGenerateContent'
      });
    }

    if (url.pathname === '/v1/live-ws') {
      return handleLive(request, env);
    }

    return json({ ok: false, error: 'Rota não encontrada.' }, 404);
  }
};