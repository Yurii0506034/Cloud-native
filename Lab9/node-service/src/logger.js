const pino = require('pino');
const { trace } = require('@opentelemetry/api');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'node-api', pid: process.pid },
  redact: [
    'req.headers.authorization',
    '*.password',
    '*.passwordHash',
    '*.token',
    '*.refreshToken',
  ],
  mixin() {
    const span = trace.getActiveSpan();
    if (!span) return {};
    return { trace_id: span.spanContext().traceId };
  },
});

module.exports = logger;