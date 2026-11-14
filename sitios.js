/* ============================================================
   OCM — Sitios web de clientes: visitas, tiempo, interacción y
   conexiones por hora / día / mes. Datos del contador central
   (/api/ocm/sitios). Usa las constantes globales de index.html.
   ============================================================ */

const sit = { sitio: '', rango: 'hoy', fecha: '', datos: null, cargando: false, clave: '' };

function claveSit() { return `${sit.sitio}|${sit.rango}|${sit.fecha}`; }
async function cargarSitios(forzar) {
  const k = claveSit();
  if (sit.cargando || (!forzar && sit.datos && sit.clave === k)) return;
  sit.cargando = true;
  try {
    const q = new URLSearchParams({ rango: sit.rango });
    if (sit.sitio) q.set('sitio', sit.sitio);
    if (sit.rango === 'dia') q.set('fecha', sit.fecha || hoyLima());
    sit.datos = await api('/sitios/resumen?' + q); sit.clave = k;
  } catch (e) { sit.datos = { error: e.message }; sit.clave = k; }
  sit.cargando = false;
  if (estado.vista === 'sitios') repintarSeguro();
}
// Se actualiza solo cada minuto mientras la vista está abierta
setInterval(() => { if (estado.vista === 'sitios' && !document.hidden) cargarSitios(true); }, 60000);

const dur = s => { s = Math.round(+s || 0); return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${Math.floor(s / 3600)} h ${Math.floor(s % 3600 / 60)} min`; };

function barrasSerie(serie, rango) {
  if (!serie.length) return '<p class="vacio">Sin visitas en este periodo.</p>';
  const porHora = rango === 'hoy' || rango === 'dia';
  let filas = serie;
  if (porHora) { const m = Object.fromEntries(serie.map(s => [s.t, s])); filas = Array.from({ length: 24 }, (_, h) => { const t = String(h).padStart(2, '0') + ':00'; return m[t] || { t, vistas: 0, visitantes: 0, segundos: 0, clics: 0, vacio: true }; }); }
  const W = 720, H = 220, IZQ = 8, ABA = 30, ARR = 24, n = filas.length, ancho = (W - 2 * IZQ) / n;
  const max = Math.max(1, ...filas.map(f => +f.vistas));
  const et = t => porHora ? t.slice(0, 2) + 'h' : t.length === 7 ? new Date(t + '-15').toLocaleDateString('es-PE', { month: 'short' }) : fdia(t);
  const cada = Math.max(1, Math.ceil(n / 12));
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" class="g-svg" role="img">
    ${filas.map((f, i) => {
      const x = IZQ + i * ancho, v = +f.vistas, u = +f.visitantes, alto = v ? Math.max(3, v / max * (H - ABA - ARR)) : 0, altoU = u ? Math.max(2, u / max * (H - ABA - ARR)) : 0;
      return `<rect x="${x + ancho * .12}" y="${H - ABA - alto}" width="${ancho * .76}" height="${alto}" rx="3" fill="#c7d2fe"><title>${f.t} · ${num(v)} páginas vistas · ${num(u)} visitantes · ${dur(f.segundos)} activos · ${num(+f.clics)} clics</title></rect>
        <rect x="${x + ancho * .3}" y="${H - ABA - altoU}" width="${ancho * .4}" height="${altoU}" rx="2" fill="#4f46e5" pointer-events="none"/>
        ${v && n <= 31 ? `<text x="${x + ancho / 2}" y="${H - ABA - alto - 5}" font-size="10" font-weight="700" fill="#4338ca" text-anchor="middle">${num(v)}</text>` : ''}
        ${i % cada === 0 || i === n - 1 ? `<text x="${x + ancho / 2}" y="${H - 10}" font-size="9.5" fill="#9ca3af" text-anchor="middle">${et(f.t)}</text>` : ''}`;
    }).join('')}
    <line x1="${IZQ}" x2="${W - IZQ}" y1="${H - ABA}" y2="${H - ABA}" stroke="#e5e7eb"/>
  </svg>
  <p class="sub" style="font-size:12px"><span style="color:#a5b4fc">■</span> páginas vistas · <span style="color:#4f46e5">■</span> visitantes únicos · pasa el mouse por cada barra para ver el detalle</p>`;
}

