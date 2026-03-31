/**
 * Codex OAuth — Sign in with ChatGPT (PKCE)
 *
 * Reuses your ChatGPT Plus/Pro subscription via OAuth.
 * Tokens stored in local JSON file (no database needed).
 */
const { randomBytes, createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// ── OAuth constants ──
const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize';
const TOKEN_URL = 'https://auth.openai.com/oauth/token';
const SCOPE = 'openid profile email offline_access api.connectors.read api.connectors.invoke';
const CODEX_BASE_URL = 'https://chatgpt.com/backend-api';

// ── Token storage (file-based) ──
const TOKEN_FILE = path.join(__dirname, 'codex-auth.json');

let authCache = null;
let pendingFlow = null;

function loadAuth() {
  try {
    // Railway: lê de env var CODEX_AUTH_JSON
    if (process.env.CODEX_AUTH_JSON) {
      authCache = JSON.parse(process.env.CODEX_AUTH_JSON);
      return authCache;
    }
    if (fs.existsSync(TOKEN_FILE)) {
      authCache = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      return authCache;
    }
  } catch (e) {
    console.error('[codex] Failed to load tokens:', e.message);
  }
  return null;
}

function saveAuth(auth) {
  authCache = auth;
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(auth, null, 2));
  console.log('[codex] Tokens saved, expires:', new Date(auth.expires_at).toISOString());
}

// ── PKCE ──
function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generatePKCE() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
  } catch { return null; }
}

// ── Auth URL ──
function buildAuthUrl(redirectUri) {
  const pkce = generatePKCE();
  const state = randomBytes(8).toString('hex');
  pendingFlow = { state, verifier: pkce.verifier, redirect_uri: redirectUri };

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
    state,
  });

  return { url: `${AUTHORIZE_URL}?${params}`, state };
}

function getPendingFlow() { return pendingFlow; }
function clearPendingFlow() { pendingFlow = null; }

// ── Exchange code for tokens ──
async function exchangeCode(code, redirectUri, verifier) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);

  const jwt = decodeJWT(data.access_token);
  const accountId = jwt?.[`https://api.openai.com/auth`]?.chatgpt_account_id || '';

  const auth = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    account_id: accountId,
  };

  saveAuth(auth);
  return auth;
}

// ── Refresh token ──
async function refreshToken(auth) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: auth.refresh_token,
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);

  const jwt = decodeJWT(data.access_token);
  const accountId = jwt?.[`https://api.openai.com/auth`]?.chatgpt_account_id || auth.account_id;

  const newAuth = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || auth.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    account_id: accountId,
  };

  saveAuth(newAuth);
  return newAuth;
}

// ── Get valid auth (auto-refresh) ──
async function getValidAuth() {
  let auth = authCache || loadAuth();
  if (!auth) return null;

  // Refresh if expires in < 5 min
  if (auth.expires_at - Date.now() < 5 * 60 * 1000) {
    console.log('[codex] Token expiring, refreshing...');
    try {
      auth = await refreshToken(auth);
    } catch (e) {
      console.error('[codex] Refresh failed:', e.message);
      return null;
    }
  }

  return auth;
}

// ── Call ChatGPT backend ──
async function callOpenAI(systemPrompt, messages) {
  const auth = await getValidAuth();
  if (!auth) {
    throw new Error('Codex OAuth not configured. Visit /auth to authorize.');
  }

  const inputMessages = messages.map(m => ({
    role: m.role === 'bot' ? 'assistant' : m.role,
    content: m.content,
  }));

  const res = await fetch(`${CODEX_BASE_URL}/codex/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.access_token}`,
      'chatgpt-account-id': auth.account_id,
      'OpenAI-Beta': 'responses=experimental',
      'originator': 'codex_cli_rs',
      'accept': 'text/event-stream',
    },
    body: JSON.stringify({
      model: 'gpt-5-codex-mini',
      instructions: systemPrompt,
      input: inputMessages,
      stream: true,
      store: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.error('[codex] API error:', res.status, err);
    if (res.status === 401) {
      authCache = null;
      try { fs.unlinkSync(TOKEN_FILE); } catch {}
    }
    throw new Error(`OpenAI API error: ${res.status}`);
  }

  const rawBody = await res.text();
  let fullText = '';

  for (const line of rawBody.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (payload === '[DONE]') break;
    try {
      const evt = JSON.parse(payload);
      if (evt.type === 'response.output_text.delta' && evt.delta) fullText += evt.delta;
      if (evt.type === 'response.content_part.delta' && evt.delta?.text) fullText += evt.delta.text;
      if (evt.type === 'response.completed' && evt.response?.output) {
        const parts = evt.response.output
          .filter(o => o.type === 'message')
          .flatMap(o => o.content || [])
          .filter(c => c.type === 'output_text')
          .map(c => c.text);
        if (parts.length > 0 && !fullText) fullText = parts.join('\n');
      }
    } catch {}
  }

  return fullText || 'Desculpa, nao consegui processar agora. Tenta de novo!';
}

// ── Proactive refresh ──
async function proactiveRefresh() {
  const auth = authCache || loadAuth();
  if (!auth) return;
  if (auth.expires_at - Date.now() < 24 * 60 * 60 * 1000) {
    try {
      await refreshToken(auth);
      console.log('[codex] Proactive refresh OK');
    } catch (e) {
      console.error('[codex] Proactive refresh failed:', e.message);
    }
  }
}

setTimeout(() => {
  proactiveRefresh();
  setInterval(proactiveRefresh, 12 * 60 * 60 * 1000);
}, 10_000);

module.exports = {
  buildAuthUrl, getPendingFlow, clearPendingFlow,
  exchangeCode, getValidAuth, callOpenAI, loadAuth,
};
