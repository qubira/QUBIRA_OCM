'use strict';

/* ============================================================
   OCM · Análisis avanzado de TikTok
   Usa el estado y las utilidades de index.html (estado, esc, num, corto,
   fpct, pct, kpi, barras, ico, fecha, fdia, tasaVideo, metricas).
   ============================================================ */

const diasDesde = d => Math.max(1, (Date.now() - new Date(d)) / 864e5);
const horaLima = d => Number(new Date(d).toLocaleString('en-US', { timeZone: 'America/Lima', hour: '2-digit', hour12: false })) % 24;
const velocidad = v => v.publicado_en ? Number(v.vistas) / diasDesde(v.publicado_en) : 0;
const mediana = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

// Puntaje 0–100: posición del video combinando vistas e interacciones (los compartidos pesan más)
function puntajes() {
  const v = estado.datos.videos;
  const valor = x => Number(x.vistas) + Number(x.likes) * 10 + Number(x.comentarios) * 20 + Number(x.compartidos) * 30;
  const orden = [...v].sort((a, b) => valor(a) - valor(b));
  const mapa = new Map();
  orden.forEach((x, i) => mapa.set(x.video_id, v.length > 1 ? Math.round(i / (v.length - 1) * 100) : 100));
  return mapa;
}
const categoria = p => p >= 75 ? ['Estrella', '#db2777'] : p >= 40 ? ['Sólido', '#0891b2'] : ['Bajo', '#9ca3af'];

