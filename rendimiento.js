/* ============================================================
   OCM — Rendimiento (detallado): qué contenido y en qué momento
   funciona mejor. Reemplaza a la vista original de index.html.
   ============================================================ */

function vRendimientoDet() {
  const v = estado.datos.videos.filter(x => x.publicado_en);
  if (!v.length) return '<section class="card panel"><p class="vacio">El análisis aparece cuando haya videos sincronizados.</p></section>';
  const m = metricas(), T = m.t, inter = T.likes + T.com + T.sh;
  const vistas = v.map(x => +x.vistas), med = mediana(vistas) || 1, media = T.vistas / v.length;
  const sobre = v.filter(x => +x.vistas >= med).length;
  const lima = d => new Date(new Date(d).getTime() - 5 * 36e5);
  const titulo = x => esc((x.titulo || 'Sin título').replace(/\*\*/g, '').slice(0, 48));
  const tasa = x => (+x.vistas ? (+x.likes + +x.comentarios + +x.compartidos) / +x.vistas * 100 : 0);
  const pctS = (a, b) => (b ? (a / b * 100).toFixed(1) : '0.0');

  // Agrupa videos y resume: cantidad, vistas medias y medianas, interacción, mejor video
  const resumir = (grupos) => grupos.map(([et, g]) => {
    const vis = g.reduce((a, x) => a + +x.vistas, 0), it = g.reduce((a, x) => a + +x.likes + +x.comentarios + +x.compartidos, 0);
    const mejor = g.reduce((a, x) => (+x.vistas > +(a?.vistas || -1) ? x : a), null);
    return { et, n: g.length, media: g.length ? vis / g.length : 0, med: g.length ? mediana(g.map(x => +x.vistas)) : 0, tasa: vis ? it / vis * 100 : 0, mejor };
  });
  const tablaGrupos = (filas, nombreCol) => {
    const conVid = filas.filter(f => f.n), mejorF = conVid.filter(f => f.n >= 2).sort((a, b) => b.med - a.med)[0] || conVid.sort((a, b) => b.med - a.med)[0];
    const maxMed = Math.max(1, ...filas.map(f => f.med));
    return `<div class="scroll"><table class="rd-tabla"><thead><tr><th>${nombreCol}</th><th>Videos</th><th>Vistas medianas</th><th></th><th>Media</th><th>Interacción</th><th>Mejor video</th></tr></thead><tbody>
      ${filas.map(f => `<tr class="${f === mejorF ? 'rd-mejor' : ''} ${!f.n ? 'rd-vacio' : ''}"><td><b>${f.et}</b>${f === mejorF ? ' <span class="st-tag">mejor</span>' : ''}</td><td>${f.n}</td><td><b>${f.n ? num(Math.round(f.med)) : '—'}</b></td>
        <td style="min-width:90px"><div class="st-barra"><i style="width:${(f.med / maxMed * 100).toFixed(1)}%;background:${f === mejorF ? '#10b981' : '#f9a8d4'}"></i></div></td>
        <td>${f.n ? num(Math.round(f.media)) : '—'}</td><td>${f.n ? f.tasa.toFixed(2) + ' %' : '—'}</td>
        <td>${f.mejor ? `<a href="#" data-video="${esc(f.mejor.video_id)}">${titulo(f.mejor)}</a> <small class="sub">${num(+f.mejor.vistas)}</small>` : '—'}</td></tr>`).join('')}
    </tbody></table></div>`;
  };

  // Día de la semana (Lima) y franja horaria de publicación
  const DS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const porDiaD = resumir([1, 2, 3, 4, 5, 6, 0].map(d => [DS[d], v.filter(x => lima(x.publicado_en).getUTCDay() === d)]));
  const FR = [['Madrugada (0–6 h)', 0, 6], ['Mañana (6–12 h)', 6, 12], ['Tarde (12–18 h)', 12, 18], ['Noche (18–24 h)', 18, 24]];
  const porFranja = resumir(FR.map(([et, a, b]) => [et, v.filter(x => { const h = lima(x.publicado_en).getUTCHours(); return h >= a && h < b; })]));
  const DUR = [['Menos de 15 s', 0, 15], ['15 a 30 s', 15, 31], ['31 a 60 s', 31, 61], ['1 a 2 min', 61, 121], ['Más de 2 min', 121, 1e9]];
  const porDur = resumir(DUR.map(([et, a, b]) => [et, v.filter(x => +x.duracion >= a && +x.duracion < b)])).filter(f => f.n || f.et !== 'Más de 2 min');
  const meses = [...new Set(v.map(x => lima(x.publicado_en).toISOString().slice(0, 7)))].sort();
  const porMes = resumir(meses.map(k => [new Date(k + '-15').toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }), v.filter(x => lima(x.publicado_en).toISOString().slice(0, 7) === k)])).reverse();

  // Últimos 12 videos: barra de vistas, color según la mediana, interacción y línea de la mediana
  const ult = [...v].sort((a, b) => new Date(a.publicado_en) - new Date(b.publicado_en)).slice(-12);
  const W = 640, H = 250, IZQ = 10, ABA = 34, ARR = 34, n = ult.length, an = (W - 2 * IZQ) / n;
  const maxU = Math.max(1, ...ult.map(x => +x.vistas)), yM = H - ABA - Math.min(1, med / maxU) * (H - ABA - ARR);
  const grafUlt = `<svg viewBox="0 0 ${W} ${H}" width="100%" class="g-svg">
    <line x1="${IZQ}" x2="${W - IZQ}" y1="${yM}" y2="${yM}" stroke="#94a3b8" stroke-dasharray="5 4"/>
    ${ult.map((x, i) => { const px = IZQ + i * an, h = Math.max(3, +x.vistas / maxU * (H - ABA - ARR)), arriba = +x.vistas >= med;
      return `<rect x="${px + an * .14}" y="${H - ABA - h}" width="${an * .72}" height="${h}" rx="4" fill="${arriba ? '#db2777' : '#f9a8d4'}" data-video="${esc(x.video_id)}" style="cursor:pointer"><title>${titulo(x)}\n${num(+x.vistas)} vistas · ${tasa(x).toFixed(1)} % interacción · ${x.duracion || '?'} s\n${lima(x.publicado_en).toISOString().slice(0, 16).replace('T', ' ')} (Lima) · clic para abrir</title></rect>
        <text x="${px + an / 2}" y="${H - ABA - h - 16}" font-size="10.5" font-weight="800" fill="#9d174d" text-anchor="middle">${corto(+x.vistas)}</text>
        ${+x.vistas ? `<text x="${px + an / 2}" y="${H - ABA - h - 5}" font-size="9" font-weight="700" fill="${tasa(x) >= 4 ? '#059669' : '#9ca3af'}" text-anchor="middle">${tasa(x).toFixed(1)} %</text>` : ""}
        <text x="${px + an / 2}" y="${H - 18}" font-size="9.5" fill="#6b7280" text-anchor="middle">${fdia(lima(x.publicado_en).toISOString().slice(0, 10))}</text>
        <text x="${px + an / 2}" y="${H - 6}" font-size="8.5" fill="#9ca3af" text-anchor="middle">${x.duracion ? x.duracion + ' s' : ''}</text>`; }).join('')}
  </svg>`;

  // Composición de la interacción
  const comp = [['Likes', T.likes, '#e11d48'], ['Comentarios', T.com, '#059669'], ['Compartidos', T.sh, '#d97706']];
  const composicion = `<div class="rd-pila">${comp.map(([, val, c]) => `<i style="width:${pctS(val, inter)}%;background:${c}"></i>`).join('')}</div>
    <div class="scroll"><table class="rd-tabla"><thead><tr><th>Tipo</th><th>Total</th><th>% del total</th><th>Por cada 1 000 vistas</th><th>Promedio por video</th></tr></thead><tbody>
      ${comp.map(([et, val, c]) => `<tr><td><b style="color:${c}">● ${et}</b></td><td><b>${num(val)}</b></td><td>${pctS(val, inter)} %</td><td>${(val / (T.vistas || 1) * 1000).toFixed(1)}</td><td>${(val / v.length).toFixed(1)}</td></tr>`).join('')}
      <tr class="st-total"><td><b>Total</b></td><td><b>${num(inter)}</b></td><td>100 %</td><td>${(inter / (T.vistas || 1) * 1000).toFixed(1)}</td><td>${(inter / v.length).toFixed(1)}</td></tr>
    </tbody></table></div>`;

  // Mejores y peores videos
  const orden = [...v].sort((a, b) => +b.vistas - +a.vistas);
  const filaTop = (x, i) => `<tr><td><b>#${i}</b></td><td><a href="#" data-video="${esc(x.video_id)}">${titulo(x)}</a><br><small class="sub">${fdia(lima(x.publicado_en).toISOString().slice(0, 10))} · ${x.duracion || '?'} s</small></td><td><b>${num(+x.vistas)}</b></td><td>${(+x.vistas / med).toFixed(1)}×</td><td>${tasa(x).toFixed(1)} %</td></tr>`;
  const cabTop = '<thead><tr><th></th><th>Video</th><th>Vistas</th><th>vs. mediana</th><th>Interacción</th></tr></thead>';

  return `
    <section class="grid g3" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      ${kpi('Likes por cada 100 vistas', (pct(T.likes, T.vistas)).toFixed(1), '<div class="delta eq">aprobación · referencia ≈ 5</div>', 'i-heart', '#e11d48')}
      ${kpi('Comentarios por cada 1 000 vistas', (T.com / (T.vistas || 1) * 1000).toFixed(1), '<div class="delta eq">conversación · referencia ≈ 5</div>', 'i-msg', '#059669')}
      ${kpi('Compartidos por cada 1 000 vistas', (T.sh / (T.vistas || 1) * 1000).toFixed(1), '<div class="delta eq">viralidad · referencia ≈ 5</div>', 'i-share', '#d97706')}
      ${kpi('Interacción total', pctS(inter, T.vistas) + ' %', `<div class="delta eq">${num(inter)} interacciones en ${num(T.vistas)} vistas</div>`, 'i-zap', '#7c3aed')}
      ${kpi('Vistas por video', num(Math.round(med)), `<div class="delta eq">mediana · media ${num(Math.round(media))}</div>`, 'i-eye', '#0891b2')}
      ${kpi('Videos sobre la mediana', `${sobre} de ${v.length}`, `<div class="delta eq">${Math.round(sobre / v.length * 100)} % rinden por encima de lo normal</div>`, 'i-trend', '#059669')}
    </section>
    <section class="card panel" style="margin-bottom:16px"><div class="sec-title">Vistas de los últimos ${ult.length} videos <small>número rosa: vistas · verde/gris: % de interacción</small></div>${grafUlt}
      <p class="sub" style="font-size:12px"><span style="color:#db2777">■</span> sobre la mediana · <span style="color:#f9a8d4">■</span> bajo la mediana · <span style="color:#94a3b8">┄</span> mediana de la cuenta: ${num(Math.round(med))} vistas · debajo: fecha y duración · toca una barra para abrir el video.</p></section>
    <section class="grid g2">
      <div class="card panel"><div class="sec-title">Composición de la interacción</div>${composicion}</div>
      <div class="card panel"><div class="sec-title">Mejores y peores videos</div>
        <p class="st-sub">🏆 Los 5 con más vistas</p><div class="scroll"><table class="rd-tabla">${cabTop}<tbody>${orden.slice(0, 5).map((x, i) => filaTop(x, i + 1)).join('')}</tbody></table></div>
        <p class="st-sub" style="margin-top:12px">⚠️ Los 5 con menos vistas</p><div class="scroll"><table class="rd-tabla">${cabTop}<tbody>${orden.slice(-5).reverse().map((x, i) => filaTop(x, orden.length - i)).join('')}</tbody></table></div></div>
    </section>
    <section class="card panel" style="margin-bottom:16px"><div class="sec-title">Por día de publicación <small>hora de Lima</small></div>${tablaGrupos(porDiaD, 'Día')}</section>
    <section class="grid g2">
      <div class="card panel"><div class="sec-title">Por hora de publicación</div>${tablaGrupos(porFranja, 'Franja')}</div>
      <div class="card panel"><div class="sec-title">Por duración del video</div>${tablaGrupos(porDur, 'Duración')}</div>
    </section>
    <section class="card panel"><div class="sec-title">Por mes de publicación</div>${tablaGrupos(porMes, 'Mes')}</section>`;
}
