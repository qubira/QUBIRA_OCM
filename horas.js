/* ============================================================
   OCM — Filtros «Hoy» y «Día»: todo organizado por horas (hora de Lima).
   Usa las constantes globales de index.html (estado, api, esc, num, kpi, pintar…).
   ============================================================ */

const hoyLima = () => new Date(Date.now() - 5 * 36e5).toISOString().slice(0, 10);
const modoHora = () => estado.rango === 'hoy' || estado.rango === 'dia';
const fechaModo = () => (estado.rango === 'hoy' ? hoyLima() : (estado.dia || hoyLima()));
const etq = r => r.etiqueta || fdia(r.fecha);
estado.horas = {};
const cargandoHoras = {};

async function cargarHoras(fecha) {
  if (cargandoHoras[fecha]) return;
  cargandoHoras[fecha] = true;
  try { estado.horas[fecha] = await api('/tiktok/horas?fecha=' + fecha); }
  catch (e) { estado.horas[fecha] = { error: e.message, base: null, horas: [], videos: [] }; }
  cargandoHoras[fecha] = false;
  if (modoHora() && fechaModo() === fecha) repintarSeguro();
}

// Filas por hora del día elegido; la primera es la última foto del día anterior («Inicio»)
function filasHora() {
  const f = fechaModo(), d = estado.horas[f];
  if (!d) { cargarHoras(f); return null; }
  const filas = d.horas.map(h => ({ ...h, fecha: h.hora, etiqueta: h.hora.slice(11, 16) }));
  const base = d.base || cierreDiaAnterior(f);
  if (base && filas.length) filas.unshift({ ...base, fecha: base.hora, etiqueta: d.base ? 'Inicio' : 'Cierre ' + fdia(base.hora.slice(0, 10)), base: true, aprox: !d.base });
  return filas;
}

/* Si aún no hay foto por hora anterior al día, el punto de partida es el cierre del
   día anterior que ya está en el histórico diario (cuenta y videos). */
function cierreDiaAnterior(fecha) {
  const h = (estado.datos.historial || []).filter(x => x.fecha < fecha).at(-1);
  if (!h) return null;
  const diario = (estado.datos.diario || []).filter(x => x.fecha < fecha);
  const ultimoDia = diario.map(x => x.fecha).sort().at(-1);
  const delDia = diario.filter(x => x.fecha === ultimoDia);
  const suma = k => (delDia.length ? delDia.reduce((a, x) => a + (+x[k] || 0), 0) : null);
  return { hora: h.fecha + 'T23:59', seguidores: h.seguidores, seguidos: h.seguidos, likes: h.likes, videos: h.videos,
    vistas: suma('vistas'), likes_videos: suma('likes'), comentarios: suma('comentarios'), compartidos: suma('compartidos') };
}
// Punto de partida de cada video: su última foto por hora previa o, si no hay, la del día anterior
function baseVideo(id, fecha) {
  return (estado.datos.diario || []).filter(x => x.video_id === id && x.fecha < fecha).at(-1) || null;
}

