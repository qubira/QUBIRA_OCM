/* ============================================================
   OCM — Salud de la cuenta y acciones de la ficha del video.
   Usa las constantes globales de index.html (estado, api, esc, num, fecha, toast, pintar…).
   ============================================================ */

// ─── Salud de la cuenta: auditoría automática con lo que entrega la API ────
function vSalud() {
  const { cuenta: c, videos: vs = [], historial: h = [] } = estado.datos;
  const ult = h[h.length - 1] || {};
  const chequeos = [];
  const add = (ok, t, d, peso = 1) => chequeos.push({ ok, t, d, peso });
  add(!!c.bio && c.bio.length >= 40, 'Biografía completa', c.bio ? `${c.bio.length} caracteres` : 'Sin biografía');
  add(/https?:|\.app|\.com|\.pe/i.test(c.bio || ''), 'Enlace o web en la biografía', 'Facilita convertir visitas en clientes');
  add(!!(c.avatar_grande || c.avatar_url), 'Foto de perfil', 'Imagen reconocible de la marca');
  add(!!c.verificado, 'Cuenta verificada', c.verificado ? 'Insignia azul activa' : 'Aún no verificada', 0.5);
  const recientes = vs.filter(v => v.publicado_en && (Date.now() - new Date(v.publicado_en)) / 864e5 <= 30).length;
  add(recientes >= 8, 'Constancia (últimos 30 días)', `${recientes} videos · ideal ≥ 8 (2 por semana)`, 2);
  const ultimo = vs.map(v => v.publicado_en).filter(Boolean).sort().pop();
  const diasUlt = ultimo ? Math.floor((Date.now() - new Date(ultimo)) / 864e5) : null;
  add(diasUlt != null && diasUlt <= 7, 'Publicación reciente', diasUlt == null ? 'Sin videos' : `Último video hace ${diasUlt} días`, 1.5);
  const conDim = vs.filter(v => v.alto && v.ancho), vert = conDim.filter(v => +v.alto >= +v.ancho).length;
  if (conDim.length) add(vert / conDim.length >= 0.9, 'Formato vertical 9:16', `${vert} de ${conDim.length} videos verticales`);
  const durs = vs.map(v => +v.duracion).filter(Boolean), durMed = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;
  add(durMed >= 15 && durMed <= 90, 'Duración adecuada', `Media ${Math.round(durMed)} s · rango sano 15–90 s`);
  const conTags = vs.filter(v => /#\w/.test(v.titulo || '')).length;
  add(vs.length && conTags / vs.length >= 0.8, 'Uso de hashtags', `${conTags} de ${vs.length} videos con hashtags`);
  const tv = vs.reduce((a, v) => a + +v.vistas, 0), ti = vs.reduce((a, v) => a + +v.likes + +v.comentarios + +v.compartidos, 0);
  add(tv && ti / tv >= 0.03, 'Tasa de interacción ≥ 3 %', `${(ti / (tv || 1) * 100).toFixed(2)} % actual`, 2);
  const conv = vs.reduce((a, v) => a + +v.comentarios, 0);
  add(conv >= vs.length, 'Conversación (≥ 1 comentario por video)', `${conv} comentarios en ${vs.length} videos`);
  add(ult.seguidos == null || ult.seguidores >= ult.seguidos, 'Más seguidores que seguidos', `${num(ult.seguidores || 0)} seguidores · ${num(ult.seguidos || 0)} seguidos`, 0.5);
  const horas = c.ultima_sync ? (Date.now() - new Date(c.ultima_sync)) / 36e5 : 999;
  add(horas <= 26 && !c.ultimo_error, 'Datos al día', c.ultimo_error ? 'Último intento con error' : `Sincronizado hace ${Math.round(horas)} h`, 0.5);
  add(h.length >= 7, 'Histórico suficiente', `${h.length} días registrados`, 0.5);
  const total = chequeos.reduce((a, x) => a + x.peso, 0), logrado = chequeos.filter(x => x.ok).reduce((a, x) => a + x.peso, 0);
  const nota = Math.round(logrado / total * 100), col = nota >= 75 ? 'var(--ok)' : nota >= 50 ? '#d97706' : 'var(--err, #dc2626)';
  return `<section class="grid g21">
      <div class="card panel salud-nota"><div class="sec-title">Puntaje de salud</div>
        <div class="nota-anillo" style="--p:${nota};--c:${col}"><b>${nota}</b><small>/ 100</small></div>
        <p class="sub" style="text-align:center;margin-top:10px">${nota >= 75 ? 'Cuenta en buen estado' : nota >= 50 ? 'Hay mejoras importantes' : 'Requiere atención'} · ${chequeos.filter(x => x.ok).length} de ${chequeos.length} puntos cumplidos</p></div>
      <div class="card panel"><div class="sec-title">Prioridades</div>
        ${chequeos.filter(x => !x.ok).sort((a, b) => b.peso - a.peso).slice(0, 4).map(x => `<div class="insight"><span class="e">⚠️</span><div><b>${esc(x.t)}</b><p>${esc(x.d)}</p></div></div>`).join('') || '<div class="insight"><span class="e">🏆</span><div><b>Todo en orden</b><p>Mantén la constancia.</p></div></div>'}
      </div></section>
    <section class="card panel"><div class="sec-title">Revisión completa</div>
      <div class="checklist">${chequeos.map(x => `<div class="chk ${x.ok ? 'si' : 'no'}"><span>${x.ok ? '✓' : '✕'}</span><div><b>${esc(x.t)}</b><small>${esc(x.d)}</small></div>${x.peso >= 1.5 ? '<em>clave</em>' : ''}</div>`).join('')}</div>
    </section>
    <section class="card panel"><div class="sec-title">Lo que la API de TikTok no entrega</div>
      <p class="sub">Con Login Kit + Display API no se puede obtener: demografía de la audiencia, retención (tiempo visto), fuentes de tráfico (Para ti, perfil, búsqueda) ni el texto de los comentarios. Eso solo lo da la <b>TikTok Business API</b> (cuenta de empresa).</p>
    </section>`;
}

// Botón «Actualizar desde TikTok» de la ficha del video
document.addEventListener('click', async e => {
  const em = e.target.closest('[data-embed]');
  if (em) { navigator.clipboard.writeText(em.dataset.embed).then(() => toast('Enlace para incrustar copiado')).catch(() => toast('No se pudo copiar', true)); return; }
  const b = e.target.closest('[data-refrescar]');
  if (!b) return;
  e.preventDefault(); b.disabled = true; b.textContent = 'Actualizando…';
  try {
    await api(`/tiktok/videos/${encodeURIComponent(b.dataset.refrescar)}/actualizar`, { method: 'POST' });
    estado.datos = await api('/tiktok/resumen?dias=365');
    document.getElementById('ficha-video')?.remove();
    pintar(); abrirVideo(b.dataset.refrescar); toast('Video actualizado con datos de TikTok');
  } catch (er) { toast(er.message, true); b.disabled = false; b.textContent = 'Actualizar desde TikTok'; }
});

// ─── Videos fuera de las métricas (eliminados en TikTok u ocultos a mano) ───
async function recargarTodo() {
  estado.datos = await api('/tiktok/resumen?dias=365');
  estado.horas = {};
  repintarSeguro();
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-ocultar], [data-restaurar]');
  if (!b) return;
  e.preventDefault();
  const ocultar = !!b.dataset.ocultar, id = b.dataset.ocultar || b.dataset.restaurar;
  if (ocultar && !confirm('¿Quitar este video de todas las métricas?\nNo se borra: puedes restaurarlo en Conexión → Videos fuera de las métricas.')) return;
  b.disabled = true;
  try {
    await api(`/tiktok/videos/${encodeURIComponent(id)}/ocultar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oculto: ocultar }) });
    document.getElementById('ficha-video')?.remove();
    excluidos = null;
    await recargarTodo();
    toast(ocultar ? 'Video quitado de las métricas' : 'Video restaurado en las métricas');
  } catch (er) { toast(er.message, true); b.disabled = false; }
});
let excluidos = null;
function vExcluidos() {
  if (!excluidos) {
    api('/tiktok/videos/excluidos').then(r => { excluidos = r; if (estado.vista === 'conexion') repintarSeguro(); }).catch(er => { excluidos = []; toast(er.message, true); });
    return '<div class="spin"></div>';
  }
  if (!excluidos.length) return '<p class="vacio">Ningún video fuera de las métricas. Los eliminados en TikTok se detectan solos al sincronizar; para quitar uno a mano, ábrelo y pulsa «Quitar de las métricas».</p>';
  return `<div class="scroll"><table><thead><tr><th>Video</th><th>Motivo</th><th>Vistas guardadas</th><th></th></tr></thead><tbody>
    ${excluidos.map(x => `<tr><td><div class="vh-vid">${x.portada ? `<img src="${esc(x.portada)}" alt="" onerror="this.style.visibility='hidden'">` : ''}<div><span>${esc((x.titulo || 'Sin título').replace(/\*\*/g, '').slice(0, 60))}</span>
      <small>${x.publicado_en ? 'Publicado ' + new Date(x.publicado_en).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</small></div></div></td>
      <td>${x.eliminado_en ? `<span class="chip err">Eliminado en TikTok</span><br><small class="sub">detectado ${fecha(x.eliminado_en)}</small>` : '<span class="chip warn">Oculto a mano</span>'}</td>
      <td>${num(+x.vistas || 0)}</td>
      <td><button class="btn btn-sec btn-mini" data-restaurar="${esc(x.video_id)}">Restaurar</button></td></tr>`).join('')}
  </tbody></table></div>`;
}
