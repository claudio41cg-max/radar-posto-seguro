// @ts-nocheck
// RADAR SEGURO RJ PRO
// Worker isolado para teste de conexão direta navegador -> Gemini Live.
// Este arquivo NÃO substitui o Worker WebSocket atual.
// Função única: emitir token efêmero curto para o navegador.

const DEFAULT_ORIGIN = 'https://claudio41cg-max.github.io';
const TOKEN_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/auth_tokens';
const LIVE_MODEL = 'models/gemini-3.1-flash-live-preview';

function apiKeyFor(env) {
  return String(
    env.GEMINI_LIVE_API_KEY ||
    env.GEMINI_API_KEY ||
    env.GEMINI_LIVE_PAID_API_KEY ||
    env.GEMINI_LIVE_FREE_API_KEY ||
    ''
  ).trim();
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || DEFAULT_ORIGIN)
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = allowedOrigins(env);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };

  if (allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '600';
  }

  return headers;
}

function json(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(request, env)
  });
}

function originAllowed(request, env) {
  const origin = request.headers.get('Origin') || '';
  return allowedOrigins(env).includes(origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      if (!originAllowed(request, env)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env)
      });
    }

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return json(request, env, {
        ok: true,
        service: 'radar-gemini-ephemeral-token',
        mode: 'direct-browser-to-gemini',
        model: LIVE_MODEL,
        configured: Boolean(apiKeyFor(env))
      });
    }

    if (url.pathname !== '/v1/ephemeral-token') {
      return json(request, env, { ok: false, error: 'Rota não encontrada.' }, 404);
    }

    if (request.method !== 'POST') {
      return json(request, env, { ok: false, error: 'Método não permitido.' }, 405);
    }

    if (!originAllowed(request, env)) {
      return json(request, env, { ok: false, error: 'Origem não autorizada.' }, 403);
    }

    const apiKey = apiKeyFor(env);
    if (!apiKey) {
      return json(request, env, { ok: false, error: 'Chave Gemini não configurada.' }, 503);
    }

    // Janela curta para iniciar a conexão; validade maior para a sessão já aberta.
    const now = Date.now();
    const body = {
      uses: 1,
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      expireTime: new Date(now + 30 * 60 * 1000).toISOString()
    };

    let upstream;
    try {
      upstream = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      return json(request, env, {
        ok: false,
        error: 'Falha de rede ao solicitar token temporário.'
      }, 502);
    }

    let payload = null;
    try {
      payload = await upstream.json();
    } catch (_) {}

    if (!upstream.ok || !payload?.name) {
      return json(request, env, {
        ok: false,
        error: 'Gemini recusou a criação do token temporário.',
        status: upstream.status,
        detail: payload?.error?.message || null
      }, 502);
    }

    return json(request, env, {
      ok: true,
      token: payload.name,
      expireTime: payload.expireTime || body.expireTime,
      newSessionExpireTime: payload.newSessionExpireTime || body.newSessionExpireTime,
      model: LIVE_MODEL,
      websocket: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained'
    });
  }
};
