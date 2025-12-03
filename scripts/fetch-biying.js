
// Node 18+ (global fetch)
import fs from 'node:fs';
import path from 'node:path';

const LIC = process.env.BIYING_LIC || '';
const BASE_PRIMARY = (process.env.BIYING_BASE || 'https://api.biyingapi.com').replace(/\/$/, '');
const BASE_FALLBACK = 'https://api1.biyingapi.com'; // 备用域（文档/社区提到存在备用接口域）

function isTradingNow() {
  const now = new Date(); // Asia/Shanghai via env TZ
  const h = now.getHours(), m = now.getMinutes();
  const t = h * 60 + m;
  const isWeekday = now.getDay() !== 0 && now.getDay() !== 6;
  return isWeekday && ((t >= 9 * 60 + 30 && t <= 11 * 60 + 30) || (t >= 13 * 60 && t <= 15 * 60));
}

function yyyy_mm_dd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function fetchJson(url) {
  const r = await fetch(url, { method: 'GET' });
  if (!r.ok) {
    // 429 可视作当日限流；社区文章也提到返回 101 代表当日请求超限（后端可能非标准 HTTP 码）
    throw new Error(`HTTP ${r.status}: ${url}`);
  }
  const data = await r.json().catch(() => null);
  if (!data) throw new Error(`Invalid JSON from ${url}`);
  return data;
}

(async () => {
  if (!LIC) {
    console.error('Missing BIYING_LIC secret.');
    process.exit(1);
  }
  const dateStr = yyyy_mm_dd();
  const outDir = path.join('data');
  const outFile = path.join(outDir, `${dateStr}.json`);

  if (fs.existsSync(outFile) && !isTradingNow()) {
    console.log(`[skip] ${outFile} exists and not in trading window.`);
    process.exit(0);
  }

  // 涨停股池：/hslt/ztgc/{YYYY-MM-DD}/{licence}
  const makeUrl = (base) => `${base}/hslt/ztgc/${dateStr}/${LIC}`;

  let data = null;
  try {
    data = await fetchJson(makeUrl(BASE_PRIMARY));
  } catch (e1) {
    console.warn(`Primary base failed: ${e1.message}. Try fallback...`);
    try {
      data = await fetchJson(makeUrl(BASE_FALLBACK));
    } catch (e2) {
      console.error(`Both bases failed: ${e2.message}`);
      process.exit(2);
    }
  }

  // 字段归一化（兼容不同来源字段名）
  const toNum = (x) => (typeof x === 'number' ? x : Number(x || 0));
  const pool = Array.isArray(data) ? data.map((x) => ({
    code: x.dm || x.code || '',
    name: x.mc || x.name || '',
    boards: toNum(x.lbc ?? x.lbNum ?? x.ConsecutiveBoards),
    firstSeal: x.fbt || x.FirstSealingTime || '',
    lastSeal: x.lbt || x.LastSealingTime || '',
    changePct: toNum(x.zf ?? x.ChangeRate),
    amount: toNum(x.cje ?? x.TransactionAmount),
  })) : [];

  const maxBoards = pool.reduce((acc, cur) => (cur.boards > (acc.boards || 0) ? cur : acc), { code: '', name: '', boards: 0 });
  const payload = {
    date: dateStr,
    source: 'biyingapi',
    pool,
    maxBoards,
    summary: { count: pool.length, highest: maxBoards.boards || 0 }
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Wrote ${outFile} with ${pool.length} rows; highest boards = ${payload.summary.highest}`);
})();
