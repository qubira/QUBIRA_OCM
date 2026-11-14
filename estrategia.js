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
    <section class="grid g2">
      <div class="card panel"><div class="sec-title">¿Cuándo publicar? <small>vistas medias por día y franja (Lima)</small></div>
        <div class="scroll"><table class="calor"><thead><tr><th></th>${franjas.map(f => `<th>${f[2]}</th>`).join('')}</tr></thead><tbody>
          ${[1, 2, 3, 4, 5, 6, 0].map(d => `<tr><td><b>${DIAS_CORTOS[d]}</b></td>${franjas.map((_, f) => { const c = celda[d + '-' + f]; const m = c ? c.s / c.n : 0;
            return `<td title="${c ? `${c.n} video(s) · ${num(Math.round(m))} vistas medias` : 'Sin publicaciones'}" style="background:${c ? `rgba(219,39,119,${(0.12 + 0.88 * m / maxC).toFixed(2)})` : '#f9fafb'};color:${c && m / maxC > 0.55 ? '#fff' : '#111827'}">${c ? corto(m) : ''}</td>`; }).join('')}</tr>`).join('')}
        </tbody></table></div>
        ${mejorCelda ? `<p class="sub" style="margin-top:10px">Mejor combinación: <b>${DIAS_CORTOS[+mejorCelda[0].split('-')[0]]} · ${franjas[+mejorCelda[0].split('-')[1]][2]}</b> (${num(Math.round(mejorCelda[1].s / mejorCelda[1].n))} vistas medias en ${mejorCelda[1].n} video(s)).</p>` : ''}</div>
      <div class="card panel"><div class="sec-title">¿Qué influye en las vistas? <small>correlación con las vistas (−1 a 1)</small></div>
        <div class="bars">${factores.map(f => `<div class="bar-row" style="grid-template-columns:150px 1fr 120px"><span class="lbl">${f.n}</span>
          <div class="track" style="position:relative"><div class="fill" style="position:absolute;left:${f.r < 0 ? 50 + f.r * 50 : 50}%;width:${Math.abs(f.r) * 50}%;--c:${f.r >= 0 ? '#059669' : '#dc2626'}"></div><div style="position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:#9ca3af"></div></div>
          <span class="val" style="font-weight:600">${f.r >= 0 ? '+' : ''}${f.r.toFixed(2)} · ${fuerza(f.r)}</span></div>`).join('')}</div>
        <p class="sub" style="margin-top:10px">${factores[0] && Math.abs(factores[0].r) >= 0.3 ? `El factor con más relación es <b>${factores[0].n.toLowerCase()}</b>: ${factores[0].r > 0 ? 'a más, más vistas' : 'a más, menos vistas'}.` : 'Ningún factor explica por sí solo las vistas; el contenido pesa más que el formato.'} Correlación no implica causa: úsalo como pista para probar.</p></div>
    </section>

    <section class="grid g21">
      <div class="card panel"><div class="sec-title">Duración vs. vistas <small>escala logarítmica · r = ${rDur.toFixed(2)}</small></div>
        ${pts.length >= 3 ? `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Dispersión de duración contra vistas">
          ${[0, .5, 1].map(k => `<line x1="${P}" x2="${W - P}" y1="${P + k * (H - 2 * P)}" y2="${P + k * (H - 2 * P)}" stroke="#f0f0f3"/>`).join('')}
          ${pts.map(p => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="6" fill="#db2777" fill-opacity=".55" stroke="#db2777" data-video="${esc(p.id)}" style="cursor:pointer"><title>${esc((p.t || '').slice(0, 60))} · ${p.x} s · ${num(p.y)} vistas</title></circle>`).join('')}
          <text x="${P}" y="${H - 10}" font-size="11" fill="#9ca3af">0 s</text><text x="${W - P}" y="${H - 10}" font-size="11" fill="#9ca3af" text-anchor="end">${maxX} s</text>
          <text x="6" y="${P + 4}" font-size="11" fill="#9ca3af">${corto(10 ** maxY)}</text>
        </svg>` : '<p class="vacio">Faltan duraciones para el gráfico.</p>'}</div>
      <div class="card panel"><div class="sec-title">Calidad de la interacción</div>
        ${calidad.map(([n, d, val, ref]) => `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:13px"><b>${n}</b><b>${val.toFixed(1)}</b></div>
          <div class="track" style="margin:6px 0"><div class="fill" style="width:${Math.min(100, val / ref * 100)}%;--c:${val >= ref * 0.6 ? '#059669' : val >= ref * 0.3 ? '#d97706' : '#dc2626'}"></div></div>
          <small class="sub">${d} · referencia sana ≈ ${ref}</small></div>`).join('')}</div>
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
