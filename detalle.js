/* ============================================================
   OCM — Detalle: «Calidad de la interacción» (Estrategia) y
   «Evolución» de la ficha de cada video (por día y por hora).
   Usa las globales de index.html, analisis.js y horas.js.
   ============================================================ */

// ─── Calidad de la interacción ──────────────────────────────────────────────
function tarjetaCalidad(videos) {
  const vs = videos.filter(x => +x.vistas > 0);
  const t = vs.reduce((a, x) => ({ v: a.v + +x.vistas, l: a.l + +x.likes, c: a.c + +x.comentarios, s: a.s + +x.compartidos }), { v: 0, l: 0, c: 0, s: 0 });
  const M = [
    { k: 'inter', n: 'Interacción total', d: 'likes + comentarios + compartidos por cada 100 vistas', f: x => (+x.likes + +x.comentarios + +x.compartidos) / +x.vistas * 100, tot: (t.l + t.c + t.s) / (t.v || 1) * 100, ref: 4, u: '%',
      tip: 'Mide si el contenido mueve a la gente a reaccionar. Pide una acción concreta al final del video.' },
    { k: 'apro', n: 'Aprobación', d: 'likes por cada 100 vistas', f: x => +x.likes / +x.vistas * 100, tot: t.l / (t.v || 1) * 100, ref: 5, u: '',
      tip: 'Indica si el video gusta. Los primeros 3 segundos y el ritmo son lo que más la suben.' },
    { k: 'conv', n: 'Conversación', d: 'comentarios por cada 100 likes', f: x => (+x.likes ? +x.comentarios / +x.likes * 100 : 0), tot: t.c / (t.l || 1) * 100, ref: 10, u: '',
      tip: 'Las preguntas directas («¿qué app crearías tú?») y responder comentarios la multiplican.' },
    { k: 'viral', n: 'Viralidad', d: 'compartidos por cada 100 likes', f: x => (+x.likes ? +x.compartidos / +x.likes * 100 : 0), tot: t.s / (t.l || 1) * 100, ref: 10, u: '',
      tip: 'Se comparte lo útil o lo que identifica: tips, datos curiosos, casos reales de clientes.' },
    { k: 'com1k', n: 'Comentarios por mil vistas', d: 'comentarios por cada 1 000 vistas', f: x => +x.comentarios / +x.vistas * 1000, tot: t.c / (t.v || 1) * 1000, ref: 5, u: '',
      tip: 'Compara cuánto conversa tu audiencia sin importar cuántos likes hubo.' },
    { k: 'sh1k', n: 'Compartidos por mil vistas', d: 'compartidos por cada 1 000 vistas', f: x => +x.compartidos / +x.vistas * 1000, tot: t.s / (t.v || 1) * 1000, ref: 5, u: '',
      tip: 'Cada compartido lleva el video a gente nueva: es la señal de alcance más fuerte.' },
  ];
  const estado_ = (v, ref) => v >= ref ? ['Excelente', '#059669', '#d1fae5'] : v >= ref * 0.6 ? ['Buena', '#16a34a', '#dcfce7'] : v >= ref * 0.3 ? ['Regular', '#d97706', '#fef3c7'] : ['Baja', '#dc2626', '#fee2e2'];
  const conBase = vs.filter(x => +x.vistas >= 100); // para «mejor video» se exige un mínimo de vistas
  const nota = Math.round(M.reduce((a, m) => a + Math.min(1, m.tot / m.ref), 0) / M.length * 100);
  const colNota = nota >= 70 ? '#059669' : nota >= 40 ? '#d97706' : '#dc2626';
  return `<div class="card panel"><div class="sec-title">Calidad de la interacción <small>${vs.length} videos · ${num(t.v)} vistas</small></div>
    <div class="cal-top">
      <div class="nota-anillo" style="--p:${nota};--c:${colNota};width:96px"><b style="font-size:26px">${nota}</b><small>/ 100</small></div>
      <div><b>${nota >= 70 ? 'Tu audiencia participa mucho' : nota >= 40 ? 'Participación aceptable, con margen de mejora' : 'La audiencia mira pero participa poco'}</b>
        <p class="sub" style="font-size:12px;margin-top:4px">Promedio de los 6 indicadores frente a una referencia sana de TikTok. ${num(t.l)} likes · ${num(t.c)} comentarios · ${num(t.s)} compartidos.</p></div>
    </div>
    ${M.map(m => {
      const [et, col, fondo] = estado_(m.tot, m.ref), escala = m.ref * 2, ancho = Math.min(100, m.tot / escala * 100), marca = 50;
      const mejor = conBase.map(x => ({ x, v: m.f(x) })).filter(o => isFinite(o.v)).sort((a, b) => b.v - a.v)[0];
      return `<div class="cal-m">
        <div class="cal-cab"><b>${m.n}</b><span class="cal-et" style="color:${col};background:${fondo}">${et}</span><b class="cal-val" style="color:${col}">${m.tot.toFixed(1)}${m.u ? ' ' + m.u : ''}</b></div>
        <div class="cal-barra"><i style="width:${ancho}%;background:${col}"></i><span style="left:${marca}%" title="Referencia sana: ${m.ref}${m.u ? ' ' + m.u : ''}"></span></div>
        <small class="sub">${m.d} · referencia sana ≈ ${m.ref}${m.u ? ' ' + m.u : ''}${m.tot < m.ref ? ` · te faltan ${(m.ref - m.tot).toFixed(1)}` : ''}</small>
        <p class="cal-tip">💡 ${m.tip}</p>
        ${mejor && mejor.v > 0 ? `<p class="cal-mejor">🏆 Mejor: <a href="#" data-video="${esc(mejor.x.video_id)}">${esc((mejor.x.titulo || 'Video').replace(/\*\*/g, '').slice(0, 46))}</a> <b>${mejor.v.toFixed(1)}</b></p>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

// ─── Evolución de un video (ficha) ──────────────────────────────────────────
function evolucionVideo(v, hist) {
  const dias = [...hist].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const filas = dias.map((x, i) => {
    const p = dias[i - 1];
    return { ...x, gv: p ? +x.vistas - +p.vistas : null, gl: p ? +x.likes - +p.likes : null, gc: p ? +x.comentarios - +p.comentarios : null, gs: p ? +x.compartidos - +p.compartidos : null };
  });
  const sg = n => (n == null ? '—' : `<span class="${n > 0 ? 'up' : n < 0 ? 'down' : ''}">${n > 0 ? '+' : ''}${num(n)}</span>`);
  const ganadas = filas.filter(f => f.gv != null);
  const mejorDia = ganadas.reduce((a, f) => (f.gv > (a?.gv ?? -1) ? f : a), null);
  const ritmo = ganadas.length ? ganadas.reduce((a, f) => a + f.gv, 0) / ganadas.length : null;
  // Gráfico diario: barras = vistas acumuladas, número verde = ganadas ese día
  const W = 560, H = 170, IZQ = 8, ABA = 26, ARR = 30, n = Math.max(1, filas.length), an = (W - 2 * IZQ) / n;
  const maxV = Math.max(1, ...filas.map(f => +f.vistas));
  const graf = filas.length ? `<svg viewBox="0 0 ${W} ${H}" width="100%" class="g-svg">${filas.map((f, i) => {
      const x = IZQ + i * an, h = Math.max(3, +f.vistas / maxV * (H - ABA - ARR));
      return `<rect x="${x + an * .2}" y="${H - ABA - h}" width="${an * .6}" height="${h}" rx="4" fill="${f === mejorDia ? '#db2777' : '#f9a8d4'}"><title>${fdia(f.fecha)} · ${num(+f.vistas)} vistas acumuladas${f.gv != null ? ` · ${f.gv >= 0 ? '+' : ''}${num(f.gv)} ese día` : ''}</title></rect>
        <text x="${x + an / 2}" y="${H - ABA - h - 16}" font-size="10.5" font-weight="800" fill="#9d174d" text-anchor="middle">${num(+f.vistas)}</text>
        ${f.gv != null ? `<text x="${x + an / 2}" y="${H - ABA - h - 4}" font-size="9.5" font-weight="700" fill="${f.gv > 0 ? '#059669' : '#9ca3af'}" text-anchor="middle">${f.gv > 0 ? '+' : ''}${num(f.gv)}</text>` : ''}
        <text x="${x + an / 2}" y="${H - 9}" font-size="9.5" fill="#6b7280" text-anchor="middle">${fdia(f.fecha)}</text>`;
    }).join('')}<line x1="${IZQ}" x2="${W - IZQ}" y1="${H - ABA}" y2="${H - ABA}" stroke="#e5e7eb"/></svg>` : '';
  return `
    <div class="sec-title" style="margin-top:6px">Evolución por día <small>${dias.length} día(s) registrados</small></div>
    ${dias.length ? `<div class="ev-res">
        <div><small>Ritmo medio</small><b>${ritmo == null ? '—' : num(Math.round(ritmo))}</b><em>vistas por día</em></div>
        <div><small>Mejor día</small><b>${mejorDia ? '+' + num(mejorDia.gv) : '—'}</b><em>${mejorDia ? fdia(mejorDia.fecha) : 'falta un día más'}</em></div>
        <div><small>Último día</small><b>${ganadas.length ? sg(ganadas.at(-1).gv) : '—'}</b><em>${ganadas.length ? fdia(ganadas.at(-1).fecha) : ''}</em></div>
        <div><small>Días publicado</small><b>${v.publicado_en ? Math.max(0, Math.floor(diasDesde(v.publicado_en))) : '—'}</b><em>${v.publicado_en ? new Date(v.publicado_en).toLocaleDateString('es-PE') : ''}</em></div>
      </div>${graf}
      <div class="scroll"><table class="ev-tabla"><thead><tr><th>Día</th><th>Vistas</th><th>Ganadas</th><th>Likes</th><th>Δ</th><th>Coment.</th><th>Δ</th><th>Compart.</th><th>Δ</th></tr></thead><tbody>
        ${[...filas].reverse().map(f => `<tr><td><b>${fdia(f.fecha)}</b></td><td>${num(+f.vistas)}</td><td>${sg(f.gv)}</td><td>${num(+f.likes)}</td><td>${sg(f.gl)}</td><td>${num(+f.comentarios)}</td><td>${sg(f.gc)}</td><td>${num(+f.compartidos)}</td><td>${sg(f.gs)}</td></tr>`).join('')}
      </tbody></table></div>`
      : '<p class="vacio" style="padding:14px">Aún no hay registros diarios de este video.</p>'}
    <div class="sec-title" style="margin-top:14px">Hoy por hora</div>
    <div id="ficha-horas" data-id="${esc(v.video_id)}"><div class="spin"></div></div>`;
}

// Carga las fotos por hora de hoy y dibuja las vistas ganadas por hora del video abierto
async function pintarHorasFicha() {
  const cont = document.getElementById('ficha-horas');
  if (!cont) return;
  const id = cont.dataset.id, hoy = hoyLima();
  try {
    if (!estado.horas[hoy]) estado.horas[hoy] = await api('/tiktok/horas?fecha=' + hoy);
    const s = (estado.horas[hoy].videos || []).filter(r => r.video_id === id);
    const out = Array(24).fill(null), det = Array(24).fill(null);
    s.forEach((r, i) => {
      if (r.hora.slice(0, 10) !== hoy) return;
      const h = +r.hora.slice(11, 13), p = s[i - 1];
      const ph = p ? (p.hora.slice(0, 10) < hoy ? -1 : +p.hora.slice(11, 13)) : null;
      const ref = p && ph === h - 1 ? p : (r.vistas_ini != null ? { vistas: r.vistas_ini, likes: r.likes_ini, comentarios: r.comentarios_ini, compartidos: r.compartidos_ini } : null);
      if (!ref) { out[h] = 0; return; }
      out[h] = +r.vistas - +ref.vistas;
      det[h] = { l: +r.likes - +ref.likes, c: +r.comentarios - +ref.comentarios, s: +r.compartidos - +ref.compartidos };
    });
    const total = out.reduce((a, x) => a + (x || 0), 0), pico = out.reduce((a, x, h) => (x > (a.v ?? 0) ? { h, v: x } : a), {});
    const conDatos = out.map((x, h) => [h, x]).filter(([, x]) => x != null);
    cont.innerHTML = conDatos.length ? `${barras24(out, '#db2777', ' vistas')}
      <p class="sub" style="font-size:12px">Hoy: <b>+${num(total)} vistas</b>${pico.v ? ` · hora pico <b>${String(pico.h).padStart(2, '0')}:00</b> (+${num(pico.v)})` : ''}${det.some(d => d && (d.l || d.c || d.s)) ? ' · ' + det.map((d, h) => d && (d.l || d.c || d.s) ? `${String(h).padStart(2, '0')}h: ${[d.l ? (d.l > 0 ? '+' : '') + d.l + ' likes' : '', d.c ? (d.c > 0 ? '+' : '') + d.c + ' coment.' : '', d.s ? (d.s > 0 ? '+' : '') + d.s + ' compart.' : ''].filter(Boolean).join(', ')}` : '').filter(Boolean).join(' · ') : ''}</p>`
      : '<p class="vacio" style="padding:10px">Aún no hay fotos por hora de este video hoy.</p>';
  } catch (e) { cont.innerHTML = `<p class="vacio" style="padding:10px">${esc(e.message)}</p>`; }
}
