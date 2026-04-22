import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { QuantativeMarketVectorPullEngine } from './engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const maybeDistPublic = path.join(__dirname, 'public');
const maybeRootPublic = path.join(projectRoot, 'public');
const modelStatePath = path.join(projectRoot, 'data', 'model_state.json');

const PORT = Number(process.env.PORT ?? 4309);
const HOST = '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const engine = new QuantativeMarketVectorPullEngine(modelStatePath);

async function resolvePublicDir() {
  try {
    await stat(maybeDistPublic);
    return maybeDistPublic;
  } catch {
    return maybeRootPublic;
  }
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON payload.');
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });

  response.end(JSON.stringify(payload, null, 2));
}

function parseLivePullConfigFromQuery(url) {
  const symbolsRaw = url.searchParams.get('symbols');
  const symbols = symbolsRaw
    ? symbolsRaw
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : undefined;

  return {
    query: url.searchParams.get('query') || undefined,
    subreddit: url.searchParams.get('subreddit') || undefined,
    symbols,
    xLimit: url.searchParams.get('xLimit') || undefined,
    redditLimit: url.searchParams.get('redditLimit') || undefined,
    timeoutMs: url.searchParams.get('timeoutMs') || undefined
  };
}

async function serveStatic(requestPath, response) {
  const publicDir = await resolvePublicDir();
  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = path.join(publicDir, normalizedPath.replace(/^\/+/, ''));

  if (!filePath.startsWith(publicDir)) {
    sendJson(response, 403, { error: 'Forbidden path.' });
    return;
  }

  try {
    const extension = path.extname(filePath);
    const content = await readFile(filePath);
    response.writeHead(200, {
      'content-type': MIME_TYPES[extension] ?? 'application/octet-stream'
    });
    response.end(content);
  } catch {
    if (normalizedPath !== '/index.html') {
      return serveStatic('/', response);
    }

    sendJson(response, 404, { error: 'Not found.' });
  }
}

async function handleApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'qmVP',
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/model') {
    try {
      const summary = await engine.modelSummary();
      sendJson(response, 200, summary);
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/pull') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      sendJson(response, 400, { error: 'Query parameter `url` is required.' });
      return;
    }

    try {
      const result = await engine.pull(targetUrl);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 422, { error: error.message });
    }
    return;
  }

  if (
    (request.method === 'GET' || request.method === 'POST')
    && (url.pathname === '/api/pull/live' || url.pathname === '/api/live-pull')
  ) {
    try {
      const payload = request.method === 'POST'
        ? await readJsonBody(request)
        : parseLivePullConfigFromQuery(url);

      const result = await engine.pullLive(payload);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 422, { error: error.message });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/train') {
    try {
      const payload = await readJsonBody(request);
      const urlValue = payload.url;
      const label = String(payload.label || '').toLowerCase();

      if (!urlValue || !['buy', 'sell', 'hold'].includes(label)) {
        sendJson(response, 400, {
          error: 'Request body must include `url` and `label` (`buy` | `sell` | `hold`).'
        });
        return;
      }

      const result = await engine.train(urlValue, label);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 422, { error: error.message });
    }
    return;
  }

  sendJson(response, 404, { error: 'API route not found.' });
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || `localhost:${PORT}`}`);

  if (requestUrl.pathname.startsWith('/api/')) {
    await handleApi(request, response, requestUrl);
    return;
  }

  await serveStatic(requestUrl.pathname, response);
});

server.listen(PORT, HOST, () => {
  console.log(`qmVP running on http://localhost:${PORT}`);
});