function listaBarras(filas, etiqueta, valor, fmt = num, color = '#4f46e5') {
  if (!filas.length) return '<p class="vacio">Sin datos aún.</p>';
  const max = Math.max(1, ...filas.map(f => +f[valor]));
  const total = filas.reduce((a, f) => a + +f[valor], 0) || 1;
  return `<div class="st-lista">${filas.map(f => `<div class="st-fila"><span class="tt" title="${esc(f[etiqueta] || '—')}">${esc(f[etiqueta] || '—')}</span>
    <span class="st-barra"><i style="width:${(+f[valor] / max * 100).toFixed(1)}%;background:${color}"></i></span><b>${fmt(+f[valor])}</b><small>${Math.round(+f[valor] / total * 100)} %</small></div>`).join('')}</div>`;
}

function vSitios() {
  const d = sit.datos;
  if (!d || sit.clave !== claveSit()) cargarSitios();
  const nombres = d?.sitios || {};
  const chips = `<div class="st-chips"><button data-st="" class="${!sit.sitio ? 'on' : ''}">Todos</button>${Object.entries(nombres).map(([k, s]) => {
    const vivo = (d?.enVivo || []).find(x => x.sitio === k);
    return `<button data-st="${k}" class="${sit.sitio === k ? 'on' : ''}">${esc(s.nombre)}${vivo ? ` <i class="st-vivo">${vivo.n}</i>` : ''}</button>`;
  }).join('')}</div>`;
  const ops = [['hoy', 'Hoy'], ['dia', 'Día'], ['7', '7 días'], ['30', '30 días'], ['90', '90 días'], ['365', 'Año']];
  const filtro = `<span class="seg seg-rango" id="st-rango">${ops.map(([k, t]) => `<button data-sr="${k}" class="${sit.rango === k ? 'on' : ''}">${t}</button>`).join('')}${sit.rango === 'dia' ? `<input type="date" id="st-dia" class="rango-dia" value="${sit.fecha || hoyLima()}" max="${hoyLima()}">` : ''}</span>`;
  const cab = `<section class="card panel" style="margin-bottom:16px"><div class="sec-title">Sitios de clientes ${filtro}</div>${chips}</section>`;
  if (!d || sit.clave !== claveSit()) return cab + '<div class="spin"></div>';
  if (d.error) return cab + `<div class="card panel"><p class="vacio">${esc(d.error)}</p></div>`;
  const t = d.total || {}, s = d.sesion || {};
  const visitas = +s.n || 0, rebote = visitas ? Math.round(+s.rebote / visitas * 100) : 0;
  const vivoTotal = (d.enVivo || []).reduce((a, x) => a + +x.n, 0);
  const sitioInfo = sit.sitio ? nombres[sit.sitio] : null;
  const porHora = sit.rango === 'hoy' || sit.rango === 'dia';
  const titSerie = porHora ? 'Conexiones por hora' : sit.rango === '365' ? 'Visitas por mes' : 'Visitas por día';
  const horas = Array.from({ length: 24 }, (_, h) => ({ h: String(h).padStart(2, '0') + ':00', sesiones: +((d.horas || []).find(x => +x.h === h)?.sesiones || 0) }));
  const horaPico = horas.reduce((a, x) => (x.sesiones > a.sesiones ? x : a), { sesiones: 0 });
  const sinDatos = !+t.vistas && !visitas;
  return cab + `
    ${sitioInfo ? `<p class="sub" style="margin:-6px 0 14px">🌐 <a href="${esc(sitioInfo.url)}" target="_blank" rel="noopener">${esc(sitioInfo.url.replace('https://', ''))}</a></p>` : ''}
    ${sinDatos ? `<div class="card panel" style="margin-bottom:16px"><p class="vacio">Aún no hay visitas registradas en este periodo. El contador empieza a sumar desde que cada sitio se publica con el script de QUBIRA.</p></div>` : ''}
    <section class="grid g4">
      ${kpi('Visitantes únicos', num(+t.visitantes || 0), `<div class="delta eq">${num(+s.nuevas || 0)} visitas de personas nuevas</div>`, 'i-users', '#4f46e5')}
      ${kpi('Visitas (sesiones)', num(visitas), `<div class="delta eq">${num(+t.vistas || 0)} páginas vistas · ${(+s.paginas_medias || 0).toFixed(1)} por visita</div>`, 'i-eye', '#0891b2')}
      ${kpi('Tiempo medio por visita', dur(s.seg_medio), `<div class="delta eq">${dur(t.segundos)} de tiempo activo en total</div>`, 'i-activity', '#059669')}
      ${kpi('Interacción', num(+t.clics || 0) + ' clics', `<div class="delta eq">rebote ${rebote} % · ${vivoTotal ? `<b style="color:var(--ok)">● ${vivoTotal} en línea ahora</b>` : 'nadie en línea'}</div>`, 'i-zap', '#db2777')}
    </section>
    <section class="card panel" style="margin-bottom:16px"><div class="sec-title">${titSerie}${porHora ? ` · ${sit.rango === 'hoy' ? 'Hoy' : esc(sit.fecha || hoyLima())}` : ''}</div>${barrasSerie(d.serie || [], sit.rango)}</section>
    ${!sit.sitio ? `<section class="card panel" style="margin-bottom:16px"><div class="sec-title">Comparación de sitios</div>
      <div class="scroll"><table><thead><tr><th>Sitio</th><th>Visitantes</th><th>Visitas</th><th>Páginas vistas</th><th>Tiempo activo</th><th>Tiempo medio</th><th>En línea</th></tr></thead><tbody>
      ${Object.entries(nombres).map(([k, n]) => { const r = (d.porSitio || []).find(x => x.sitio === k) || {}; const v = (d.enVivo || []).find(x => x.sitio === k);
        return `<tr class="st-click" data-st="${k}"><td><b>${esc(n.nombre)}</b><br><small class="sub">${esc(n.url.replace('https://', ''))}</small></td><td><b>${num(+r.visitantes || 0)}</b></td><td>${num(+r.sesiones || 0)}</td><td>${num(+r.vistas || 0)}</td><td>${dur(r.segundos)}</td><td>${r.sesiones ? dur(+r.segundos / +r.sesiones) : '—'}</td><td>${v ? `<span class="chip ok">● ${v.n}</span>` : '—'}</td></tr>`; }).join('')}
      </tbody></table></div></section>` : ''}
    <section class="grid g2">
      <div class="card panel"><div class="sec-title">Páginas más vistas</div>
        ${(d.paginas || []).length ? `<div class="scroll"><table><thead><tr><th>Página</th><th>Vistas</th><th>Visitantes</th><th>Tiempo medio</th></tr></thead><tbody>
          ${d.paginas.map(p => `<tr><td><b>${esc(p.titulo || p.ruta)}</b><br><small class="sub">${esc(p.ruta)}</small></td><td>${num(+p.vistas)}</td><td>${num(+p.visitantes)}</td><td>${dur(+p.segundos / Math.max(1, +p.vistas))}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="vacio">Sin datos aún.</p>'}</div>
      <div class="card panel"><div class="sec-title">Qué tocan los visitantes</div>${listaBarras(d.clics || [], 'etiqueta', 'clics', num, '#db2777')}</div>
    </section>
    <section class="grid g2">
      <div class="card panel"><div class="sec-title">Horas en que más se conectan</div>${barras24(horas.map(x => x.sesiones || null), '#4f46e5', ' visitas', true)}
        <p class="sub" style="font-size:12px">${horaPico.sesiones ? `Hora pico: <b>${horaPico.h}</b> (${num(horaPico.sesiones)} visitas en el periodo).` : 'Sin datos aún.'}</p></div>
      <div class="card panel"><div class="sec-title">De dónde llegan</div>${listaBarras(d.origen || [], 'origen', 'sesiones', num, '#0891b2')}</div>
    </section>
    <section class="grid g3" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
      <div class="card panel"><div class="sec-title">Países <small>por zona horaria</small></div>${listaBarras(d.paises || [], 'pais', 'visitantes', num, '#059669')}</div>
      <div class="card panel"><div class="sec-title">Dispositivos</div>${listaBarras(d.dispositivos || [], 'dispositivo', 'visitantes', num, '#7c3aed')}</div>
      <div class="card panel"><div class="sec-title">Navegadores</div>${listaBarras(d.navegadores || [], 'navegador', 'visitantes', num, '#d97706')}</div>
    </section>`;
}

function enlazarSitios() {
  document.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { sit.sitio = b.dataset.st; pintar(); });
  document.querySelectorAll('[data-sr]').forEach(b => b.onclick = () => { sit.rango = b.dataset.sr; if (sit.rango === 'dia' && !sit.fecha) sit.fecha = new Date(Date.now() - 29 * 36e5).toISOString().slice(0, 10); pintar(); });
  const di = document.getElementById('st-dia');
  if (di) di.onchange = () => { if (di.value) { sit.fecha = di.value; di.blur(); pintar(); } };
}