function hashtags() {
  const m = {};
  estado.datos.videos.forEach(v => {
    const tags = new Set(((v.titulo || '').toLowerCase().match(/#[\p{L}\p{N}_]+/gu) || []));
    tags.forEach(t => { m[t] = m[t] || { tag: t, n: 0, vistas: 0, inter: 0 }; m[t].n++; m[t].vistas += +v.vistas; m[t].inter += +v.likes + +v.comentarios + +v.compartidos; });
  });
  return Object.values(m).map(t => ({ ...t, media: t.vistas / t.n }));
}

// Regresión lineal simple sobre el histórico diario
function proyectar(campo, dias = 30) {
  const h = estado.datos.historial.filter(x => x[campo] != null);
  if (h.length < 3) return null;
  const xs = h.map(x => new Date(x.fecha) / 864e5), ys = h.map(x => Number(x[campo]));
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  const pend = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1);
  return { porDia: pend, valor: Math.max(0, Math.round(ys.at(-1) + pend * dias)) };
}

function ventana(desde, hasta) {
  const v = estado.datos.videos.filter(x => x.publicado_en && Date.now() - new Date(x.publicado_en) >= desde * 864e5 && Date.now() - new Date(x.publicado_en) < hasta * 864e5);
  const vistas = v.reduce((a, x) => a + +x.vistas, 0), inter = v.reduce((a, x) => a + +x.likes + +x.comentarios + +x.compartidos, 0);
  const h = estado.datos.historial;
  const val = d => { const lim = new Date(Date.now() - d * 864e5).toISOString().slice(0, 10); const r = [...h].reverse().find(x => x.fecha <= lim); return r ? +r.seguidores : null; };
  const segIni = val(hasta), segFin = val(desde);
  return { n: v.length, vistas, inter, seg: segIni != null && segFin != null ? segFin - segIni : null };
}

function comparaFila(titulo, a, b, fmt = num) {
  const d = b ? (a - b) / b * 100 : null;
  return `<tr><td>${titulo}</td><td><b>${fmt(a)}</b></td><td>${fmt(b)}</td>
    <td class="${d == null ? '' : d >= 0 ? 'up' : 'down'}">${d == null ? '—' : (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d).toFixed(0) + ' %'}</td></tr>`;
}

function recomendaciones(ctx) {
  const r = [];
  const { v, pareto, mejorHora, mejorDia, tags, frec, m } = ctx;
  if (frec.diasEntre > 3) r.push(['🗓️', 'Publica con más frecuencia', `Hoy publicas cada ${frec.diasEntre.toFixed(1)} días de media. Subir a 3 o más videos por semana suele multiplicar el alcance.`]);
  else r.push(['✅', 'Buen ritmo de publicación', `Publicas cada ${frec.diasEntre.toFixed(1)} días de media; mantén la constancia.`]);
  if (mejorHora) r.push(['⏰', `Publica cerca de las ${String(mejorHora.h).padStart(2, '0')}:00`, `Los videos publicados a esa hora tienen ${num(Math.round(mejorHora.media))} vistas de media.`]);
  if (mejorDia) r.push(['📅', `Prioriza los ${mejorDia.dia.toLowerCase()}`, `Es el día con más vistas medias por video (${num(Math.round(mejorDia.prom))}).`]);
  if (tags[0]) r.push(['#️⃣', `Repite ${tags[0].tag}`, `Los videos con este hashtag promedian ${num(Math.round(tags[0].media))} vistas.`]);
  if (m.tasa < 3) r.push(['💬', 'Pide interacción', `La tasa de interacción es ${fpct(m.tasa)}. Cierra los videos con una pregunta o una llamada a comentar y compartir.`]);
  if (pareto > 60) r.push(['🎯', 'Replica lo que funciona', `El ${pareto.toFixed(0)} % de las vistas viene del 20 % de tus videos. Revisa los videos «Estrella» y haz más de ese estilo.`]);
  const cortos = v.filter(x => +x.duracion && +x.duracion <= 30), largos = v.filter(x => +x.duracion > 30);
  if (cortos.length && largos.length) {
    const mc = cortos.reduce((a, x) => a + +x.vistas, 0) / cortos.length, ml = largos.reduce((a, x) => a + +x.vistas, 0) / largos.length;
    r.push(['⏱️', mc >= ml ? 'Los videos cortos rinden más' : 'Los videos largos rinden más', `Hasta 30 s: ${num(Math.round(mc))} vistas medias; más de 30 s: ${num(Math.round(ml))}.`]);
  }
  return r.map(([e, t, d]) => `<div class="insight"><span class="e">${e}</span><div><b>${t}</b><p>${d}</p></div></div>`).join('');
}

function vAnalisis() {
  const v = estado.datos.videos;
  if (!v.length) return '<section class="card panel"><p class="vacio">El análisis aparece cuando haya videos sincronizados.</p></section>';
  const m = metricas(), pts = puntajes();
  const cats = { Estrella: 0, 'Sólido': 0, Bajo: 0 };
  v.forEach(x => cats[categoria(pts.get(x.video_id))[0]]++);

  // Concentración (Pareto): qué parte de las vistas se llevan el 20 % de los videos
  const ordenV = [...v].sort((a, b) => b.vistas - a.vistas);
  const top = Math.max(1, Math.round(v.length * 0.2));
  const pareto = pct(ordenV.slice(0, top).reduce((a, x) => a + +x.vistas, 0), m.t.vistas);
  const med = mediana(v.map(x => +x.vistas));

  // Horas de publicación (hora de Lima)
  const horas = Array.from({ length: 24 }, (_, h) => ({ h, n: 0, vistas: 0 }));
  v.forEach(x => { if (x.publicado_en) { const o = horas[horaLima(x.publicado_en)]; o.n++; o.vistas += +x.vistas; } });
  horas.forEach(o => { o.media = o.n ? o.vistas / o.n : 0; });
  const mejorHora = [...horas].filter(o => o.n).sort((a, b) => b.media - a.media)[0];
  const mejorDia = porDia().filter(d => d.n).sort((a, b) => b.prom - a.prom)[0];

  // Frecuencia
  const fechas = v.filter(x => x.publicado_en).map(x => new Date(x.publicado_en)).sort((a, b) => a - b);
  const gaps = fechas.slice(1).map((f, i) => (f - fechas[i]) / 864e5);
  const frec = { diasEntre: gaps.length ? gaps.reduce((a, b) => a + b) / gaps.length : 0, maxHueco: gaps.length ? Math.max(...gaps) : 0, ultimo: fechas.at(-1) };
  const semanas = Array.from({ length: 8 }, (_, i) => {
    const fin = Date.now() - i * 7 * 864e5, ini = fin - 7 * 864e5;
    return { l: i ? `-${i} sem` : 'Esta', v: fechas.filter(f => f >= ini && f < fin).length };
  }).reverse();

  const tags = hashtags().filter(t => t.n >= 2).sort((a, b) => b.media - a.media);
  const seg = proyectar('seguidores'), likes = proyectar('likes');
  const a = ventana(0, 7), b = ventana(7, 14);
  const ultimo = estado.datos.historial.at(-1) || {};
  const veloces = [...v].filter(x => x.publicado_en).sort((x, y) => velocidad(y) - velocidad(x)).slice(0, 5);

  return `
    <section class="grid g4">
      ${kpi('Videos «Estrella»', num(cats.Estrella), `<div class="delta eq">${num(cats['Sólido'])} sólidos · ${num(cats.Bajo)} bajos</div>`, 'i-zap', '#db2777')}
      ${kpi('Concentración de vistas', fpct(pareto), `<div class="delta eq">en el 20 % de los videos (${top})</div>`, 'i-bar', '#7c3aed')}
      ${kpi('Vistas medianas', num(Math.round(med)), `<div class="delta eq">media ${num(Math.round(m.promVistas))}</div>`, 'i-eye', '#0891b2')}
      ${kpi('Proyección a 30 días', seg ? num(seg.valor) : '—', `<div class="delta ${seg && seg.porDia > 0 ? 'up' : 'eq'}">${seg ? (seg.porDia >= 0 ? '+' : '') + seg.porDia.toFixed(1) + ' seguidores/día' : 'faltan días de histórico'}</div>`, 'i-trend', '#059669')}
    </section>

    <section class="grid g21">
      <div class="card panel"><div class="sec-title">Comparativa semanal <small>videos publicados en cada semana</small></div>
        <div class="scroll"><table><thead><tr><th>Métrica</th><th>Últimos 7 días</th><th>7 días anteriores</th><th>Cambio</th></tr></thead><tbody>
          ${comparaFila('Videos publicados', a.n, b.n)}
          ${comparaFila('Vistas de esos videos', a.vistas, b.vistas)}
          ${comparaFila('Interacciones de esos videos', a.inter, b.inter)}
          ${a.seg != null ? comparaFila('Seguidores ganados', a.seg, b.seg) : ''}
        </tbody></table></div></div>
      <div class="card panel"><div class="sec-title">Embudo de interacción</div>
        ${barras([
          { l: 'Vistas', v: m.t.vistas, c: '#0891b2' },
          { l: 'Me gusta', v: m.t.likes, c: '#e11d48' },
          { l: 'Comentarios', v: m.t.com, c: '#059669' },
          { l: 'Compartidos', v: m.t.sh, c: '#d97706' },
          { l: 'Seguidores', v: +ultimo.seguidores || 0, c: '#db2777' },
        ], corto)}
        <p class="sub" style="margin-top:10px">Cada ${num(Math.round(m.t.vistas / (m.t.likes || 1)))} vistas llega 1 me gusta; cada ${num(Math.round(m.t.vistas / ((+ultimo.seguidores) || 1)))} vistas, 1 seguidor.</p></div>
    </section>

    <section class="grid g2">
      <div class="card panel"><div class="sec-title">Mejor hora para publicar <small>vistas medias por hora (Lima)</small></div>
        <div class="cols" style="height:150px">${horas.filter((o, i) => i >= 6 || o.n).map(o => `<div class="col" title="${String(o.h).padStart(2, '0')}:00 · ${o.n} video(s) · ${num(Math.round(o.media))} vistas medias"><b>${o.n ? corto(o.media) : ''}</b><div class="b" style="height:${o.media ? Math.max(4, o.media / (mejorHora?.media || 1) * 100) : 2}%;${o === mejorHora ? '' : 'opacity:.55'}"></div><span>${o.h}</span></div>`).join('')}</div></div>
      <div class="card panel"><div class="sec-title">Constancia de publicación</div>
        <dl class="kv" style="margin-bottom:14px">
          <dt>Días entre publicaciones</dt><dd>${frec.diasEntre.toFixed(1)} de media</dd>
          <dt>Mayor tiempo sin publicar</dt><dd>${frec.maxHueco.toFixed(0)} días</dd>
          <dt>Última publicación</dt><dd>${frec.ultimo ? fecha(frec.ultimo) : '—'}</dd>
          <dt>Likes proyectados en 30 días</dt><dd>${likes ? num(likes.valor) : '—'}</dd>
        </dl>
        <div class="cols" style="height:110px">${semanas.map(s => `<div class="col"><b>${s.v || ''}</b><div class="b" style="height:${Math.max(3, s.v / Math.max(...semanas.map(x => x.v), 1) * 100)}%;background:linear-gradient(180deg,#4f46e5,#818cf8)"></div><span>${s.l}</span></div>`).join('')}</div></div>
    </section>

    <section class="grid g2">
      <div class="card panel"><div class="sec-title">Hashtags que más rinden <small>usados en 2 o más videos</small></div>
        ${tags.length ? barras(tags.slice(0, 8).map(t => ({ l: `${t.tag} (${t.n})`, v: Math.round(t.media), c: '#7c3aed' }))) : '<p class="vacio">Usa hashtags repetidos para comparar su rendimiento.</p>'}</div>
      <div class="card panel"><div class="sec-title">Videos más veloces <small>vistas por día desde su publicación</small></div>
        <div class="top-list">${veloces.map((x, i) => `<a class="top-item" href="#" data-video="${esc(x.video_id)}"><span class="rank">${i + 1}</span>${x.portada ? `<img class="cover" src="${esc(x.portada)}" alt="">` : '<span class="cover"></span>'}
          <div style="min-width:0"><div class="tt">${esc(x.titulo || 'Sin título')}</div><div class="mm">${num(Math.round(velocidad(x)))} vistas/día · ${corto(x.vistas)} en total</div></div></a>`).join('')}</div></div>
    </section>

    <section class="card panel" style="margin-bottom:16px"><div class="sec-title">Ranking de videos <small>puntaje combinado de vistas e interacción · clic para ver el detalle</small></div>
      <div class="scroll"><table><thead><tr><th>Video</th><th>Puntaje</th><th>Categoría</th><th>Vistas</th><th>vs. mediana</th><th>Vistas/día</th><th>Interacción</th></tr></thead><tbody>
        ${[...v].sort((x, y) => pts.get(y.video_id) - pts.get(x.video_id)).map(x => { const p = pts.get(x.video_id), [cat, col] = categoria(p); return `<tr>
          <td><a class="vid" href="#" data-video="${esc(x.video_id)}">${x.portada ? `<img class="cover" src="${esc(x.portada)}" alt="">` : '<span class="cover"></span>'}<span>${esc(x.titulo || 'Sin título')}</span></a></td>
          <td><b>${p}</b></td><td><span class="chip" style="background:${col}1f;color:${col}">${cat}</span></td>
          <td>${num(x.vistas)}</td><td class="${+x.vistas >= med ? 'up' : 'down'}">${(+x.vistas / (med || 1)).toFixed(1)}×</td>
          <td>${num(Math.round(velocidad(x)))}</td><td class="eng">${fpct(tasaVideo(x))}</td></tr>`; }).join('')}
      </tbody></table></div></section>

    <section class="card panel"><div class="sec-title">Recomendaciones</div>${recomendaciones({ v, pareto, mejorHora, mejorDia, tags, frec, m })}</section>`;
}

// Crecimiento día a día usando la foto diaria de cada video
function vTendencias() {
  const d = estado.datos.diario || [];
  const fechas = [...new Set(d.map(x => x.fecha))].sort();
  if (fechas.length < 2) {
    return `<section class="card panel"><div class="aviso warn">Las tendencias se calculan comparando la foto diaria de cada video. Se empezaron a guardar hoy (${fechas[0] ? fdia(fechas[0]) : 'pendiente'}); desde mañana verás aquí las vistas ganadas por día y los videos que más crecen.</div>
      <p class="sub">Mientras tanto, revisa «Análisis» para la velocidad de cada video desde su publicación.</p></section>`;
  }
  const porFecha = f => d.filter(x => x.fecha === f);
  const suma = (f, k) => porFecha(f).reduce((a, x) => a + Number(x[k] || 0), 0);
  const dias = fechas.slice(1).map((f, i) => ({ f, vistas: suma(f, 'vistas') - suma(fechas[i], 'vistas'), likes: suma(f, 'likes') - suma(fechas[i], 'likes') }));
  const ultimos = dias.slice(-14);
  const maxV = Math.max(...ultimos.map(x => x.vistas), 1);
  const ref = fechas[Math.max(0, fechas.length - 8)], fin = fechas.at(-1);
  const valor = (id, f, k) => Number((d.find(x => x.video_id === id && x.fecha === f) || {})[k] || 0);
  const crecen = estado.datos.videos.map(v => ({ v, g: valor(v.video_id, fin, 'vistas') - valor(v.video_id, ref, 'vistas'), gl: valor(v.video_id, fin, 'likes') - valor(v.video_id, ref, 'likes') }))
    .filter(x => x.g > 0).sort((a, b) => b.g - a.g).slice(0, 8);
  const total = ultimos.reduce((a, x) => a + x.vistas, 0);
  return `
    <section class="grid g3">
      ${kpi('Vistas ganadas', num(total), `<div class="delta eq">en los últimos ${ultimos.length} día(s)</div>`, 'i-eye', '#0891b2')}
      ${kpi('Media diaria', num(Math.round(total / (ultimos.length || 1))), '<div class="delta eq">vistas por día</div>', 'i-trend', '#059669')}
      ${kpi('Likes ganados', num(ultimos.reduce((a, x) => a + x.likes, 0)), '<div class="delta eq">en el mismo periodo</div>', 'i-heart', '#e11d48')}
    </section>
    <section class="card panel" style="margin-bottom:16px"><div class="sec-title">Vistas ganadas por día</div>
      <div class="cols">${ultimos.map(x => `<div class="col" title="${fdia(x.f)} · ${num(x.vistas)} vistas"><b>${corto(x.vistas)}</b><div class="b" style="height:${Math.max(3, x.vistas / maxV * 100)}%"></div><span>${fdia(x.f)}</span></div>`).join('')}</div></section>
    <section class="card panel"><div class="sec-title">Videos que más crecen <small>desde ${fdia(ref)}</small></div>
      ${crecen.length ? `<div class="top-list">${crecen.map((x, i) => `<a class="top-item" href="#" data-video="${esc(x.v.video_id)}"><span class="rank">${i + 1}</span>${x.v.portada ? `<img class="cover" src="${esc(x.v.portada)}" alt="">` : '<span class="cover"></span>'}
        <div style="min-width:0"><div class="tt">${esc(x.v.titulo || 'Sin título')}</div><div class="mm"><b class="up">+${num(x.g)} vistas</b> · +${num(x.gl)} likes · ${corto(x.v.vistas)} en total</div></div></a>`).join('')}</div>` : '<p class="vacio">Ningún video ganó vistas en este periodo.</p>'}</section>`;
}

// Ficha de un video
function abrirVideo(id) {
  const v = estado.datos.videos.find(x => x.video_id === id);
  if (!v) return;
  const todos = estado.datos.videos, pts = puntajes(), p = pts.get(id), [cat, col] = categoria(p);
  const rank = [...todos].sort((a, b) => b.vistas - a.vistas).findIndex(x => x.video_id === id) + 1;
  const med = mediana(todos.map(x => +x.vistas));
  const hist = (estado.datos.diario || []).filter(x => x.video_id === id);
  const maxH = Math.max(...hist.map(x => +x.vistas), 1);
  const cerrar = () => document.getElementById('ficha-video')?.remove();
  cerrar();
  const div = document.createElement('div');
  div.id = 'ficha-video';
  div.className = 'modal-fondo';
  div.innerHTML = `<div class="modal-ficha card" role="dialog" aria-label="Detalle del video">
    <button class="modal-x" aria-label="Cerrar">×</button>
    <div class="ficha-cab">
      ${v.portada ? `<img src="${esc(v.portada)}" alt="">` : '<span class="cover" style="width:110px;height:146px"></span>'}
      <div style="min-width:0">
        <span class="chip" style="background:${col}1f;color:${col}">${cat} · ${p}/100</span>
        <p class="ficha-tit">${esc(v.titulo || 'Sin título')}</p>
        <p class="sub">${v.publicado_en ? 'Publicado ' + fecha(v.publicado_en) : ''}${v.duracion ? ' · ' + v.duracion + ' s' : ''}</p>
        <div class="ficha-acc">
          <a class="btn btn-primary" href="${esc(v.enlace || '#')}" target="_blank" rel="noopener noreferrer">Ver en TikTok ↗</a>
          <button class="btn btn-sec" data-refrescar="${esc(v.video_id)}">Actualizar desde TikTok</button>
          ${v.embed ? `<button class="btn btn-sec" data-embed="${esc(v.embed)}">Copiar embed</button>` : ''}
        </div>
        <p class="sub" style="margin-top:8px">${v.alto && v.ancho ? `${v.ancho}×${v.alto} · ${+v.alto >= +v.ancho ? 'vertical' : 'horizontal'}` : ''}${v.actualizado ? ` · datos del ${fecha(v.actualizado)}` : ''}</p>
      </div>
    </div>
    <div class="ficha-grid">
      ${[['Vistas', num(v.vistas)], ['Me gusta', num(v.likes)], ['Comentarios', num(v.comentarios)], ['Compartidos', num(v.compartidos)],
        ['Puesto por vistas', `#${rank} de ${todos.length}`], ['vs. mediana', (+v.vistas / (med || 1)).toFixed(1) + '×'], ['Vistas por día', num(Math.round(velocidad(v)))], ['Interacción', fpct(tasaVideo(v))],
        ['Likes / 100 vistas', pct(+v.likes, +v.vistas).toFixed(1)], ['Comentarios / 1 000', (+v.comentarios / (+v.vistas || 1) * 1000).toFixed(1)], ['Compartidos / 1 000', (+v.compartidos / (+v.vistas || 1) * 1000).toFixed(1)], ['Días publicado', v.publicado_en ? Math.floor(diasDesde(v.publicado_en)) : '—']]
        .map(([t, x]) => `<div class="ficha-m"><small>${t}</small><b>${x}</b></div>`).join('')}
    </div>
    <div class="sec-title" style="margin-top:6px">Evolución de vistas <small>${hist.length} día(s) registrados</small></div>
    ${hist.length >= 2 ? `<div class="cols" style="height:120px">${hist.slice(-14).map(x => `<div class="col"><b>${corto(x.vistas)}</b><div class="b" style="height:${Math.max(3, x.vistas / maxH * 100)}%"></div><span>${fdia(x.fecha)}</span></div>`).join('')}</div>`
      : '<p class="vacio" style="padding:14px">La evolución diaria aparece desde el segundo día de registro.</p>'}
  </div>`;
  document.body.appendChild(div);
  div.addEventListener('click', e => { if (e.target === div || e.target.closest('.modal-x')) cerrar(); });
  document.addEventListener('keydown', function esc_(e) { if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', esc_); } });
}

// Exportar los videos con sus métricas a CSV (se abre en Excel)
function exportarCsv() {
  const pts = puntajes();
  const filas = [['Título', 'Publicado', 'Duración (s)', 'Vistas', 'Me gusta', 'Comentarios', 'Compartidos', 'Interacción %', 'Vistas por día', 'Puntaje', 'Categoría', 'Enlace']];
  estado.datos.videos.forEach(v => filas.push([v.titulo || '', v.publicado_en ? new Date(v.publicado_en).toLocaleString('es-PE') : '', v.duracion || '', v.vistas, v.likes, v.comentarios, v.compartidos,
    tasaVideo(v).toFixed(2), Math.round(velocidad(v)), pts.get(v.video_id), categoria(pts.get(v.video_id))[0], v.enlace || '']));
  const csv = '﻿' + filas.map(f => f.map(c => `"${String(c).replace(/"/g, '""').replace(/\s+/g, ' ')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `tiktok-qubira-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Clic en cualquier video con data-video abre su ficha
document.addEventListener('click', e => {
  const el = e.target.closest('[data-video]');
  if (!el) return;
  e.preventDefault();
  abrirVideo(el.dataset.video);
});
