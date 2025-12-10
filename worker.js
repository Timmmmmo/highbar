// worker.js
// Cloudflare Worker：通用代理 + 完整 CORS 逻辑（支持凭据/白名单/预检回显）
// Date: 2025-12-10

/**
 * 环境变量（在 Dashboard → Settings → Variables 或用 Wrangler 设置）：
 * - ALLOWED_ORIGINS: 逗号分隔的允许来源，例如 "https://example.com,https://foo.bar"
 * - CORS_ALLOW_CREDENTIALS: "true" 或 "false"，启用后将返回 Access-Control-Allow-Credentials: true，且必须命中白名单来源
 * - CORS_ALLOW_METHODS: 允许的方法，默认 "GET,POST,PUT,DELETE,PATCH,OPTIONS"
 * - CORS_MAX_AGE: 预检缓存秒数，默认 "600"
 * - DEFAULT_TARGET: 默认后端地址（例如 https://api.example.com），可被 ?target=... 或 Header: X-Target 覆盖
 * - BIYING_LIC: 后端认证/许可证，转发为 Header: X-License（如需自定义请在 proxyRequest 中调整）
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 健康检查端点
    if (url.pathname === '/health') {
      return withCorsHeaders(new Response(JSON.stringify({
        ok: true,
        worker: 'highbar2',
        time: new Date().toISOString()
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }), request, env);
    }

    // 处理预检（OPTIONS）
    if (request.method === 'OPTIONS') {
      return handlePreflight(request, env);
    }

    // 其余请求走代理
    try {
      const resp = await proxyRequest(request, env);
      return withCorsHeaders(resp, request, env);
    } catch (err) {
      const body = JSON.stringify({ error: 'ProxyError', message: err?.message || String(err) });
      return withCorsHeaders(new Response(body, { status: 502, headers: { 'Content-Type': 'application/json' } }), request, env);
    }
  }
};

/**
 * 预检处理：严格按照请求头回显 Access-Control-Request-Headers/Method；
 * 并根据白名单/凭据策略返回 Allow-Origin。
 */
function handlePreflight(request, env) {
  const reqHeaders = request.headers.get('Access-Control-Request-Headers') || 'Content-Type, Authorization';
  const reqMethod  = request.headers.get('Access-Control-Request-Method') || 'GET';

  const headers = buildCorsHeaders(request, env, {
    allowMethods: reqMethod,
    allowHeaders: reqHeaders,
  });

  // 预检无需主体
  return new Response(null, { status: 204, headers });
}

/**
 * 对实际响应附加 CORS 头。
 */
function withCorsHeaders(resp, request, env) {
  const cors = buildCorsHeaders(request, env);
  const newHeaders = new Headers(resp.headers);
  for (const [k, v] of Object.entries(cors)) newHeaders.set(k, v);
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: newHeaders });
}

/**
 * 构造 CORS 响应头，根据是否启用凭据与白名单决定 Allow-Origin 值。
 */
function buildCorsHeaders(request, env, opts = {}) {
  const origin = request.headers.get('Origin');
  const allowMethods = opts.allowMethods || env.CORS_ALLOW_METHODS || 'GET,POST,PUT,DELETE,PATCH,OPTIONS';
  const allowHeaders = opts.allowHeaders || 'Content-Type, Authorization';
  const maxAge = String(env.CORS_MAX_AGE || '600');

  const allowCreds = String(env.CORS_ALLOW_CREDENTIALS || 'false').toLowerCase() === 'true';
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);

  const headers = {
    'Access-Control-Allow-Methods': allowMethods,
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Max-Age': maxAge,
    'Vary': 'Origin'
  };

  // 计算 Allow-Origin
  if (allowCreds) {
    // 凭据模式：必须是白名单命中，且不能返回 *
    if (origin && isOriginAllowed(origin, allowedOrigins)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    } else {
      // 不命中白名单，拒绝（可选：返回 403；此处仅不设置 Allow-Origin，让浏览器阻断）
      headers['Access-Control-Allow-Origin'] = 'null';
    }
  } else {
    // 非凭据：允许 * 或白名单命中
    if (allowedOrigins.has('*')) {
      headers['Access-Control-Allow-Origin'] = '*';
    } else if (origin && isOriginAllowed(origin, allowedOrigins)) {
      headers['Access-Control-Allow-Origin'] = origin;
    } else {
      headers['Access-Control-Allow-Origin'] = 'null';
    }
  }

  return headers;
}

/**
 * 解析 ALLOWED_ORIGINS，支持逗号分隔；支持通配 *（仅整体），以及以 ".domain.com" 表示子域匹配。
 */
function parseAllowedOrigins(value) {
  const set = new Set();
  if (!value) { set.add('*'); return set; } // 默认开发模式允许所有
  for (const raw of String(value).split(',').map(s => s.trim()).filter(Boolean)) {
    set.add(raw);
  }
  return set;
}

function isOriginAllowed(origin, allowedSet) {
  if (allowedSet.has('*')) return true;
  if (allowedSet.has(origin)) return true;
  try {
    const u = new URL(origin);
    const host = u.host;
    // 支持以 .domain.com 形式的子域匹配
    for (const rule of allowedSet) {
      if (rule.startsWith('.')) {
        // .example.com: 允许 foo.example.com，但不允许 example.com 本身
        if (host.endsWith(rule) && host.length > rule.length) return true;
      } else if (rule.startsWith('http://') || rule.startsWith('https://')) {
        if (origin === rule) return true;
      }
    }
  } catch (_) {}
  return false;
}

/**
 * 简单反向代理：将前端请求转发到目标后端。
 * 目标解析优先级：query ?target=… → Header: X-Target → env.DEFAULT_TARGET。
 */
async function proxyRequest(request, env) {
  const url = new URL(request.url);

  // 解析目标
  const target = url.searchParams.get('target') || request.headers.get('X-Target') || env.DEFAULT_TARGET;
  if (!target) throw new Error('No target specified: set DEFAULT_TARGET or provide ?target=');

  // 仅允许 http/https 目标
  let targetUrl;
  try {
    targetUrl = new URL(target);
    if (!['http:', 'https:'].includes(targetUrl.protocol)) throw 0;
  } catch (_) {
    throw new Error(`Invalid target URL: ${target}`);
  }

  // 拼接路径：保留前端请求路径与查询，但可选择性重写（此处示例保留原路径）
  const forwardUrl = new URL(targetUrl.toString());
  forwardUrl.pathname = url.pathname; // 将当前路径转发到后端
  forwardUrl.search = url.search;     // 保留查询参数（包含 target，本端后端可忽略或读取）

  // 构造请求头：复制除 Host/Origin 等少数头；附加许可证
  const headers = new Headers(request.headers);
  headers.delete('Host');
  headers.delete('Origin');
  headers.delete('Referer');
  if (env.BIYING_LIC) headers.set('X-License', env.BIYING_LIC);

  const init = {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    redirect: 'follow'
  };

  const resp = await fetch(forwardUrl, init);

  // 你也可以在此处根据后端返回做额外处理（例如过滤/改写 JSON）
  return resp;
}
