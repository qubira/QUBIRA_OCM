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
  if (d.base && filas.length) filas.unshift({ ...d.base, fecha: d.base.hora, etiqueta: 'Inicio', base: true });
  return filas;
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
      const x = IZQ + h * ancho, futuro = h > hasta, alto = v ? Math.max(2, v / max * (H - ABA - ARR)) : 0;
      return `${futuro ? `<rect x="${x + 2}" y="${ARR}" width="${ancho - 4}" height="${H - ABA - ARR}" fill="#fafafa"/>` : ''}
        ${v == null && !futuro ? `<rect x="${x + 2}" y="${H - ABA - 3}" width="${ancho - 4}" height="3" fill="#e5e7eb"><title>${String(h).padStart(2, '0')}:00 · sin foto</title></rect>` : ''}
        ${v ? `<rect x="${x + 3}" y="${H - ABA - alto}" width="${ancho - 6}" height="${alto}" rx="3" fill="${color}"><title>${String(h).padStart(2, '0')}:00 · ${v > 0 ? '+' : ''}${num(v)}${sufijo}</title></rect>
          <text x="${x + ancho / 2}" y="${H - ABA - alto - 5}" font-size="10" font-weight="700" fill="${color}" text-anchor="middle">${v > 0 ? '+' : ''}${num(v)}</text>` : ''}
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
  const g = c => (filas.length > 1 ? (+fin[c] || 0) - (+ini[c] || 0) : 0);
  const sg = n => (n > 0 ? '+' : '') + num(n);
  // Ganancia en cada hora (contra la foto anterior)
  const porHora = campo => {
    const out = Array(24).fill(null);
    filas.forEach((r, i) => { if (r.base || !i) return; out[+r.fecha.slice(11, 13)] = (+r[campo] || 0) - (+filas[i - 1][campo] || 0); });
    if (filas.length === 1 && !filas[0].base) out[+filas[0].fecha.slice(11, 13)] = 0;
    return out;
  };
  const vistasH = porHora('vistas'), segH = porHora('seguidores'), likesH = porHora('likes_videos');
  const pico = vistasH.reduce((a, v, h) => (v != null && v > (a.v ?? -1) ? { h, v } : a), {});
  const horasConFoto = filas.filter(r => !r.base).length;
  // Videos que más crecieron en el día
  const porVideo = {};
  for (const r of d.videos || []) (porVideo[r.video_id] ||= []).push(r);
  const tops = Object.entries(porVideo).map(([id, s]) => {
    const a = s[0], z = s.at(-1), v = estado.datos.videos.find(x => x.video_id === id) || {};
    return { id, v, vistas: +z.vistas - +a.vistas, likes: +z.likes - +a.likes, com: +z.comentarios - +a.comentarios, sh: +z.compartidos - +a.compartidos };
  }).filter(x => x.vistas || x.likes || x.com || x.sh).sort((a, b) => b.vistas - a.vistas).slice(0, 8);
  const tabla = [...filas].reverse().map((x, i, arr) => {
    const prev = arr[i + 1];
    const dl = c => { if (!prev) return '<td>—</td>'; const n = (+x[c] || 0) - (+prev[c] || 0); return `<td class="${n > 0 ? 'up' : n < 0 ? 'down' : ''}">${n > 0 ? '+' : ''}${num(n)}</td>`; };
    return `<tr><td><b>${x.base ? 'Inicio del día' : x.etiqueta}</b></td><td>${num(x.seguidores)}</td>${dl('seguidores')}<td>${num(x.vistas)}</td>${dl('vistas')}<td>${num(x.likes_videos)}</td>${dl('likes_videos')}<td>${num(x.comentarios)}</td>${dl('comentarios')}<td>${num(x.compartidos)}</td>${dl('compartidos')}</tr>`;
  }).join('');
  return `
    <section class="grid g4">
      ${kpi('Seguidores ganados', sg(g('seguidores')), `<div class="delta eq">${esc(tituloDia())}</div>`, 'i-users', '#db2777')}
      ${kpi('Vistas ganadas', sg(g('vistas')), `<div class="delta eq">${pico.v ? `hora pico ${String(pico.h).padStart(2, '0')}:00 (+${num(pico.v)})` : 'en el día'}</div>`, 'i-eye', '#0891b2')}
      ${kpi('Likes ganados', sg(g('likes_videos')), `<div class="delta eq">en los videos</div>`, 'i-heart', '#e11d48')}
      ${kpi('Comentarios y compartidos', sg(g('comentarios') + g('compartidos')), `<div class="delta eq">${horasConFoto} hora(s) con foto</div>`, 'i-msg', '#7c3aed')}
    </section>
    ${cab}${grafico(['seguidores', 'likes'])}</section>
    <section class="grid g2">
      <div class="card panel"><div class="sec-title">Vistas ganadas por hora</div>${barras24(vistasH, '#0891b2', ' vistas')}</div>
      <div class="card panel"><div class="sec-title">Seguidores y likes por hora</div>${barras24(segH, '#db2777', ' seguidores')}${barras24(likesH, '#f97316', ' likes')}
        <p class="sub"><span style="color:#db2777">■</span> seguidores · <span style="color:#f97316">■</span> likes de los videos</p></div>
    </section>
    <section class="card panel" style="margin-bottom:16px"><div class="sec-title">Videos que más crecieron · ${esc(tituloDia())}</div>
      ${tops.length ? `<div class="scroll"><table><thead><tr><th>Video</th><th>Vistas</th><th>Likes</th><th>Coment.</th><th>Compart.</th></tr></thead><tbody>
        ${tops.map(x => `<tr><td><a href="#" data-video="${esc(x.id)}">${esc((x.v.titulo || 'Video').replace(/\*\*/g, '').slice(0, 60))}</a></td><td class="up">+${num(x.vistas)}</td><td>${sg(x.likes)}</td><td>${sg(x.com)}</td><td>${sg(x.sh)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="vacio">Sin cambios registrados en los videos este día.</p>'}
    </section>
    <section class="card panel"><div class="sec-title">Registro por hora <small>${horasConFoto} foto(s) · se guarda una por hora</small></div>
      ${filas.length ? `<div class="scroll"><table><thead><tr><th>Hora</th><th>Seguidores</th><th>Δ</th><th>Vistas</th><th>Δ</th><th>Likes</th><th>Δ</th><th>Coment.</th><th>Δ</th><th>Compart.</th><th>Δ</th></tr></thead><tbody>${tabla}</tbody></table></div>`
        : '<p class="vacio">Aún no hay fotos por hora de este día. Se guardan desde ahora: una por hora (y cada minuto mientras el panel está abierto).</p>'}
    </section>`;
}
