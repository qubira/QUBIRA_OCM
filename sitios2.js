/* ============================================================
   OCM — Sitios web: análisis adicional (comparación con el periodo
   anterior, calidad de visitas, nuevos/recurrentes, recorrido,
   mapa de calor, últimas visitas y exportación CSV).
   Usa sit, dur, listaBarras (sitios.js) y las globales de index.html.
   ============================================================ */

const DIAS_SEM = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const IDIOMAS = { es: 'Español', en: 'Inglés', pt: 'Portugués', fr: 'Francés', de: 'Alemán', it: 'Italiano', zh: 'Chino' };

function deltaSit(act, ant, fmt = num) {
  act = +act || 0; ant = +ant || 0;
  if (!ant && !act) return '<span class="sub">—</span>';
  if (!ant) return '<span class="st-d sube">nuevo</span>';
  const p = (act - ant) / ant * 100;
  return `<span class="st-d ${p > 0 ? 'sube' : p < 0 ? 'baja' : 'igual'}">${p > 0 ? '▲' : p < 0 ? '▼' : '='} ${Math.abs(p).toFixed(0)} %</span> <small class="sub">antes ${fmt(ant)}</small>`;
}

function filaPct(etq, n, total, color) {
  return `<div class="st-fila"><span>${etq}</span><span class="st-barra"><i style="width:${(n / total * 100).toFixed(1)}%;background:${color}"></i></span><b>${num(n)}</b><small>${Math.round(n / total * 100)} %</small></div>`;
}

