/* ============================================================
   OCM — Laboratorio: curva de vida, videos que despegan, seguidores
   por publicación, temas, proyección y calendario.
   Usa las constantes globales de index.html (estado, esc, num, fecha, pintar…).
   ============================================================ */

const TEMAS = {
  'Software y sistemas': /software|sistema|erp|factur|inventario|gesti[oó]n|app|aplicaci/i,
  'Web y tiendas': /web|p[aá]gina|tienda|ecommerce|online|dominio/i,
  'Promoción y lanzamientos': /pr[oó]ximamente|lanz|nuevo|promo|oferta|descuento|gratis/i,
  'Marca y equipo': /equipo|nosotros|conoce|oficina|aniversario|qui[eé]nes somos/i,
  'Consejos y tutoriales': /c[oó]mo|tips?|consejo|aprende|tutorial|paso/i,
  'Inteligencia artificial': /\bia\b|inteligencia artificial|\bai\b|chatgpt|autom/i,
};
const limpio = t => String(t || 'Sin título').replace(/\*\*/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
const fDia = iso => new Date(iso + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' });
const diaISO = d => new Date(d).toISOString().slice(0, 10);
const sumarDias = (iso, n) => diaISO(new Date(iso + 'T12:00:00Z').getTime() + n * 864e5);
const medianaL = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const barraH = (et, val, max, txt, col = 'var(--primary)') => `<div class="lab-fila"><span class="tt">${et}</span><div class="lab-barra"><i style="width:${Math.max(2, val / (max || 1) * 100)}%;background:${col}"></i></div><b>${txt}</b></div>`;

// Serie diaria de cada video: [{fecha, vistas, …}] ordenada
function seriesPorVideo() {
  const m = {};
  for (const d of estado.datos.diario || []) (m[d.video_id] ||= []).push(d);
  for (const k in m) m[k].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return m;
}

// 1) Curva de vida: vistas acumuladas según la edad del video (día 0 = publicación)
function curvaVida() {
  const series = seriesPorVideo(), puntos = {};
  for (const v of estado.datos.videos) {
    if (!v.publicado_en || !series[v.video_id]) continue;
    const pub = diaISO(v.publicado_en);
    for (const d of series[v.video_id]) {
      const edad = Math.round((new Date(d.fecha) - new Date(pub)) / 864e5);
      if (edad >= 0 && edad <= 30) (puntos[edad] ||= []).push(+d.vistas);
    }
  }
  return Object.entries(puntos).map(([e, a]) => ({ edad: +e, med: medianaL(a), n: a.length })).sort((a, b) => a.edad - b.edad);
}

// 3) Videos que despegan: vistas ganadas en el último día vs. su propio ritmo medio
function despegues() {
  const series = seriesPorVideo(), out = [];
  for (const v of estado.datos.videos) {
    const s = series[v.video_id];
    if (!s || s.length < 2) continue;
    const ult = s[s.length - 1], prev = s[s.length - 2];
    const ganadas = +ult.vistas - +prev.vistas;
    const dias = Math.max(1, (new Date(ult.fecha) - new Date(v.publicado_en || s[0].fecha)) / 864e5);
    const ritmo = +ult.vistas / dias;
    out.push({ v, ganadas, ritmo, factor: ganadas / (ritmo || 1) });
  }
  return out.sort((a, b) => b.factor - a.factor);
}

// 4) Seguidores ganados atribuidos a los videos publicados ese día o el anterior
function seguidoresPorVideo() {
  const h = estado.datos.historial || [], res = [];
  for (let i = 1; i < h.length; i++) {
    const ganados = (+h[i].seguidores || 0) - (+h[i - 1].seguidores || 0);
    const vids = estado.datos.videos.filter(v => v.publicado_en && [h[i].fecha, h[i - 1].fecha].includes(diaISO(v.publicado_en)));
    res.push({ fecha: h[i].fecha, ganados, vids });
  }
  return res;
}

// 5) Proyección de seguidores con rango (ritmo medio ± desviación)
function proyeccion(dias) {
  const h = estado.datos.historial || [];
  if (h.length < 2) return null;
  const deltas = h.slice(1).map((x, i) => (+x.seguidores || 0) - (+h[i].seguidores || 0));
  const media = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const desv = Math.sqrt(deltas.reduce((a, b) => a + (b - media) ** 2, 0) / deltas.length);
  const base = +h[h.length - 1].seguidores || 0;
  return { base, media, esperado: Math.round(base + media * dias), alto: Math.round(base + (media + desv / 2) * dias), bajo: Math.max(base, Math.round(base + (media - desv / 2) * dias)) };
}

// 7) Rendimiento por tema
function porTema() {
  const vs = estado.datos.videos, medGlobal = medianaL(vs.map(v => +v.vistas));
  return Object.entries(TEMAS).map(([t, re]) => {
    const g = vs.filter(v => re.test(v.titulo || ''));
    const vis = g.map(v => +v.vistas), inter = g.reduce((a, v) => a + +v.likes + +v.comentarios + +v.compartidos, 0), tot = vis.reduce((a, b) => a + b, 0);
    return { t, n: g.length, med: medianaL(vis), idx: medianaL(vis) / (medGlobal || 1), inter: tot ? inter / tot * 100 : 0, dur: medianaL(g.map(v => +v.duracion).filter(Boolean)) };
  }).filter(x => x.n && x.n < vs.length * 0.9).sort((a, b) => b.idx - a.idx);
}

// 14) Calendario del mes
function calendario(ym) {
  const [y, m] = ym.split('-').map(Number), primero = new Date(Date.UTC(y, m - 1, 1)), diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const vs = estado.datos.videos, medV = medianaL(vs.map(v => +v.vistas));
  const porDia = {};
  for (const v of vs) if (v.publicado_en) { const k = new Date(new Date(v.publicado_en).getTime() - 5 * 36e5).toISOString().slice(0, 10); (porDia[k] ||= []).push(v); }
  const offset = (primero.getUTCDay() + 6) % 7, celdas = [];
  for (let i = 0; i < offset; i++) celdas.push('<div class="cal-d vacio"></div>');
  for (let d = 1; d <= diasMes; d++) {
    const k = `${ym}-${String(d).padStart(2, '0')}`, lista = porDia[k] || [];
    celdas.push(`<div class="cal-d ${lista.length ? '' : 'sin'}"><span>${d}</span>${lista.map(v => {
      const r = +v.vistas / (medV || 1), c = r >= 1.5 ? 'top' : r >= 0.8 ? 'med' : 'bajo';
      return `<a href="#" data-video="${esc(v.video_id)}" class="cal-v ${c}" title="${esc(limpio(v.titulo).slice(0, 80))}">${num(+v.vistas)}</a>`;
    }).join('')}</div>`);
  }
  const conVideo = Object.keys(porDia).filter(k => k.startsWith(ym)).length;
  return { html: celdas.join(''), conVideo, diasMes };
}

let mesCal = null;
function vLaboratorio() {
  const vs = estado.datos.videos;
  if (!vs.length) return '<div class="card panel"><p class="sub">Aún no hay videos para analizar.</p></div>';
  const curva = curvaVida(), maxC = Math.max(...curva.map(x => x.med), 1);
  const desp = despegues().slice(0, 5), maxD = Math.max(...desp.map(x => x.ganadas), 1);
  const segs = seguidoresPorVideo().filter(x => x.ganados > 0).sort((a, b) => b.ganados - a.ganados).slice(0, 6);
  const temas = porTema(), maxT = Math.max(...temas.map(x => x.idx), 1);
  const meses = [...new Set(vs.filter(v => v.publicado_en).map(v => diaISO(v.publicado_en).slice(0, 7)))].sort().reverse();
  if (!mesCal || !meses.includes(mesCal)) mesCal = meses[0] || diaISO(Date.now()).slice(0, 7);
  const cal = calendario(mesCal);
  const p30 = proyeccion(30), p90 = proyeccion(90);
  const diasDiario = new Set((estado.datos.diario || []).map(d => d.fecha)).size;
  const pocoHist = diasDiario < 7 ? `<p class="sub" style="margin-bottom:8px">ℹ️ Con ${diasDiario} día(s) de fotos diarias; se vuelve más preciso cada día que pasa.</p>` : '';
  return `<section class="grid g2">
      <div class="card panel"><div class="sec-title">Curva de vida del video</div>${pocoHist}
        ${curva.length ? curva.map(x => barraH(`Día ${x.edad}`, x.med, maxC, `${num(Math.round(x.med))} <small class="sub">(${x.n})</small>`)).join('') : '<p class="sub">Falta histórico diario.</p>'}
        <p class="sub" style="margin-top:8px">Mediana de vistas acumuladas según los días desde que se publicó. Indica cuándo un video suele dejar de crecer.</p></div>
      <div class="card panel"><div class="sec-title">Videos que despegan (último día)</div>${pocoHist}
        ${desp.length ? desp.map(x => barraH(`<a href="#" data-video="${esc(x.v.video_id)}">${esc(limpio(x.v.titulo).slice(0, 34))}</a>`, Math.max(0, x.ganadas), maxD,
          `+${num(x.ganadas)} ${x.factor >= 1.5 ? '<span class="chip ok">🚀 ' + x.factor.toFixed(1) + '×</span>' : ''}`, x.factor >= 1.5 ? 'var(--ok)' : 'var(--primary)')).join('') : '<p class="sub">Se necesitan al menos 2 días de fotos diarias.</p>'}
        <p class="sub" style="margin-top:8px">🚀 = gana más del 1.5× de su ritmo normal: buen momento para fijarlo y responder comentarios.</p></div>
    </section>
    <section class="grid g2">
      <div class="card panel"><div class="sec-title">Seguidores ganados por publicación</div>
        ${segs.length ? `<div class="scroll"><table><thead><tr><th>Día</th><th>Seguidores</th><th>Videos de ese día / anterior</th></tr></thead><tbody>
          ${segs.map(x => `<tr><td>${fDia(x.fecha)}</td><td><b style="color:var(--ok)">+${x.ganados}</b></td><td>${x.vids.length ? x.vids.slice(0, 3).map(v => `<a href="#" data-video="${esc(v.video_id)}">${esc(limpio(v.titulo).slice(0, 40))}</a>`).join('<br>') + (x.vids.length > 3 ? `<br><small class="sub">y ${x.vids.length - 3} más</small>` : '') : '<span class="sub">sin video (crecimiento orgánico)</span>'}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="sub">Aún no hay días con ganancia de seguidores registrada.</p>'}</div>
      <div class="card panel"><div class="sec-title">Proyección de seguidores</div>
        ${p30 ? `<div class="lab-proy">${[['30 días', p30], ['90 días', p90]].map(([t, p]) => `<div><small>${t}</small><b>${num(p.esperado)}</b><span class="sub">rango ${num(p.bajo)} – ${num(p.alto)}</span></div>`).join('')}</div>
          <p class="sub" style="margin-top:10px">Ritmo actual: ${p30.media >= 0 ? '+' : ''}${p30.media.toFixed(1)} seguidores por día. Rango según la variación diaria.</p>
          <div class="sim" style="margin-top:12px"><label>Meta de seguidores<input type="number" id="lab-meta" min="1" value="${Math.ceil((p30.base + 100) / 100) * 100}"></label><label>Para el<input type="date" id="lab-fecha" value="${sumarDias(diaISO(Date.now()), 90)}"></label></div>
          <div id="lab-meta-res" class="sim-res"></div>` : '<p class="sub">Se necesitan al menos 2 días de histórico.</p>'}</div>
    </section>
    <section class="card panel"><div class="sec-title">Rendimiento por tema</div>
      ${temas.length ? `<div class="scroll"><table><thead><tr><th>Tema</th><th>Videos</th><th>Índice vs. cuenta</th><th>Vistas medianas</th><th>Interacción</th><th>Duración ideal</th></tr></thead><tbody>
        ${temas.map(x => `<tr><td><b>${esc(x.t)}</b></td><td>${x.n}</td><td style="min-width:160px">${barraH('', x.idx, maxT, x.idx.toFixed(2) + '×', x.idx >= 1 ? 'var(--ok)' : '#d97706')}</td><td>${num(Math.round(x.med))}</td><td>${x.inter.toFixed(2)} %</td><td>${x.dur ? Math.round(x.dur) + ' s' : '—'}</td></tr>`).join('')}
      </tbody></table></div><p class="sub" style="margin-top:8px">Índice 1.00× = igual a la mediana de la cuenta. Temas detectados por palabras del título; un video puede contar en varios.</p>` : '<p class="sub">No se detectaron temas en los títulos.</p>'}
    </section>
    <section class="card panel"><div class="sec-title">Calendario de publicaciones
        <select id="lab-mes" class="lab-sel">${meses.map(m => `<option value="${m}" ${m === mesCal ? 'selected' : ''}>${new Date(m + '-15').toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}</option>`).join('')}</select></div>
      <p class="sub" style="margin-bottom:10px">${cal.conVideo} de ${cal.diasMes} días con publicación · <span class="cal-v top">alto</span> <span class="cal-v med">normal</span> <span class="cal-v bajo">bajo</span> según la mediana de vistas</p>
      <div class="cal">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<div class="cal-h">${d}</div>`).join('')}${cal.html}</div>
    </section>`;
}

function enlazarLaboratorio() {
  const mes = document.getElementById('lab-mes');
  if (mes) mes.onchange = () => { mesCal = mes.value; pintar(); };
  const meta = document.getElementById('lab-meta'), fe = document.getElementById('lab-fecha'), out = document.getElementById('lab-meta-res');
  if (!meta || !out) return;
  const calc = () => {
    const p = proyeccion(1), dias = Math.max(1, Math.round((new Date(fe.value) - Date.now()) / 864e5));
    const faltan = +meta.value - p.base, porDia = faltan / dias;
    // Separa el crecimiento orgánico (días sin video) del que aporta cada video
    const todos = seguidoresPorVideo(), sinVid = todos.filter(x => !x.vids.length), conVid = todos.filter(x => x.vids.length);
    const organico = sinVid.length ? Math.max(0, sinVid.reduce((a, x) => a + x.ganados, 0) / sinVid.length) : 0;
    const porVideo = conVid.length ? Math.max(0.5, conVid.reduce((a, x) => a + Math.max(0, x.ganados - organico) / x.vids.length, 0) / conVid.length) : null;
    const extraSem = Math.max(0, (porDia - Math.max(p.media, organico)) * 7);
    const videosSem = porVideo && extraSem > 0 ? Math.ceil(extraSem / porVideo) : 0;
    out.innerHTML = faltan <= 0 ? '<b>¡Meta ya alcanzada! 🎉</b>' :
      `<div class="sim-num">${porDia.toFixed(1)}<small> seguidores por día necesarios · ${dias} días</small></div>
       <p class="sub">Ritmo actual: ${p.media.toFixed(1)}/día → ${p.media >= porDia ? '<span class="chip ok">vas en camino, mantén tu ritmo de publicación</span>' : `<span class="chip warn">necesitas ${(porDia / Math.max(p.media, 0.1)).toFixed(1)}× tu ritmo</span>`}
       ${videosSem ? ` · cada video aporta ~${porVideo.toFixed(1)} seguidores: publica <b>${videosSem} videos más por semana</b>` : ''}</p>`;
  };
  meta.oninput = fe.oninput = calc; calc();
}