function tituloDia() {
  const f = fechaModo();
  return f === hoyLima() ? 'Hoy' : new Date(f + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Barras de 24 horas con el número encima
function barras24(valores, color, sufijo = '') {
  const W = 720, H = 190, IZQ = 10, ABA = 26, ARR = 22, ancho = (W - 2 * IZQ) / 24;
  const max = Math.max(1, ...valores.map(v => v || 0));
  const hasta = fechaModo() === hoyLima() ? new Date(Date.now() - 5 * 36e5).getUTCHours() : 23;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" class="g-svg" role="img">
    ${valores.map((v, h) => {
      const x = IZQ + h * ancho, futuro = h > hasta, alto = v > 0 ? Math.max(3, v / max * (H - ABA - ARR)) : (v != null ? 2 : 0);
      return `${futuro ? `<rect x="${x + 2}" y="${ARR}" width="${ancho - 4}" height="${H - ABA - ARR}" fill="#fafafa"/>` : ''}
        ${v == null && !futuro ? `<rect x="${x + 2}" y="${H - ABA - 3}" width="${ancho - 4}" height="3" fill="#e5e7eb"><title>${String(h).padStart(2, '0')}:00 · sin foto</title></rect>` : ''}
        ${v != null && !futuro ? `<rect x="${x + 3}" y="${H - ABA - alto}" width="${ancho - 6}" height="${alto}" rx="3" fill="${color}"><title>${String(h).padStart(2, '0')}:00 · ${v > 0 ? '+' : ''}${num(v)}${sufijo}</title></rect>
          <text x="${x + ancho / 2}" y="${H - ABA - alto - 5}" font-size="10" font-weight="700" fill="${v ? color : "#9ca3af"}" text-anchor="middle">${v > 0 ? '+' : ''}${num(v)}</text>` : ''}
        ${h % 2 === 0 ? `<text x="${x + ancho / 2}" y="${H - 8}" font-size="10" fill="#9ca3af" text-anchor="middle">${String(h).padStart(2, '0')}h</text>` : ''}`;
    }).join('')}
    <line x1="${IZQ}" x2="${W - IZQ}" y1="${H - ABA}" y2="${H - ABA}" stroke="#e5e7eb"/>
  </svg>`;
}

function vCrecimientoHoras() {
  const filas = filasHora(), d = estado.horas[fechaModo()];
  const cab = `<section class="card panel" style="margin-bottom:16px"><div class="sec-title">Evolución por hora · ${esc(tituloDia())} ${selectorRango()}</div>`;
  if (!filas) return cab + '<div class="spin"></div></section>';
  if (d?.error) return cab + `<p class="vacio">${esc(d.error)}</p></section>`;
  const ini = filas[0] || {}, fin = filas.at(-1) || {};
  const sg = n => (n > 0 ? '+' : '') + num(n);
  /* Ganancia de cada hora:
     - si hay foto de la hora anterior (o el inicio real del día), contra esa foto;
     - si no, lo ganado dentro de la misma hora (primer valor de la hora → último). */
  const hN = r => +r.fecha.slice(11, 13);
  const porHora = campo => {
    const out = Array(24).fill(null);
    filas.forEach((r, i) => {
      if (r.base) return;
      const p = filas[i - 1];
      const contigua = p && !p.aprox && p[campo] != null && (p.base ? hN(r) === 0 : hN(p) === hN(r) - 1);
      const ref = contigua ? p[campo] : r[campo + '_ini'];
      out[hN(r)] = ref == null ? 0 : (+r[campo] || 0) - (+ref || 0);
    });
    return out;
  };
  const vistasH = porHora('vistas'), segH = porHora('seguidores'), likesH = porHora('likes_videos');
  const comH = porHora('comentarios'), shH = porHora('compartidos');
  // Totales del día: con inicio real, último − inicio; si no, la suma de lo ganado en las horas registradas
  const suma = arr => arr.reduce((a, v) => a + (v || 0), 0);
  const g = c => (!ini.aprox && ini.base && ini[c] != null ? (+fin[c] || 0) - (+ini[c] || 0)
    : suma({ seguidores: segH, vistas: vistasH, likes_videos: likesH, comentarios: comH, compartidos: shH }[c]));
  const pico = vistasH.reduce((a, v, h) => (v != null && v > (a.v ?? -1) ? { h, v } : a), {});
  const horasConFoto = filas.filter(r => !r.base).length;
  // Videos que más crecieron en el día
  const porVideo = {};
  for (const r of d.videos || []) (porVideo[r.video_id] ||= []).push(r);
  const ultimaHora = Math.max(-1, ...(d.videos || []).filter(r => r.hora.slice(0, 10) === fechaModo()).map(r => +r.hora.slice(11, 13)));
  const todos = Object.entries(porVideo).map(([id, s]) => {
    // Punto de partida: foto por hora previa al día → si no, la primera foto del día (su valor inicial)
    const z = s.at(-1), v = estado.datos.videos.find(x => x.video_id === id) || {};
    const a = s[0].hora.slice(0, 10) < fechaModo() ? s[0]
      : (s[0].vistas_ini != null ? { vistas: s[0].vistas_ini, likes: s[0].likes_ini, comentarios: s[0].comentarios_ini, compartidos: s[0].compartidos_ini } : s[0]);
    // Ganancia de cada hora del video: contra su foto de la hora anterior o, si no hay, dentro de la misma hora
    const horas = Array(24).fill(null);
    s.forEach((r, i) => {
      if (r.hora.slice(0, 10) !== fechaModo()) return;
      const h = +r.hora.slice(11, 13), p = s[i - 1];
      const ph = p ? (p.hora.slice(0, 10) < fechaModo() ? -1 : +p.hora.slice(11, 13)) : null;
      const ref = p && ph === h - 1 ? p : (r.vistas_ini != null ? { vistas: r.vistas_ini, likes: r.likes_ini, comentarios: r.comentarios_ini, compartidos: r.compartidos_ini } : null);
      horas[h] = ref ? { v: +r.vistas - +ref.vistas, l: +r.likes - +ref.likes, c: +r.comentarios - +ref.comentarios, s: +r.compartidos - +ref.compartidos } : { v: 0, l: 0, c: 0, s: 0 };
    });
    const pico = horas.reduce((m, x, h) => (x && x.v > (m.v ?? 0) ? { h, v: x.v } : m), {});
    // Vistas ganadas hasta el cierre de la hora anterior: última foto antes de la hora actual,
    // o el valor del primer minuto de la hora actual si el video no tenía foto antes
    const antes = s.filter(r => r.hora.slice(0, 10) < fechaModo() || +r.hora.slice(11, 13) < ultimaHora).at(-1);
    const actualH = s.find(r => r.hora.slice(0, 10) === fechaModo() && +r.hora.slice(11, 13) === ultimaHora);
    const previoV = antes ? +antes.vistas : (actualH && actualH.vistas_ini != null ? +actualH.vistas_ini : +a.vistas);
    return { id, v, horas, pico, vistasPrev: Math.max(0, previoV - +a.vistas), vistas: +z.vistas - +a.vistas, likes: +z.likes - +a.likes, com: +z.comentarios - +a.comentarios, sh: +z.compartidos - +a.compartidos };
  });
  // Puesto actual y puesto al cierre de la hora anterior (ranking por vistas ganadas en el día)
  const orden = (k) => [...todos].sort((a, b) => b[k] - a[k] || a.id.localeCompare(b.id));
  orden('vistas').forEach((x, i) => { x.puesto = i + 1; });
  // Los empates de la hora anterior se ordenan como ahora: así solo cuenta como subida/bajada un adelantamiento real
  [...todos].sort((a, b) => b.vistasPrev - a.vistasPrev || a.puesto - b.puesto).forEach((x, i) => { x.puestoPrev = i + 1; });
  const tops = todos.filter(x => x.vistas || x.likes || x.com || x.sh).sort((a, b) => a.puesto - b.puesto).slice(0, 10);
  const cambioPuesto = x => {
    const dif = x.puestoPrev - x.puesto;
    const t = dif > 0 ? `Subió ${dif} puesto(s): estaba #${x.puestoPrev} al cierre de la hora anterior`
      : dif < 0 ? `Bajó ${-dif} puesto(s): estaba #${x.puestoPrev} al cierre de la hora anterior` : 'Mantiene su puesto respecto a la hora anterior';
    return `<span class="pst ${dif > 0 ? 'sube' : dif < 0 ? 'baja' : 'igual'}" title="${t}"><b>#${x.puesto}</b><i>${dif > 0 ? '▲ ' + dif : dif < 0 ? '▼ ' + -dif : '='}</i></span>`;
  };
  const tabla = [...filas].reverse().map((x, i, arr) => {
    const prev = arr[i + 1];
    const dl = c => { if (!prev || prev[c] == null) return '<td>—</td>'; const n = (+x[c] || 0) - (+prev[c] || 0); return `<td class="${n > 0 ? 'up' : n < 0 ? 'down' : ''}">${n > 0 ? '+' : ''}${num(n)}</td>`; };
    return `<tr><td><b>${x.base ? (x.aprox ? 'Cierre del ' + fdia(x.fecha.slice(0, 10)) : 'Inicio del día') : x.etiqueta}</b></td><td>${num(x.seguidores)}</td>${dl('seguidores')}<td>${num(x.vistas)}</td>${dl('vistas')}<td>${num(x.likes_videos)}</td>${dl('likes_videos')}<td>${num(x.comentarios)}</td>${dl('comentarios')}<td>${num(x.compartidos)}</td>${dl('compartidos')}</tr>`;
  }).join('');
  return `
    <section class="grid g4">
      ${kpi('Seguidores ganados', sg(g('seguidores')), `<div class="delta eq">${ini.aprox || !ini.base ? 'en las horas registradas' : esc(tituloDia())}</div>`, 'i-users', '#db2777')}
      ${kpi('Vistas ganadas', sg(g('vistas')), `<div class="delta eq">${pico.v ? `hora pico ${String(pico.h).padStart(2, '0')}:00 (+${num(pico.v)})` : 'en el día'}</div>`, 'i-eye', '#0891b2')}
      ${kpi('Likes ganados', sg(g('likes_videos')), `<div class="delta eq">en los videos</div>`, 'i-heart', '#e11d48')}
      ${kpi('Comentarios y compartidos', sg(g('comentarios') + g('compartidos')), `<div class="delta eq">${horasConFoto} hora(s) con foto</div>`, 'i-msg', '#7c3aed')}
    </section>
    ${cab}${grafico(['seguidores', 'likes'])}</section>
    <section class="grid g2">
      <div class="card panel"><div class="sec-title">Vistas ganadas por hora</div>${barras24(vistasH, '#0891b2', ' vistas')}
        <p class="sub" style="font-size:12px">Cada barra es lo ganado en esa hora. Se actualiza cada minuto con el panel abierto.</p></div>
      <div class="card panel"><div class="sec-title">Seguidores y likes por hora</div>${barras24(segH, '#db2777', ' seguidores')}${barras24(likesH, '#f97316', ' likes')}
        <p class="sub"><span style="color:#db2777">■</span> seguidores · <span style="color:#f97316">■</span> likes de los videos</p></div>
    </section>
    <section class="card panel" style="margin-bottom:16px"><div class="sec-title">Videos que más crecieron · ${esc(tituloDia())}</div>
      ${tops.length ? `<p class="sub" style="font-size:12px;margin:-4px 0 10px">Toca una fila para ver el detalle hora por hora. El puesto se compara con el cierre de la hora anterior: <b style="color:var(--ok)">▲ sube</b> · <b style="color:#dc2626">▼ baja</b> · <b style="color:#ea580c">= se mantiene</b>.</p>
      <div class="scroll"><table class="vh-tabla"><thead><tr><th title="Comparado con el cierre de la hora anterior">Puesto</th><th>Video</th><th>Vistas</th><th>Likes</th><th>Coment.</th><th>Compart.</th><th>Hora pico</th><th style="min-width:150px">Vistas por hora (00h–23h)</th></tr></thead><tbody>
        ${tops.map(x => {
          const abierto = vidAbiertos.has(x.id);
          const conDatos = x.horas.map((o, h) => [h, o]).filter(([, o]) => o);
          return `<tr class="vh-fila ${abierto ? 'abierta' : ''}" data-exp="${esc(x.id)}">
            <td>${cambioPuesto(x)}</td>
            <td><div class="vh-vid">${x.v.portada ? `<img src="${esc(x.v.portada)}" alt="">` : ''}<div><a href="#" data-video="${esc(x.id)}">${esc((x.v.titulo || 'Video').replace(/\*\*/g, '').slice(0, 55))}</a>
              <small>${x.v.publicado_en ? 'Publicado ' + new Date(x.v.publicado_en).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : ''}${x.v.vistas != null ? ' · ' + num(+x.v.vistas) + ' vistas en total' : ''}</small></div><span class="vh-flecha">${abierto ? '▾' : '▸'}</span></div></td>
            <td class="up">+${num(x.vistas)}</td><td>${sg(x.likes)}</td><td>${sg(x.com)}</td><td>${sg(x.sh)}</td>
            <td>${x.pico.v ? `<b>${String(x.pico.h).padStart(2, '0')}:00</b><br><small class="sub">+${num(x.pico.v)}</small>` : '—'}</td>
            <td>${miniHoras(x.horas)}</td></tr>
            ${abierto ? `<tr class="vh-det"><td colspan="8">${detalleVideo(x)}</td></tr>` : ''}`;
        }).join('')}
      </tbody></table></div>` : '<p class="vacio">Sin cambios registrados en los videos este día.</p>'}
    </section>
    <section class="card panel"><div class="sec-title">Registro por hora <small>${horasConFoto} foto(s) · se guarda una por hora</small></div>
      ${filas.length ? `<div class="scroll"><table><thead><tr><th>Hora</th><th>Seguidores</th><th>Δ</th><th>Vistas</th><th>Δ</th><th>Likes</th><th>Δ</th><th>Coment.</th><th>Δ</th><th>Compart.</th><th>Δ</th></tr></thead><tbody>${tabla}</tbody></table></div>`
        : '<p class="vacio">Aún no hay fotos por hora de este día. Se guardan desde ahora: una por hora (y cada minuto mientras el panel está abierto).</p>'}
    </section>`;
}

// Mini gráfico de 24 barras (vistas ganadas por hora de un video)
const vidAbiertos = new Set();
function miniHoras(horas) {
  const max = Math.max(1, ...horas.map(o => (o ? o.v : 0)));
  return `<svg viewBox="0 0 144 30" width="144" height="30" class="vh-mini">${horas.map((o, h) => {
    const alto = o && o.v > 0 ? Math.max(2, o.v / max * 26) : (o ? 1.5 : 0);
    return `<rect x="${h * 6}" y="${28 - alto}" width="4.6" height="${alto || 1}" rx="1" fill="${o ? (o.v > 0 ? '#0891b2' : '#cbd5e1') : '#f1f5f9'}"><title>${String(h).padStart(2, '0')}:00 · ${o ? (o.v > 0 ? '+' : '') + num(o.v) + ' vistas' : 'sin foto'}</title></rect>`;
  }).join('')}<line x1="0" x2="144" y1="28.5" y2="28.5" stroke="#e5e7eb"/></svg>`;
}
// Abrir / cerrar el detalle por hora de un video (sin abrir la ficha si se toca el título)
document.addEventListener('click', e => {
  const fila = e.target.closest('[data-exp]');
  if (!fila || e.target.closest('[data-video]')) return;
  const id = fila.dataset.exp;
  vidAbiertos.has(id) ? vidAbiertos.delete(id) : vidAbiertos.add(id);
  repintarSeguro();
});

// Panel de detalle por hora de un video: resumen + lista de horas con barra proporcional
function detalleVideo(x) {
  const filas = x.horas.map((o, h) => [h, o]).filter(([, o]) => o);
  if (!filas.length) return '<p class="sub" style="margin:4px 0">Aún sin fotos por hora de este video en el día.</p>';
  const max = Math.max(1, ...filas.map(([, o]) => o.v));
  const total = filas.reduce((a, [, o]) => a + Math.max(0, o.v), 0);
  const activas = filas.filter(([, o]) => o.v > 0).length;
  const hh = h => String(h).padStart(2, '0') + ':00';
  const cel = n => (n ? `<b class="${n > 0 ? 'up' : 'down'}">${n > 0 ? '+' : ''}${num(n)}</b>` : '<span class="cero">—</span>');
  return `<div class="vd">
    <div class="vd-lista">
      <div class="vd-cab"><span>Hora</span><span>Vistas ganadas</span><span>% del día</span><span>Likes</span><span>Coment.</span><span>Compart.</span></div>
      ${filas.map(([h, o]) => `<div class="vd-fila ${x.pico.v && h === x.pico.h ? 'pico' : ''}">
        <span class="vd-h">${hh(h)}${x.pico.v && h === x.pico.h ? ' <i>pico</i>' : ''}</span>
        <span class="vd-barra"><span><i style="width:${o.v > 0 ? Math.max(3, o.v / max * 100) : 0}%"></i></span><b>${o.v > 0 ? '+' : ''}${num(o.v)}</b></span>
        <span class="vd-pct">${total ? (Math.max(0, o.v) / total * 100).toFixed(0) + ' %' : '—'}</span>
        <span>${cel(o.l)}</span><span>${cel(o.c)}</span><span>${cel(o.s)}</span>
      </div>`).join('')}
    </div>
  </div>`;
}
