addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

// 如果你在 Worker 上配置了 Secret（命名为 BIYING_LIC），
// 可以直接在 Worker 环境中使用全局变量 BIYING_LIC（通过 wrangler secret put 设置）。
async function handle(req){
  const url = new URL(req.url);
  const d = url.searchParams.get('d') || url.pathname.split('/').pop() || '';
  // 优先使用 query 中的 lic，否则使用部署时的 Secret（BIYING_LIC）
  let lic = url.searchParams.get('lic') || '';
  if(!lic && typeof BIYING_LIC !== 'undefined') lic = BIYING_LIC;

  // 目标 API（按需修改）
  const target = `https://api.biyingapi.com/hslt/ztgc/${d}/${lic}`;

  // 允许跨域的响应头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };

  if(req.method === 'OPTIONS'){
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try{
    const r = await fetch(target, { method: 'GET' });
    const body = await r.arrayBuffer();
    const headers = new Headers(r.headers);
    // 覆盖 CORS 头
    for(const k in corsHeaders) headers.set(k, corsHeaders[k]);
    return new Response(body, { status: r.status, headers });
  }catch(err){
    return new Response(JSON.stringify({ error: 'proxy_error', detail: String(err) }), {
      status: 502,
      headers: Object.assign({'Content-Type':'application/json'}, corsHeaders)
    });
  }
}
