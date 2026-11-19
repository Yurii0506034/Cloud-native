import './tracing.js';
import express from 'express';
import crypto from 'node:crypto';
import { trace, context } from '@opentelemetry/api';
import { logger } from './logger.js';
import { register, httpRequestDuration, authOutcomesCounter } from './metrics.js';

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

// Security headers (Lab 7 / Lab 8 defense-in-depth)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Structured JSON request logging + metrics + trace correlation (Lab 9)
app.use((req, res, next) => {
  if (req.path === '/metrics') {
    return next();
  }
  const start = process.hrtime.bigint();
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();
  const activeSpan = trace.getSpan(context.active());
  const spanCtx = activeSpan?.spanContext();
  const traceId = spanCtx?.traceId || '';
  const spanId = spanCtx?.spanId || '';
  const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';

  logger.info({ reqId, trace_id: traceId, span_id: spanId, method: req.method, url: req.originalUrl, ip: clientIp }, 'request in');

  res.on('finish', () => {
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
    const routeLabel = req.route?.path || req.path || 'unknown';
    httpRequestDuration.observe({ method: req.method, route: routeLabel, status: String(res.statusCode) }, durationSec);
    if ([401, 403, 429].includes(res.statusCode)) {
      authOutcomesCounter.inc({ status: String(res.statusCode) });
    }
    logger.info({ reqId, trace_id: traceId, span_id: spanId, statusCode: res.statusCode, durationSec }, 'request out');
  });

  next();
});

// In-memory store for CRUD & smoke flow
const users = new Map([
  [1, { id: 1, email: 'admin@example.com', name: 'Admin User', role: 'admin' }],
  [2, { id: 2, email: 'user@example.com', name: 'Standard User', role: 'user' }],
]);
let nextUserId = 3;
const events = [];

function recordEvent(type, payload) {
  const evt = { id: events.length + 1, type, payload, timestamp: new Date().toISOString() };
  events.push(evt);
  return evt;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: process.env.SERVICE_NAME || 'node-api', pid: process.pid });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Concurrency endpoints (Lab 2)
app.get('/io', async (req, res) => {
  const delayMs = Math.min(Number(req.query.delayMs) || 25, 500);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  res.json({ mode: 'io', delayMs, service: process.env.SERVICE_NAME || 'node-api' });
});

app.get('/cpu', (req, res) => {
  const iterations = Math.min(Number(req.query.iterations) || 150000, 1000000);
  let acc = 0;
  for (let i = 1; i <= iterations; i++) {
    acc += Math.sqrt(i) * Math.sin(i % 97);
  }
  res.json({ mode: 'cpu', iterations, computed: acc, service: process.env.SERVICE_NAME || 'node-api' });
});

// Auth endpoints (Lab 7)
app.post('/api/auth/register', (req, res) => {
  const { email, name, role = 'user' } = req.body || {};
  if (!email || !name) {
    return res.status(400).json({ error: 'email and name are required' });
  }
  const exists = Array.from(users.values()).some((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (exists) {
    return res.status(409).json({ error: 'email already exists' });
  }
  const user = { id: nextUserId++, email: String(email), name: String(name), role: role === 'admin' ? 'admin' : 'user' };
  users.set(user.id, user);
  recordEvent('user.registered', { id: user.id, email: user.email });
  return res.status(201).json({ user });
});

app.post('/api/auth/login', (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }
  const user = Array.from(users.values()).find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  const accessToken = Buffer.from(JSON.stringify({ sub: user.id, email: user.email, role: user.role, exp: Date.now() + 3600000 })).toString('base64url');
  const refreshToken = crypto.randomUUID();
  recordEvent('user.logged_in', { id: user.id, email: user.email });
  return res.json({ accessToken, refreshToken, tokenType: 'Bearer', user });
});

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing bearer token' });
  }
  try {
    const token = authHeader.slice(7);
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

app.get('/api/users', requireAuth, (req, res) => {
  res.json({ items: Array.from(users.values()) });
});

app.get('/api/users/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid user id' });
  }
  const user = users.get(id);
  if (!user) {
    return res.status(404).json({ error: 'user not found' });
  }
  res.json({ user });
});

app.delete('/api/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  if (!users.has(id)) {
    return res.status(404).json({ error: 'user not found' });
  }
  users.delete(id);
  recordEvent('user.deleted', { id });
  res.status(200).json({ deleted: id });
});

app.get('/api/events', requireAuth, (req, res) => {
  res.json({ items: events });
});

app.get('/api/users/export', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'application/x-ndjson');
  const list = Array.from(users.values());
  let idx = 0;

  function pushNext() {
    while (idx < list.length) {
      const chunk = JSON.stringify(list[idx++]) + '\n';
      const canContinue = res.write(chunk);
      if (!canContinue) {
        res.once('drain', pushNext);
        return;
      }
    }
    res.end();
  }

  pushNext();
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'invalid json payload' });
  }
  logger.error({ err: err?.message }, 'unhandled error');
  return res.status(500).json({ error: 'internal server error' });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  logger.info({ port, service: process.env.SERVICE_NAME || 'node-api' }, 'node service started');
});