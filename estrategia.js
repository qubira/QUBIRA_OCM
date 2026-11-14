'use strict';

/* ============================================================
   OCM · Estrategia (estadística del contenido) e Informe ejecutivo
   Usa utilidades de index.html y de analisis.js.
   ============================================================ */

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const diaLima = d => new Date(new Date(d).toLocaleString('en-US', { timeZone: 'America/Lima' })).getDay();
const nHashtags = t => ((t || '').match(/#[\p{L}\p{N}_]+/gu) || []).length;
const nEmojis = t => ((t || '').match(/\p{Extended_Pictographic}/gu) || []).length;
const largoTitulo = t => (t || '').replace(/#[\p{L}\p{N}_]+/gu, '').trim().length;

function pearson(xs, ys) {
  const n = xs.length; if (n < 3) return 0;
  const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let num_ = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num_ += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  return dx && dy ? num_ / Math.sqrt(dx * dy) : 0;
}
const fuerza = r => { const a = Math.abs(r); return a >= 0.5 ? 'fuerte' : a >= 0.3 ? 'moderada' : a >= 0.1 ? 'débil' : 'nula'; };

// ─── Estrategia ─────────────────────────────────────────────────────────────
function vEstrategia() {
  const v = estado.datos.videos.filter(x => x.publicado_en);
  if (v.length < 3) return '<section class="card panel"><p class="vacio">Se necesitan al menos 3 videos para el análisis estadístico.</p></section>';
  const vistas = v.map(x => Math.log10(+x.vistas + 1)); // escala logarítmica: unos pocos virales no distorsionan

  // Mapa de calor día × franja horaria
  const franjas = [[0, 6, 'Madrugada'], [6, 10, 'Mañana'], [10, 14, 'Mediodía'], [14, 18, 'Tarde'], [18, 21, 'Noche'], [21, 24, 'Noche tarde']];
  const celda = {};
  v.forEach(x => { const d = diaLima(x.publicado_en), h = horaLima(x.publicado_en), f = franjas.findIndex(([a, b]) => h >= a && h < b); const k = d + '-' + f; celda[k] = celda[k] || { n: 0, s: 0 }; celda[k].n++; celda[k].s += +x.vistas; });
  const maxC = Math.max(...Object.values(celda).map(c => c.s / c.n), 1);
  const mejorCelda = Object.entries(celda).sort((a, b) => b[1].s / b[1].n - a[1].s / a[1].n)[0];

  // Factores
  const factores = [
    ['Duración del video', v.map(x => +x.duracion || 0)],
    ['Número de hashtags', v.map(x => nHashtags(x.titulo))],
    ['Largo del texto', v.map(x => largoTitulo(x.titulo))],
    ['Cantidad de emojis', v.map(x => nEmojis(x.titulo))],
    ['Hora de publicación', v.map(x => horaLima(x.publicado_en))],
  ].map(([n, xs]) => ({ n, r: pearson(xs, vistas) })).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  // Dispersión duración vs vistas
  const pts = v.filter(x => +x.duracion).map(x => ({ x: +x.duracion, y: +x.vistas, t: x.titulo, id: x.video_id }));
  const W = 560, H = 230, P = 38;
  const maxX = Math.max(...pts.map(p => p.x), 1), maxY = Math.max(...pts.map(p => Math.log10(p.y + 1)), 1);
  const sx = x => P + x / maxX * (W - 2 * P), sy = y => H - P - Math.log10(y + 1) / maxY * (H - 2 * P);
  const rDur = pearson(pts.map(p => p.x), pts.map(p => Math.log10(p.y + 1)));

  // Palabras clave (sin hashtags ni palabras vacías)
  const vacias = new Set('de la el en y a los las un una para con tu tus que por del al es se lo mas más nuestro nuestra te ti su sus o como desde qubira'.split(' '));
  /* Cada palabra se mide contra la mediana de vistas de la cuenta. Se cuentan títulos distintos
     (dos videos con el mismo texto cuentan como uno) y las palabras que aparecen siempre juntas
     en los mismos videos se agrupan en una sola fila. */
  const pal = {}, medianaV = mediana(v.map(x => +x.vistas)) || 1;
  v.forEach(x => {
    const ws = new Set((x.titulo || '').toLowerCase().replace(/#[\p{L}\p{N}_]+/gu, ' ').match(/\p{L}{4,}/gu) || []);
    const firma = (x.titulo || '').toLowerCase().replace(/\s+/g, ' ').trim();
    ws.forEach(w => { if (vacias.has(w)) return; const p = pal[w] = pal[w] || { w, ids: [], titulos: new Set(), s: 0 }; p.ids.push(x.video_id); p.titulos.add(firma); p.s += +x.vistas; });
  });
  const grupos = {};
  Object.values(pal).filter(p => p.titulos.size >= 2).forEach(p => {
    const k = p.ids.slice().sort().join(',');
    (grupos[k] = grupos[k] || { ws: [], n: p.ids.length, t: p.titulos.size, m: p.s / p.ids.length }).ws.push(p.w);
  });
  const palabras = Object.values(grupos).map(g => ({ ...g, x: g.m / medianaV })).sort((a, b) => b.x - a.x).slice(0, 10);

  // Por mes
  const meses = {};
  v.forEach(x => { const k = x.publicado_en.slice(0, 7); meses[k] = meses[k] || { n: 0, s: 0, i: 0 }; meses[k].n++; meses[k].s += +x.vistas; meses[k].i += +x.likes + +x.comentarios + +x.compartidos; });

  // Atípicos (z-score sobre log de vistas)
  const mu = vistas.reduce((a, b) => a + b) / vistas.length, sd = Math.sqrt(vistas.reduce((a, b) => a + (b - mu) ** 2, 0) / vistas.length) || 1;
  const atipicos = v.map((x, i) => ({ x, z: (vistas[i] - mu) / sd })).filter(o => Math.abs(o.z) >= 1.5).sort((a, b) => b.z - a.z);

  // Calidad de la interacción
  const t = metricas().t;
  const calidad = [
    ['Viralidad', 'compartidos por cada 100 likes', t.likes ? t.sh / t.likes * 100 : 0, 10],
    ['Conversación', 'comentarios por cada 100 likes', t.likes ? t.com / t.likes * 100 : 0, 10],
    ['Aprobación', 'likes por cada 100 vistas', t.vistas ? t.likes / t.vistas * 100 : 0, 5],
  ];

  return `
    <section class="grid" style="grid-template-columns:1fr">
      ${mapaCuando(v, franjas)}
    </section>

    <section class="grid g21">
      ${graficoDuracion(v)}
      ${typeof tarjetaInfluye === 'function' ? tarjetaInfluye(v) : ''}
    </section>

    <section class="grid" style="grid-template-columns:1fr">
      ${typeof tarjetaCalidad === 'function' ? tarjetaCalidad(v) : ''}
    </section>

    <section class="grid g2">
      <div class="card panel"><div class="sec-title">Palabras que atraen vistas</div>
        <p class="sub" style="font-size:12px;margin:-4px 0 10px">Cuántas veces más (o menos) vistas consiguen los videos que usan la palabra, comparado con un video típico de la cuenta (${num(Math.round(medianaV))} vistas). <b>1.0×</b> = igual que lo normal.</p>
        ${palabras.length ? barras(palabras.map(p => ({ l: `${p.ws.slice(0, 3).join(', ')}${p.ws.length > 3 ? ' +' + (p.ws.length - 3) : ''} · ${p.n} videos`, v: +p.x.toFixed(2), c: p.x >= 1 ? '#059669' : '#d97706' })), x => x.toFixed(1) + '×') : '<p class="vacio">Aún no hay palabras usadas en al menos 2 títulos distintos.</p>'}</div>
      <div class="card panel"><div class="sec-title">Rendimiento por mes de publicación</div>
        <div class="scroll"><table><thead><tr><th>Mes</th><th>Videos</th><th>Vistas medias</th><th>Interacción</th></tr></thead><tbody>
          ${Object.entries(meses).sort().reverse().map(([k, o]) => `<tr><td>${new Date(k + '-15').toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}</td><td>${o.n}</td><td><b>${num(Math.round(o.s / o.n))}</b></td><td class="eng">${fpct(pct(o.i, o.s))}</td></tr>`).join('')}
        </tbody></table></div></div>
    </section>

    <section class="grid g2">
      <div class="card panel"><div class="sec-title">Videos atípicos <small>se salieron de lo normal (z ≥ 1,5)</small></div>
        ${atipicos.length ? `<div class="top-list">${atipicos.slice(0, 6).map(o => `<a class="top-item" href="#" data-video="${esc(o.x.video_id)}"><span class="rank" style="background:${o.z > 0 ? '#ecfdf5' : '#fef2f2'};color:${o.z > 0 ? '#059669' : '#dc2626'}">${o.z > 0 ? '▲' : '▼'}</span>
          ${o.x.portada ? `<img class="cover" src="${esc(o.x.portada)}" alt="">` : '<span class="cover"></span>'}<div style="min-width:0"><div class="tt">${esc(o.x.titulo || 'Sin título')}</div><div class="mm">${num(o.x.vistas)} vistas · ${o.z > 0 ? 'muy por encima' : 'muy por debajo'} de lo habitual (z ${o.z.toFixed(1)})</div></div></a>`).join('')}</div>`
          : '<p class="vacio">Todos los videos rinden dentro de lo esperado.</p>'}</div>
      <div class="card panel"><div class="sec-title">Simulador de un próximo video <small>estimación según tu historial</small></div>
        <div class="sim">
          <label>Día<select id="sim-dia">${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}">${DIAS_CORTOS[d]}</option>`).join('')}</select></label>
          <label>Hora<select id="sim-hora">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === 19 ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}</select></label>
          <label>Duración (s)<input id="sim-dur" type="number" min="5" max="600" value="30"></label>
          <label>Hashtags<input id="sim-tags" type="number" min="0" max="30" value="5"></label>
        </div>
        <div id="sim-res" class="sim-res"></div></div>
    </section>`;
}

// Estimación: vistas medianas ajustadas por cómo rinden el día, la hora, la duración y los hashtags elegidos
function simular() {
  const v = estado.datos.videos.filter(x => x.publicado_en);
  const out = document.getElementById('sim-res'); if (!out || v.length < 3) return;
  const d = +document.getElementById('sim-dia').value, h = +document.getElementById('sim-hora').value;
  const dur = +document.getElementById('sim-dur').value || 30, tags = +document.getElementById('sim-tags').value || 0;
  const base = mediana(v.map(x => +x.vistas)) || 1;
  const factor = filtro => { const s = v.filter(filtro); return s.length >= 2 ? Math.min(3, Math.max(0.33, mediana(s.map(x => +x.vistas)) / base)) : 1; };
  const fDia = factor(x => diaLima(x.publicado_en) === d);
  const fHora = factor(x => Math.abs(horaLima(x.publicado_en) - h) <= 2);
  const fDur = factor(x => +x.duracion && Math.abs(+x.duracion - dur) <= Math.max(10, dur * 0.3));
  const fTag = factor(x => Math.abs(nHashtags(x.titulo) - tags) <= 2);
  const est = base * Math.pow(fDia * fHora * fDur * fTag, 0.6); // atenuado para no exagerar con pocos datos
  const lineas = [['Día', fDia], ['Hora', fHora], ['Duración', fDur], ['Hashtags', fTag]];
  out.innerHTML = `<div class="sim-num">${num(Math.round(est))}<small> vistas esperadas</small></div>
    <p class="sub">Rango probable: ${num(Math.round(est * 0.5))} – ${num(Math.round(est * 1.8))} · base: tu mediana de ${num(Math.round(base))} vistas</p>
    <div class="sim-factores">${lineas.map(([n, f]) => `<span class="chip ${f >= 1.05 ? 'ok' : f <= 0.95 ? 'err' : ''}">${n} ${f >= 1 ? '×' : '×'}${f.toFixed(2)}</span>`).join(' ')}</div>`;
}

// ─── Informe ejecutivo ──────────────────────────────────────────────────────
const METAS_BASE = { seguidores: 1000, vistasMes: 50000, videosSemana: 3 };
const leerMetas = () => { try { return { ...METAS_BASE, ...JSON.parse(localStorage.getItem('ocm_metas') || '{}') }; } catch { return { ...METAS_BASE }; } };
let periodoInforme = 30;

function resumenPeriodo(dias, desplazamiento = 0) {
  const ini = Date.now() - (dias + desplazamiento) * 864e5, fin = Date.now() - desplazamiento * 864e5;
  const v = estado.datos.videos.filter(x => x.publicado_en && new Date(x.publicado_en) >= ini && new Date(x.publicado_en) < fin);
  const h = estado.datos.historial;
  const en = t => { const lim = new Date(t).toISOString().slice(0, 10); return [...h].reverse().find(x => x.fecha <= lim); };
  const a = en(ini), b = en(fin);
  return {
    videos: v.length, vistas: v.reduce((s, x) => s + +x.vistas, 0), likes: v.reduce((s, x) => s + +x.likes, 0),
    inter: v.reduce((s, x) => s + +x.likes + +x.comentarios + +x.compartidos, 0),
    seguidores: a && b ? +b.seguidores - +a.seguidores : null, mejor: [...v].sort((x, y) => y.vistas - x.vistas)[0],
  };
}

function anillo(valor, meta, color, titulo, detalle) {
  const p = Math.max(0, Math.min(1, meta ? valor / meta : 0)), R = 34, C = 2 * Math.PI * R;
  return `<div class="anillo"><svg viewBox="0 0 84 84" width="96" height="96"><circle cx="42" cy="42" r="${R}" fill="none" stroke="#f0f0f3" stroke-width="9"/>
    <circle cx="42" cy="42" r="${R}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 42 42)"/>
    <text x="42" y="47" text-anchor="middle" font-size="16" font-weight="800" fill="#111827">${Math.round(p * 100)}%</text></svg>
    <div><b>${titulo}</b><p class="sub">${detalle}</p></div></div>`;
}

function vInforme() {
  const act = resumenPeriodo(periodoInforme), ant = resumenPeriodo(periodoInforme, periodoInforme);
  const metas = leerMetas(), ult = estado.datos.historial.at(-1) || {};
  const proy = proyectar('seguidores');
  const faltan = metas.seguidores - (+ult.seguidores || 0);
  const eta = proy && proy.porDia > 0 && faltan > 0 ? new Date(Date.now() + faltan / proy.porDia * 864e5) : null;
  const mes = resumenPeriodo(30), semanas = resumenPeriodo(28).videos / 4;
  const cambio = (a, b) => b ? `${a >= b ? '▲' : '▼'} ${Math.abs((a - b) / b * 100).toFixed(0)} %` : 'nuevo';
  const kpiP = (t, a, b, id, c) => kpi(t, num(a ?? 0), `<div class="delta ${a >= (b ?? 0) ? 'up' : 'down'}">${cambio(a ?? 0, b ?? 0)} vs. periodo anterior (${num(b ?? 0)})</div>`, id, c);
  const tasaA = pct(act.inter, act.vistas), tasaB = pct(ant.inter, ant.vistas);
  const texto = [
    `Resumen de TikTok de QUBIRA de los últimos ${periodoInforme} días (al ${new Date().toLocaleDateString('es-PE')}).`,
    `Se publicaron ${act.videos} video(s) (${ant.videos} en el periodo anterior), que suman ${num(act.vistas)} vistas y ${num(act.inter)} interacciones, con una tasa de interacción de ${tasaA.toFixed(1)} % (antes ${tasaB.toFixed(1)} %).`,
    act.seguidores != null ? `La cuenta ${act.seguidores >= 0 ? 'ganó' : 'perdió'} ${num(Math.abs(act.seguidores))} seguidores y hoy tiene ${num(ult.seguidores)}.` : `La cuenta tiene ${num(ult.seguidores)} seguidores.`,
    act.mejor ? `El video con más alcance fue «${(act.mejor.titulo || '').replace(/\s+/g, ' ').slice(0, 80)}…», con ${num(act.mejor.vistas)} vistas.` : '',
    proy ? `Al ritmo actual (${proy.porDia >= 0 ? '+' : ''}${proy.porDia.toFixed(1)} seguidores por día) se proyectan unos ${num(proy.valor)} seguidores en 30 días.` : '',
  ].filter(Boolean).join(' ');

  return `
    <section class="card panel" style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div><b>Periodo del informe</b><p class="sub">Publicaciones del periodo comparadas con el periodo anterior de igual duración</p></div>
      <span class="seg" id="periodo-informe">${[7, 30, 90].map(d => `<button data-d="${d}" class="${periodoInforme === d ? 'on' : ''}">${d} días</button>`).join('')}</span>
    </section>
    <section class="grid g4">
      ${kpiP('Videos publicados', act.videos, ant.videos, 'i-video', '#4f46e5')}
      ${kpiP('Vistas de esos videos', act.vistas, ant.vistas, 'i-eye', '#0891b2')}
      ${kpiP('Interacciones', act.inter, ant.inter, 'i-heart', '#e11d48')}
      ${kpi('Seguidores ganados', act.seguidores == null ? '—' : (act.seguidores >= 0 ? '+' : '') + num(act.seguidores), `<div class="delta eq">${act.seguidores == null ? 'faltan días de histórico' : 'en el periodo'}</div>`, 'i-users', '#db2777')}
    </section>
    <section class="grid g21">
      <div class="card panel"><div class="sec-title">Resumen ejecutivo <button class="btn btn-sec" id="copiar-informe" style="padding:6px 12px">Copiar</button></div>
        <p id="texto-informe" style="line-height:1.7;font-size:14px">${esc(texto)}</p></div>
      <div class="card panel"><div class="sec-title">Metas <button class="btn btn-sec" id="editar-metas" style="padding:6px 12px">Editar</button></div>
        ${anillo(+ult.seguidores || 0, metas.seguidores, '#db2777', `${num(ult.seguidores || 0)} de ${num(metas.seguidores)} seguidores`, eta ? `Se alcanzaría hacia el ${eta.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}` : faltan <= 0 ? '¡Meta cumplida!' : 'Sin proyección suficiente')}
        ${anillo(mes.vistas, metas.vistasMes, '#0891b2', `${num(mes.vistas)} de ${num(metas.vistasMes)} vistas en 30 días`, 'Vistas de los videos publicados en el mes')}
        ${anillo(semanas, metas.videosSemana, '#4f46e5', `${semanas.toFixed(1)} de ${metas.videosSemana} videos por semana`, 'Promedio de las últimas 4 semanas')}</div>
    </section>`;
}

function enlazarEstrategia() {
  ['sim-dia', 'sim-hora', 'sim-dur', 'sim-tags'].forEach(id => document.getElementById(id)?.addEventListener('input', simular));
  simular();
  document.querySelectorAll('#periodo-informe button').forEach(b => b.onclick = () => { periodoInforme = +b.dataset.d; pintar(); });
  const copiar = document.getElementById('copiar-informe');
  if (copiar) copiar.onclick = () => navigator.clipboard.writeText(document.getElementById('texto-informe').innerText).then(() => toast('Resumen copiado')).catch(() => toast('No se pudo copiar', true));
  const editar = document.getElementById('editar-metas');
  if (editar) editar.onclick = () => {
    const m = leerMetas();
    const s = prompt('Meta de seguidores:', m.seguidores); if (s === null) return;
    const vm = prompt('Meta de vistas en 30 días:', m.vistasMes); if (vm === null) return;
    const vs = prompt('Meta de videos por semana:', m.videosSemana); if (vs === null) return;
    try { localStorage.setItem('ocm_metas', JSON.stringify({ seguidores: +s || m.seguidores, vistasMes: +vm || m.vistasMes, videosSemana: +vs || m.videosSemana })); } catch { /* sin almacenamiento */ }
    pintar();
  };
}

// ─── Comparador de videos (hasta 3 lado a lado) ─────────────────────────────
let comparar = [];
function vComparador() {
  const v = estado.datos.videos;
  if (!comparar.length) comparar = [...v].sort((a, b) => b.vistas - a.vistas).slice(0, 2).map(x => x.video_id);
  const sel = comparar.map(id => v.find(x => x.video_id === id)).filter(Boolean);
  const pts = puntajes();
  const filas = [
    ['Vistas', x => +x.vistas, num], ['Me gusta', x => +x.likes, num], ['Comentarios', x => +x.comentarios, num], ['Compartidos', x => +x.compartidos, num],
    ['Interacción %', x => tasaVideo(x), y => y.toFixed(2) + ' %'], ['Vistas por día', x => velocidad(x), y => num(Math.round(y))],
    ['Likes / 100 vistas', x => pct(+x.likes, +x.vistas), y => y.toFixed(2)], ['Compartidos / 1 000', x => +x.compartidos / (+x.vistas || 1) * 1000, y => y.toFixed(2)],
    ['Duración (s)', x => +x.duracion || 0, num], ['Hashtags', x => nHashtags(x.titulo), num], ['Puntaje', x => pts.get(x.video_id), num],
  ];
  const opciones = id => v.map(x => `<option value="${esc(x.video_id)}" ${x.video_id === id ? 'selected' : ''}>${esc((x.titulo || 'Sin título').replace(/\s+/g, ' ').slice(0, 60))} · ${corto(x.vistas)}</option>`).join('');
  return `
    <section class="card panel" style="margin-bottom:16px"><div class="sec-title">Elige hasta 3 videos</div>
      <div class="sim">${[0, 1, 2].map(i => `<label>Video ${i + 1}<select class="comp-sel" data-i="${i}"><option value="">—</option>${opciones(comparar[i])}</select></label>`).join('')}</div></section>
    ${sel.length ? `<section class="card panel"><div class="scroll"><table class="comp"><thead><tr><th>Métrica</th>${sel.map(x => `<th style="text-align:center"><a href="#" data-video="${esc(x.video_id)}">${x.portada ? `<img class="cover" src="${esc(x.portada)}" alt="" style="margin:0 auto 6px;display:block">` : ''}<span class="tt" style="font-size:11.5px;text-transform:none;letter-spacing:0">${esc((x.titulo || '').slice(0, 50))}</span></a></th>`).join('')}</tr></thead><tbody>
      ${filas.map(([n, f, fmt]) => { const vals = sel.map(f), max = Math.max(...vals); return `<tr><td>${n}</td>${vals.map(val => `<td style="text-align:center" class="${sel.length > 1 && val === max && max > 0 ? 'ganador' : ''}">${fmt(val)}</td>`).join('')}</tr>`; }).join('')}
    </tbody></table></div><p class="sub" style="margin-top:8px">Resaltado: el mejor valor de cada métrica.</p></section>` : '<p class="vacio">Elige al menos un video.</p>'}`;
}
function enlazarComparador() {
  document.querySelectorAll('.comp-sel').forEach(s => s.onchange = () => { comparar[+s.dataset.i] = s.value; comparar = comparar.filter((x, i, a) => x && a.indexOf(x) === i); pintar(); });
}

/* ─── Duración vs. vistas (detallado) ─────────────────────────────────────── */
function graficoDuracion(v) {
  const pts = v.filter(x => +x.duracion).map(x => {
    const inter = +x.likes + +x.comentarios + +x.compartidos;
    return { x: +x.duracion, y: +x.vistas, t: (x.titulo || 'Sin título').replace(/\*\*/g, ''), id: x.video_id, inter, tasa: +x.vistas ? inter / +x.vistas * 100 : 0, fecha: x.publicado_en };
  });
  const cab = '<div class="card panel"><div class="sec-title">Duración vs. vistas</div>';
  if (pts.length < 3) return cab + '<p class="vacio">Faltan duraciones para el gráfico.</p></div>';
  const med = mediana(pts.map(p => p.y)) || 1;
  const W = 640, H = 300, IZQ = 52, DER = 14, ARR = 16, ABA = 40;
  // Eje X: cada 10 s (o 15/30 s en videos largos)
  const maxXr = Math.max(...pts.map(p => p.x)), pasoX = maxXr > 180 ? 30 : maxXr > 90 ? 15 : 10;
  const maxX = Math.ceil((maxXr + 1) / pasoX) * pasoX;
  // Eje Y logarítmico con marcas 1-2-5
  const ys = pts.map(p => Math.max(1, p.y)), lo = Math.max(1, Math.min(...ys) / 1.6), hi = Math.max(...ys) * 1.4;
  const marcas = [];
  for (let e = 0; e <= 7; e++) for (const m of [1, 2, 5]) { const val = m * 10 ** e; if (val >= lo && val <= hi) marcas.push(val); }
  const L = Math.log10;
  const sx = x => IZQ + x / maxX * (W - IZQ - DER);
  const sy = y => ARR + (1 - (L(Math.max(1, y)) - L(lo)) / (L(hi) - L(lo))) * (H - ARR - ABA);
  // Tendencia: regresión lineal sobre log(vistas)
  const n = pts.length, mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + L(Math.max(1, p.y)), 0) / n;
  const b = pts.reduce((a, p) => a + (p.x - mx) * (L(Math.max(1, p.y)) - my), 0) / (pts.reduce((a, p) => a + (p.x - mx) ** 2, 0) || 1);
  const yT = x => 10 ** (my + b * (x - mx));
  const r = pearson(pts.map(p => p.x), pts.map(p => L(p.y + 1)));
  const maxInter = Math.max(1, ...pts.map(p => p.inter));
  const fuerzaR = Math.abs(r) < 0.2 ? 'casi no influye' : Math.abs(r) < 0.5 ? (r > 0 ? 'influye un poco: los más largos tienden a tener más vistas' : 'influye un poco: los más cortos tienden a tener más vistas') : (r > 0 ? 'influye bastante: los más largos consiguen más vistas' : 'influye bastante: los más cortos consiguen más vistas');
  const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Duración contra vistas" class="g-svg">
    ${marcas.map(m => `<line x1="${IZQ}" x2="${W - DER}" y1="${sy(m)}" y2="${sy(m)}" stroke="#f1f5f9"/><text x="${IZQ - 6}" y="${sy(m) + 3.5}" font-size="10" fill="#9ca3af" text-anchor="end">${num(m)}</text>`).join('')}
    ${Array.from({ length: maxX / pasoX + 1 }, (_, i) => i * pasoX).map(xv => `<line x1="${sx(xv)}" x2="${sx(xv)}" y1="${ARR}" y2="${H - ABA}" stroke="#f8fafc"/><text x="${sx(xv)}" y="${H - ABA + 16}" font-size="10" fill="#6b7280" text-anchor="middle">${xv} s</text>`).join('')}
    <line x1="${IZQ}" x2="${W - DER}" y1="${H - ABA}" y2="${H - ABA}" stroke="#e5e7eb"/><line x1="${IZQ}" x2="${IZQ}" y1="${ARR}" y2="${H - ABA}" stroke="#e5e7eb"/>
    <text x="${(IZQ + W - DER) / 2}" y="${H - 6}" font-size="10.5" fill="#6b7280" text-anchor="middle" font-weight="600">Duración del video</text>
    <text x="12" y="${(ARR + H - ABA) / 2}" font-size="10.5" fill="#6b7280" text-anchor="middle" font-weight="600" transform="rotate(-90 12 ${(ARR + H - ABA) / 2})">Vistas</text>
    <line x1="${IZQ}" x2="${W - DER}" y1="${sy(med)}" y2="${sy(med)}" stroke="#94a3b8" stroke-dasharray="5 4"/>
    <text x="${W - DER - 4}" y="${sy(med) - 5}" font-size="10" fill="#64748b" text-anchor="end">mediana ${num(Math.round(med))} vistas</text>
    <line x1="${sx(0)}" x2="${sx(maxX)}" y1="${sy(yT(0))}" y2="${sy(yT(maxX))}" stroke="#7c3aed" stroke-width="1.5" stroke-dasharray="2 3" opacity=".7"/>
    ${pts.sort((a, c) => c.inter - a.inter).map(p => { const arriba = p.y >= med, rad = 5 + 7 * Math.sqrt(p.inter / maxInter);
      return `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="${rad.toFixed(1)}" fill="${arriba ? '#10b981' : '#f59e0b'}" fill-opacity=".55" stroke="${arriba ? '#059669' : '#d97706'}" stroke-width="1.5" data-video="${esc(p.id)}" style="cursor:pointer"><title>${esc(p.t.slice(0, 70))}\n${p.x} s · ${num(p.y)} vistas (${(p.y / med).toFixed(1)}× la mediana)\n${num(p.inter)} interacciones · ${p.tasa.toFixed(2)} %${p.fecha ? '\nPublicado ' + new Date(p.fecha).toLocaleDateString('es-PE') : ''}\n(clic para abrir la ficha)</title></circle>`; }).join('')}
  </svg>`;
  // Rangos de duración
  const rangos = [[0, 15, '0–15 s'], [15, 30, '15–30 s'], [30, 45, '30–45 s'], [45, 60, '45–60 s'], [60, 90, '1–1.5 min'], [90, 180, '1.5–3 min'], [180, 1e9, '+3 min']];
  const filas = rangos.map(([a, z, et]) => { const g = pts.filter(p => p.x >= a && p.x < z); if (!g.length) return null;
    const vis = g.reduce((s2, p) => s2 + p.y, 0), it = g.reduce((s2, p) => s2 + p.inter, 0);
    return { et, n: g.length, med: mediana(g.map(p => p.y)), tasa: vis ? it / vis * 100 : 0, sobre: g.filter(p => p.y >= med).length }; }).filter(Boolean);
  const mejor = filas.filter(f2 => f2.n >= 2).sort((a, c) => c.med - a.med)[0] || filas.sort((a, c) => c.med - a.med)[0];
  const maxMed = Math.max(1, ...filas.map(f2 => f2.med));
  const tabla = `<div class="scroll" style="margin-top:12px"><table class="dur-tabla"><thead><tr><th>Duración</th><th>Videos</th><th>Vistas medianas</th><th></th><th>Sobre la mediana</th><th>Interacción</th></tr></thead><tbody>
    ${filas.map(f2 => `<tr class="${f2 === mejor ? 'dur-mejor' : ''}"><td><b>${f2.et}</b>${f2 === mejor ? ' <span class="st-tag">mejor</span>' : ''}</td><td>${f2.n}</td><td><b>${num(Math.round(f2.med))}</b></td>
      <td style="min-width:110px"><div class="st-barra"><i style="width:${(f2.med / maxMed * 100).toFixed(1)}%;background:${f2 === mejor ? '#10b981' : '#a5b4fc'}"></i></div></td>
      <td>${f2.sobre} de ${f2.n}</td><td>${f2.tasa.toFixed(2)} %</td></tr>`).join('')}
  </tbody></table></div>`;
  return `<div class="card panel"><div class="sec-title">Duración vs. vistas <small>${pts.length} videos · escala logarítmica</small></div>
    ${svg}
    <p class="sub" style="font-size:12px"><span style="color:#10b981">●</span> sobre la mediana · <span style="color:#f59e0b">●</span> bajo la mediana · el tamaño del punto es la interacción · <span style="color:#7c3aed">┄</span> tendencia · toca un punto para abrir el video.</p>
    <div class="insight" style="margin-top:10px"><span class="e">⏱</span><div><b>${mejor ? `Tu mejor duración: ${mejor.et}` : 'Duración'}</b><p>${mejor ? `Esos videos logran una mediana de ${num(Math.round(mejor.med))} vistas (${(mejor.med / med).toFixed(1)}× lo normal de la cuenta). ` : ''}La duración ${fuerzaR} (r = ${r.toFixed(2)}).</p></div></div>
    ${tabla}
  </div>`;
}

/* ─── ¿Cuándo publicar? (detallado) ───────────────────────────────────────── */
function mapaCuando(v, franjas) {
  const vs = v.filter(x => x.publicado_en);
  const celda = {}, porDia = {}, porFr = {};
  const suma = (o, x) => { o.n++; o.s += +x.vistas; o.i += +x.likes + +x.comentarios + +x.compartidos; o.vids.push(x); };
  const nuevo = () => ({ n: 0, s: 0, i: 0, vids: [] });
  vs.forEach(x => {
    const d = diaLima(x.publicado_en), h = horaLima(x.publicado_en), fr = franjas.findIndex(([a, b]) => h >= a && h < b);
    suma(celda[d + '-' + fr] ||= nuevo(), x); suma(porDia[d] ||= nuevo(), x); suma(porFr[fr] ||= nuevo(), x);
  });
  const media = c => (c && c.n ? c.s / c.n : 0), tasa = c => (c && c.s ? c.i / c.s * 100 : 0);
  const medCuenta = mediana(vs.map(x => +x.vistas)) || 1;
  const valores = Object.values(celda).map(media), maxC = Math.max(1, ...valores), minC = Math.min(...valores);
  const color = m => `rgba(219,39,119,${(0.12 + 0.88 * m / maxC).toFixed(2)})`;
  const tit = x => (x.titulo || 'Sin título').replace(/\*\*/g, '').replace(/"/g, "'").slice(0, 50);
  const orden = [1, 2, 3, 4, 5, 6, 0];
  const fila = d => `<tr><td class="cu-dia"><b>${DIAS_CORTOS[d]}</b></td>${franjas.map((_, fr) => {
      const c = celda[d + '-' + fr], m = media(c);
      if (!c) return '<td class="cu-vacia">—</td>';
      const tip = `${DIAS_CORTOS[d]} · ${franjas[fr][2]}\n${c.n} video(s) · ${num(Math.round(m))} vistas medias · ${tasa(c).toFixed(1)} % interacción\n${c.vids.map(x => '• ' + tit(x) + ' — ' + num(+x.vistas)).join('\n')}`;
      return `<td class="cu-celda" style="background:${color(m)};color:${m / maxC > 0.5 ? '#fff' : '#111827'}" title="${esc(tip)}"><b>${num(Math.round(m))}</b><small>${c.n} video${c.n > 1 ? 's' : ''} · ${tasa(c).toFixed(1)} %</small>${m >= medCuenta * 2 ? '<i>🔥</i>' : ''}</td>`;
    }).join('')}<td class="cu-tot"><b>${porDia[d] ? num(Math.round(media(porDia[d]))) : '—'}</b><small>${porDia[d] ? porDia[d].n + ' videos' : ''}</small></td></tr>`;
  // Mejores combinaciones (se priorizan las que tienen 2 o más videos: son más fiables)
  const combos = Object.entries(celda).map(([k, c]) => ({ d: +k.split('-')[0], fr: +k.split('-')[1], c, m: media(c) }))
    .sort((a, b) => (b.c.n >= 2) - (a.c.n >= 2) || b.m - a.m);
  const top = combos.slice(0, 3);
  const mejorDia = orden.filter(d => porDia[d]).sort((a, b) => media(porDia[b]) - media(porDia[a]))[0];
  const mejorFr = franjas.map((_, i) => i).filter(i => porFr[i]).sort((a, b) => media(porFr[b]) - media(porFr[a]))[0];
  const probadas = Object.keys(celda).length, total = 7 * franjas.length;
  return `<div class="card panel" style="grid-column:1/-1"><div class="sec-title">¿Cuándo publicar? <small>vistas medias por día y franja · hora de Lima · ${vs.length} videos</small></div>
    <div class="scroll"><table class="cu-tabla"><thead><tr><th></th>${franjas.map(([a, b, n]) => `<th>${n}<small>${a}–${b} h</small></th>`).join('')}<th class="cu-tot">Por día</th></tr></thead><tbody>
      ${orden.map(fila).join('')}
      <tr class="cu-pie"><td class="cu-dia"><b>Por franja</b></td>${franjas.map((_, fr) => `<td><b>${porFr[fr] ? num(Math.round(media(porFr[fr]))) : '—'}</b><small>${porFr[fr] ? porFr[fr].n + ' videos · ' + tasa(porFr[fr]).toFixed(1) + ' %' : ''}</small></td>`).join('')}<td class="cu-tot"><b>${num(Math.round(medCuenta))}</b><small>mediana</small></td></tr>
    </tbody></table></div>
    <div class="cu-leyenda"><span>${num(Math.round(minC || 0))}</span><i></i><span>${num(Math.round(maxC))} vistas medias</span><span class="sub">· en cada casilla: vistas medias, videos y % de interacción · 🔥 = más del doble de la mediana · pasa el mouse para ver los videos</span></div>
    <div class="cu-insights">
      <div><small>🏆 Mejores momentos</small>${top.map((t, i) => `<p><b>${i + 1}. ${DIAS_CORTOS[t.d]} · ${franjas[t.fr][2]}</b> <span class="sub">(${franjas[t.fr][0]}–${franjas[t.fr][1]} h)</span> — ${num(Math.round(t.m))} vistas medias ${t.c.n < 2 ? '<span class="cu-aviso">1 solo video</span>' : `<span class="sub">en ${t.c.n} videos</span>`}</p>`).join('')}</div>
      <div><small>📅 Mejor día</small><p><b>${mejorDia != null ? DIAS_CORTOS[mejorDia] : '—'}</b> ${mejorDia != null ? `— ${num(Math.round(media(porDia[mejorDia])))} vistas medias (${(media(porDia[mejorDia]) / medCuenta).toFixed(1)}× la mediana)` : ''}</p>
        <small style="margin-top:8px">🕘 Mejor franja</small><p><b>${mejorFr != null ? franjas[mejorFr][2] + ' (' + franjas[mejorFr][0] + '–' + franjas[mejorFr][1] + ' h)' : '—'}</b> ${mejorFr != null ? `— ${num(Math.round(media(porFr[mejorFr])))} vistas medias` : ''}</p></div>
      <div><small>🧪 Por probar</small><p>Has publicado en <b>${probadas} de ${total}</b> combinaciones de día y franja. ${probadas < total / 2 ? 'Prueba nuevos horarios para descubrir mejores momentos.' : 'Ya cubres buena parte de la semana.'}</p>
        <p class="sub" style="font-size:11.5px">Las combinaciones con un solo video son poco fiables: repítelas para confirmar.</p></div>
    </div>
  </div>`;
}