function seccionesSitio(d) {
  const t = d.total || {}, p = d.prev || {}, r = d.recurrentes || {};
  const periodoAnt = sit.rango === 'hoy' ? 'ayer a la misma hora' : sit.rango === 'dia' ? 'el día anterior' : `los ${sit.rango} días anteriores`;
  const calor = {}; let maxC = 1;
  for (const c of d.calor || []) { calor[c.d + '-' + c.h] = +c.n; maxC = Math.max(maxC, +c.n); }
  const totDur = (d.duraciones || []).reduce((a, x) => a + +x.visitas, 0) || 1;
  const totProf = (d.profundidad || []).reduce((a, x) => a + +x.visitas, 0) || 1;
  const nuevos = +r.nuevos || 0, rec = +r.recurrentes || 0, totNR = nuevos + rec || 1;
  const nombre = k => (d.sitios?.[k]?.nombre || k);
  const colorDur = x => (/0–10/.test(x) ? '#f87171' : /10–30|30–60/.test(x) ? '#fbbf24' : '#10b981');
  const hh = h => String(h).padStart(2, '0');

  const comparacion = `<section class="card panel" style="margin-bottom:16px"><div class="sec-title">Comparado con ${periodoAnt}</div>
    <div class="st-comp">
      <div><small>Visitantes</small><b>${num(+t.visitantes || 0)}</b>${deltaSit(t.visitantes, p.visitantes)}</div>
      <div><small>Visitas</small><b>${num(+t.sesiones || 0)}</b>${deltaSit(t.sesiones, p.sesiones)}</div>
      <div><small>Páginas vistas</small><b>${num(+t.vistas || 0)}</b>${deltaSit(t.vistas, p.vistas)}</div>
      <div><small>Tiempo activo</small><b>${dur(t.segundos)}</b>${deltaSit(t.segundos, p.segundos, dur)}</div>
      <div><small>Clics</small><b>${num(+t.clics || 0)}</b>${deltaSit(t.clics, p.clics)}</div>
    </div></section>`;

  const calidad = `<div class="card panel"><div class="sec-title">Calidad de las visitas</div>
      <p class="st-sub">⏱ Cuánto tiempo se quedan</p>
      ${(d.duraciones || []).length ? `<div class="st-lista">${d.duraciones.map(x => filaPct(esc(x.rango), +x.visitas, totDur, colorDur(x.rango))).join('')}</div>` : '<p class="vacio">Sin datos aún.</p>'}
      <p class="st-sub" style="margin-top:14px">📄 Cuántas páginas ven por visita</p>
      ${(d.profundidad || []).length ? `<div class="st-lista">${d.profundidad.map(x => filaPct(+x.paginas >= 6 ? '6 o más' : x.paginas + (+x.paginas === 1 ? ' página' : ' páginas'), +x.visitas, totProf, '#6366f1')).join('')}</div>` : ''}
    </div>`;

  const fidelidad = `<div class="card panel"><div class="sec-title">Nuevos y que regresan</div>
      <div class="st-nr"><div><b style="color:#4f46e5">${num(nuevos)}</b><small>visitantes nuevos</small></div><div><b style="color:#059669">${num(rec)}</b><small>regresaron</small></div><div><b>${(+r.visitas_por_visitante || 0).toFixed(1)}</b><small>visitas por persona</small></div></div>
      <div class="st-split"><i style="width:${(nuevos / totNR * 100).toFixed(1)}%;background:#4f46e5"></i><i style="width:${(rec / totNR * 100).toFixed(1)}%;background:#10b981"></i></div>
      <p class="sub" style="font-size:12px;margin-top:8px">${rec ? `${Math.round(rec / totNR * 100)} % de los visitantes ya había entrado antes: el sitio genera interés para volver.` : 'Aún nadie ha regresado en este periodo.'}</p>
      <p class="st-sub" style="margin-top:14px">🌐 Idiomas del navegador</p>
      ${listaBarras((d.idiomas || []).map(x => ({ ...x, idioma: IDIOMAS[x.idioma] || x.idioma })), 'idioma', 'visitantes', num, '#0d9488')}
    </div>`;

  const tablaMini = (filas, celdas) => (filas.length ? `<table class="st-mini"><tbody>${filas.map(celdas).join('')}</tbody></table>` : '<p class="vacio">Sin datos.</p>');
  const recorrido = `<section class="card panel" style="margin-bottom:16px"><div class="sec-title">Recorrido de los visitantes</div>
    <div class="st-tres">
      <div><p class="st-sub">🚪 Por dónde entran</p>${tablaMini(d.entradas || [], x => `<tr><td class="tt">${esc(x.ruta)}</td><td><b>${num(+x.visitas)}</b></td><td><small class="${+x.rebote >= 70 ? 'st-mal' : 'sub'}">${x.rebote} % rebote</small></td></tr>`)}</div>
      <div><p class="st-sub">🏃 Por dónde se van</p>${tablaMini(d.salidas || [], x => `<tr><td class="tt">${esc(x.ruta)}</td><td><b>${num(+x.salidas)}</b></td><td><small class="${+x.tasa >= 70 ? 'st-mal' : 'sub'}">${x.tasa} % sale aquí</small></td></tr>`)}</div>
      <div><p class="st-sub">🔀 De qué página pasan a cuál</p>${(d.flujos || []).length ? tablaMini(d.flujos, x => `<tr><td class="tt">${esc(x.desde)} <span class="sub">→</span> ${esc(x.hacia)}</td><td><b>${num(+x.veces)}</b></td></tr>`) : '<p class="vacio">Aún nadie pasó de una página a otra.</p>'}</div>
    </div></section>`;

  const mapa = `<section class="card panel" style="margin-bottom:16px"><div class="sec-title">Mapa de calor <small>visitas por día de la semana y hora</small></div>
    <div class="scroll"><table class="st-calor"><thead><tr><th></th>${Array.from({ length: 24 }, (_, h) => `<th>${h % 3 === 0 ? hh(h) : ''}</th>`).join('')}</tr></thead><tbody>
      ${DIAS_SEM.map((dn, i) => `<tr><th>${dn}</th>${Array.from({ length: 24 }, (_, h) => { const n = calor[(i + 1) + '-' + h] || 0;
        return `<td style="background:${n ? `rgba(79,70,229,${(0.18 + 0.82 * n / maxC).toFixed(2)})` : '#f8fafc'}" title="${dn} ${hh(h)}:00 · ${n} visita(s)">${n || ''}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div></section>`;

  const rec_ = d.recientes || [];
  const recientes = `<section class="card panel" style="margin-bottom:16px"><div class="sec-title">Últimas visitas <small>${rec_.length} más recientes</small>
      <button class="btn btn-sec btn-mini" id="st-csv" style="margin-left:auto">Descargar CSV</button></div>
    ${rec_.length ? `<div class="scroll vh-scroll" style="max-height:440px"><table class="st-rec"><thead><tr><th>Hora</th>${!sit.sitio ? '<th>Sitio</th>' : ''}<th>Recorrido</th><th>Páginas</th><th>Tiempo</th><th>Clics</th><th>Origen</th><th>País</th><th>Dispositivo</th></tr></thead><tbody>
      ${rec_.map(x => `<tr><td>${x.en_linea ? '<span class="st-online" title="En línea ahora">●</span> ' : ''}<b>${esc(x.hora)}</b></td>${!sit.sitio ? `<td>${esc(nombre(x.sitio))}</td>` : ''}
        <td class="tt">${esc(x.entrada || '—')}${x.salida && x.salida !== x.entrada ? ` <span class="sub">→ … →</span> ${esc(x.salida)}` : ''}</td><td>${num(+x.paginas)}</td><td>${dur(x.seg)}</td><td>${num(+x.clics)}</td>
        <td>${esc(x.origen || 'Directo')}</td><td>${esc(x.pais || '—')}</td><td>${esc(x.dispositivo || '—')} <small class="sub">${esc(x.navegador || '')}</small></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="vacio">Sin visitas en este periodo.</p>'}
  </section>`;

  // Embudo del cotizador (solo aparece si el sitio tiene cotizador y hay datos)
  const cot = d.cotizador || [];
  let embudo = '';
  if (cot.length) {
    const pasos = cot.filter(x => /^Cotizador · \d/.test(x.etiqueta))
      .map(x => ({ n: x.etiqueta.replace('Cotizador · ', '').replace(/^\d+ /, ''), v: +x.visitas, o: +x.etiqueta.match(/\d+/)[0] }))
      .sort((p, q) => p.o - q.o);
    const pide = cot.filter(x => x.etiqueta.startsWith('Cotizador · Pide: '))
      .map(x => ({ tipo: x.etiqueta.replace('Cotizador · Pide: ', ''), visitas: +x.visitas })).sort((p, q) => q.visitas - p.visitas);
    const base = (pasos[0] && pasos[0].v) || 1;
    const env = pasos.find(p => /Enviado/.test(p.n));
    const enviados = env ? env.v : 0;
    const filas = pasos.map((p, i) => {
      const prev = pasos[i - 1], caida = prev ? Math.round((1 - p.v / Math.max(1, prev.v)) * 100) : 0;
      return '<div class="st-fila"><span>' + esc(p.n) + '</span><span class="st-barra"><i style="width:' + (p.v / base * 100).toFixed(1) + '%;background:' + (/Enviado/.test(p.n) ? '#10b981' : '#4f46e5') + '"></i></span><b>' + num(p.v) + '</b><small style="color:#dc2626">' + (prev && caida > 0 ? '−' + caida + ' %' : '') + '</small></div>';
    }).join('');
    embudo = '<section class="card panel" style="margin-bottom:16px"><div class="sec-title">Embudo del cotizador <small>' + num(base) + ' lo abrieron · ' + num(enviados) + ' enviaron su cotización (' + Math.round(enviados / base * 100) + ' %)</small></div>' +
      '<div class="grid g2" style="margin:0"><div><div class="st-lista">' + filas + '</div><p class="sub" style="font-size:12px;margin-top:8px">En rojo: cuántos abandonaron respecto al paso anterior.</p></div>' +
      '<div><p class="st-sub">🧩 Qué piden más</p>' + (pide.length ? listaBarras(pide, 'tipo', 'visitas', num, '#db2777') : '<p class="vacio">Aún nadie envió una cotización en este periodo.</p>') + '</div></div></section>';
  }
  return comparacion + embudo + `<section class="grid g2">${calidad}${fidelidad}</section>` + recorrido + mapa + recientes;
}

// Descarga CSV: últimas visitas y páginas del periodo
document.addEventListener('click', e => {
  if (!e.target.closest('#st-csv') || !sit.datos) return;
  const d = sit.datos, c = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = [['Últimas visitas'], ['Hora', 'Sitio', 'Entrada', 'Salida', 'Páginas', 'Segundos', 'Clics', 'Origen', 'País', 'Dispositivo', 'Navegador'],
    ...(d.recientes || []).map(x => [x.hora, d.sitios?.[x.sitio]?.nombre || x.sitio, x.entrada, x.salida, x.paginas, x.seg, x.clics, x.origen, x.pais, x.dispositivo, x.navegador]),
    [], ['Páginas'], ['Ruta', 'Título', 'Vistas', 'Visitantes', 'Segundos activos'], ...(d.paginas || []).map(p => [p.ruta, p.titulo, p.vistas, p.visitantes, p.segundos])];
  const blob = new Blob(['﻿' + filas.map(f => f.map(c).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sitios_${sit.sitio || 'todos'}_${sit.rango}.csv`; a.click();
});
