#!/usr/bin/env node
// Cliente genérico para WC26 Live Football API (RapidAPI).
// La API key se lee de RAPIDAPI_KEY — NUNCA se hardcodea ni se commitea.
// Host por defecto: wc26-live-football-api.p.rapidapi.com (override con RAPIDAPI_HOST).
//
// Uso (PowerShell):
//   $env:RAPIDAPI_KEY="tu_key"
//   & "C:\Program Files\nodejs\node.exe" live-stats.mjs --discover
//   & "C:\Program Files\nodejs\node.exe" live-stats.mjs --endpoint="/fixtures?date=2026-06-13"
//   & "C:\Program Files\nodejs\node.exe" live-stats.mjs --endpoint="/matches/live"
//   & "C:\Program Files\nodejs\node.exe" live-stats.mjs --endpoint="/statistics?match=123" --raw
//   & "C:\Program Files\nodejs\node.exe" live-stats.mjs --endpoint="/statistics?match=123" --xg
//
// --raw  : imprime el JSON crudo completo.
// --xg   : si la respuesta trae estadísticas con tiros, estima xG (heurístico) por equipo.

const KEY = process.env.RAPIDAPI_KEY;
const HOST = process.env.RAPIDAPI_HOST || 'wc26-live-football-api.p.rapidapi.com';
const BASE = `https://${HOST}`;

if (!KEY) {
  console.error('❌ Falta la API key. Definí la variable de entorno y reintentá:');
  console.error('   PowerShell:  $env:RAPIDAPI_KEY="tu_key_de_rapidapi"');
  console.error('   Bash:        export RAPIDAPI_KEY=tu_key_de_rapidapi');
  process.exit(1);
}

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const i = a.indexOf('=');
  return i === -1 ? [a.replace(/^--/, ''), true] : [a.slice(2, i), a.slice(i + 1)];
}));

async function api(path) {
  const url = path.startsWith('http') ? path : `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST },
  });
  const remaining = res.headers.get('x-ratelimit-requests-remaining')
    ?? res.headers.get('x-ratelimit-requests-limit');
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (remaining != null) process.stderr.write(`  (cupo restante hoy: ${remaining})\n`);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}\n  ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}

// Imprime un objeto/array JSON de forma legible y acotada.
function pretty(obj, depth = 0, maxArr = 12) {
  const pad = '  '.repeat(depth + 1);
  if (Array.isArray(obj)) {
    console.log(`${pad}[array de ${obj.length}]`);
    obj.slice(0, maxArr).forEach((it, i) => {
      if (it && typeof it === 'object') { console.log(`${pad}#${i}:`); pretty(it, depth + 1, maxArr); }
      else console.log(`${pad}#${i}: ${it}`);
    });
    if (obj.length > maxArr) console.log(`${pad}… (+${obj.length - maxArr} más)`);
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object') { console.log(`${pad}${k}:`); pretty(v, depth + 1, maxArr); }
      else console.log(`${pad}${k}: ${v}`);
    }
  } else {
    console.log(`${pad}${obj}`);
  }
}

// Heurística: xG aprox desde tiros (señal para el modelo, NO oficial).
function xgFromShots(onGoal, total) {
  const off = Math.max(0, (total || 0) - (onGoal || 0));
  return +((onGoal || 0) * 0.33 + off * 0.05).toFixed(2);
}

// Busca recursivamente bloques que parezcan estadísticas de tiros y estima xG.
function tryXg(obj) {
  const num = (v) => (typeof v === 'string' ? parseFloat(v) : v) || 0;
  const found = [];
  const walk = (node, label) => {
    if (Array.isArray(node)) {
      // patrón [{type,value}]
      const types = node.filter(x => x && x.type != null);
      if (types.length) {
        const get = (re) => num(types.find(t => re.test(String(t.type)))?.value);
        const onG = get(/on (goal|target)/i);
        const tot = get(/total shots|^shots$/i);
        if (onG || tot) found.push({ label, xg: xgFromShots(onG, tot), onG, tot });
      }
      node.forEach((x, i) => walk(x, `${label}[${i}]`));
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, label ? `${label}.${k}` : k);
    }
  };
  walk(obj, '');
  return found;
}

// Formatea la respuesta de /live (partidos en juego).
function showLive(body) {
  const list = body.data || body.response || [];
  console.log(`\n=== Partidos EN VIVO (${body.live_count ?? list.length}) ===`);
  if (!list.length) { console.log('  (no hay partidos en juego ahora)'); return; }
  for (const m of list) {
    console.log(`\n  [${m.fixture_id}] ${m.home} ${m.score_home}-${m.score_away} ${m.away}  ·  ${m.minute}' · ${m.status}`);
    for (const g of (m.goals || [])) console.log(`     ${g.summary || `${g.min_str} ${g.player} (${g.team})`}`);
    for (const c of (m.cards || [])) console.log(`     🟨/🟥 ${c.min_str || ''} ${c.player || ''} (${c.team || ''})`);
  }
  console.log('\n  → detalle/stats de un partido:  --endpoint="<ruta de Live Match by ID>"');
}

try {
  if (args.live) {
    const body = await api('live');
    args.raw ? console.log(JSON.stringify(body, null, 2)) : showLive(body);
  } else if (args.match) {
    // Live Match by ID — ruta confirmada: /matches/{id}/live
    const body = await api(`matches/${args.match}/live`);
    if (args.raw) console.log(JSON.stringify(body, null, 2));
    else { console.log(`\n=== Detalle en vivo — fixture ${args.match} ===`); pretty(body); }
    if (args.xg) {
      const xg = tryXg(body);
      console.log('\n  --- xG estimado (heurístico desde tiros) ---');
      if (!xg.length) console.log('  (no encontré estadísticas de tiros en la respuesta)');
      else xg.forEach(x => console.log(`  ${x.label || 'equipo'}: xG≈${x.xg}  (a puerta ${x.onG}, totales ${x.tot})`));
    }
  } else if (args.discover) {
    console.log(`\n=== Sondeo del host ${HOST} (raíz "/") ===`);
    const body = await api('/');
    pretty(body);
    console.log('\n  → Usá la ruta real con: --endpoint="/<ruta>?<params>"');
  } else if (args.endpoint) {
    const body = await api(args.endpoint);
    if (args.raw) {
      console.log(JSON.stringify(body, null, 2));
    } else {
      console.log(`\n=== ${args.endpoint} ===`);
      pretty(body);
    }
    if (args.xg) {
      const xg = tryXg(body);
      console.log('\n  --- xG estimado (heurístico desde tiros) ---');
      if (!xg.length) console.log('  (no encontré estadísticas de tiros en la respuesta)');
      else xg.forEach(x => console.log(`  ${x.label || 'equipo'}: xG≈${x.xg}  (a puerta ${x.onG}, totales ${x.tot})`));
    }
  } else {
    console.log('Uso:');
    console.log('  --live                          partidos en juego ahora (endpoint /live)');
    console.log('  --match=<id> [--xg]             detalle en vivo de un partido (/matches/<id>/live)');
    console.log('  --discover                      sondea la raíz del host');
    console.log('  --endpoint="/ruta?params"       GET genérico (legible)');
    console.log('  --endpoint="/ruta" --raw        JSON crudo');
    console.log('  --endpoint="/ruta" --xg         + xG estimado desde tiros');
    console.log(`\n  Host actual: ${HOST}  (override con RAPIDAPI_HOST)`);
  }
} catch (e) {
  console.error('❌ ' + e.message);
  process.exitCode = 1;
}
