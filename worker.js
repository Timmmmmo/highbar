
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const log = (msg, obj={}) => console.log(JSON.stringify({at: Date.now(), msg, ...obj}));

    // 示例：从查询参数或路径决定实际后端 API
    const target = url.searchParams.get('target') || env.DEFAULT_TARGET; // 在 Cloudflare Secrets/Vars 中配置
    if (!target) return new Response('Missing target', {status:400});

    const reqInit = {
      method: 'GET',
      headers: {
        'Authorization': env.BIYING_LIC ? `Bearer ${env.BIYING_LIC}` : undefined
      }
    };

    try {
      const res = await fetch(target, reqInit);
      log('proxy_ok', {status: res.status});
      const body = await res.text();

      return new Response(body, {
        status: res.status,
        headers: {
          'content-type': res.headers.get('content-type') || 'application/json; charset=utf-8',
          // CORS
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,OPTIONS',
          'access-control-allow-headers': 'Content-Type,Authorization',
          // 轻缓存（可按需调整；GitHub Pages 服务侧缓存无法自定义，代理可控）[10](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
          'cache-control': 'public, max-age=60'
        }
      });
    } catch (err) {
      log('proxy_err', {error: String(err)});
      return new Response(JSON.stringify({error: 'upstream_error', detail: String(err)}), {
        status: 502,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'access-control-allow-origin': '*'
        }
      });
    }
  }
}
