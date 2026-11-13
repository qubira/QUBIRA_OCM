/* ============================================================
   OCM — Publicar en TikTok (Content Posting API) y Salud de la cuenta.
   Usa las constantes globales de index.html (estado, api, esc, num, fecha, toast, pintar…).
   ============================================================ */

const PRIVACIDAD = {
  PUBLIC_TO_EVERYONE: 'Público', MUTUAL_FOLLOW_FRIENDS: 'Amigos', FOLLOWER_OF_CREATOR: 'Seguidores', SELF_ONLY: 'Solo yo',
};
const ESTADOS_PUB = {
  PROCESSING_UPLOAD: ['Subiendo', 'warn'], PROCESSING_DOWNLOAD: ['Descargando', 'warn'],
  SEND_TO_USER_INBOX: ['En la bandeja de TikTok', 'ok'], PUBLISH_COMPLETE: ['Publicado', 'ok'], FAILED: ['Falló', 'err'],
};
const pub = { cargado: false, cargando: false, creador: null, permisos: null, lista: [], error: null };

async function cargarPublicar() {
  if (pub.cargando) return;
  pub.cargando = true;
  try {
    const [c, l] = await Promise.all([api('/tiktok/creador'), api('/tiktok/publicaciones')]);
    pub.creador = c.creador; pub.permisos = c.permisos; pub.lista = l; pub.error = null;
  } catch (e) { pub.error = e.message; }
  pub.cargado = true; pub.cargando = false;
  if (estado.vista === 'publicar') pintar();
}

function vPublicar() {
  if (!pub.cargado) { cargarPublicar(); return '<div class="spin"></div>'; }
  const p = pub.permisos || {}, cr = pub.creador;
  const aviso = !p.borrador && !p.directo ? `
    <section class="card panel aviso-pub">
      <div class="sec-title">Falta un permiso de TikTok</div>
      <p class="sub" style="margin-bottom:10px">Para enviar videos desde aquí, la app de TikTok necesita el producto <b>Content Posting API</b>:</p>
      <ol class="pasos">
        <li>En <b>developers.tiktok.com</b> → tu app → <b>Add products</b> → <b>Content Posting API</b>.</li>
        <li>Activa los scopes <b>video.upload</b> (enviar a borradores) y, si quieres publicar directo, <b>video.publish</b>.</li>
        <li>En Render agrega esos scopes a <code>TIKTOK_SCOPES</code>.</li>
        <li>En <a href="#conexion">Conexión</a> pulsa <b>Reconectar</b> y acepta los permisos.</li>
      </ol>
    </section>` : '';
  const opcionesPriv = (cr?.privacy_level_options || ['SELF_ONLY']).map(o => `<option value="${esc(o)}">${PRIVACIDAD[o] || esc(o)}</option>`).join('');
  const maxDur = cr?.max_video_post_duration_sec;
  return `${pub.error ? `<div class="card panel" style="margin-bottom:16px"><span class="chip err">${esc(pub.error)}</span></div>` : ''}${aviso}
    <section class="grid g21">
      <div class="card panel"><div class="sec-title">Nuevo envío a TikTok</div>
        <form id="form-pub" class="form-pub">
          <label class="soltar" id="soltar">
            <input type="file" id="pub-archivo" accept="video/mp4,video/quicktime,video/webm" hidden>
            <span id="pub-nombre">${ico('i-video', 22)}<b>Elige o arrastra un video</b><small>MP4, MOV o WEBM · máx. 64 MB${maxDur ? ` · hasta ${maxDur} s` : ''}</small></span>
          </label>
          <video id="pub-previa" controls muted playsinline hidden></video>
          <div class="seg-pub">
            <label><input type="radio" name="modo" value="borrador" ${p.borrador || !p.directo ? 'checked' : ''} ${p.borrador ? '' : 'disabled'}> <span><b>Enviar a borradores</b><small>Llega a la bandeja de TikTok; lo terminas y publicas desde el celular.</small></span></label>
            <label><input type="radio" name="modo" value="directo" ${!p.borrador && p.directo ? 'checked' : ''} ${p.directo ? '' : 'disabled'}> <span><b>Publicar directo</b><small>Se publica con la privacidad elegida (app sin auditar: solo privado).</small></span></label>
          </div>
          <div id="campos-directo" class="campos-directo">
            <label class="campo">Descripción <small id="pub-cont">0 / 2200 · 0 hashtags</small>
              <textarea id="pub-titulo" maxlength="2200" rows="4" placeholder="Texto del video, #hashtags y @menciones"></textarea></label>
            <label class="campo">Privacidad<select id="pub-priv">${opcionesPriv}</select></label>
            <div class="checks">
              <label><input type="checkbox" id="pub-sc" ${cr?.comment_disabled ? 'checked disabled' : ''}> Desactivar comentarios</label>
              <label><input type="checkbox" id="pub-sd" ${cr?.duet_disabled ? 'checked disabled' : ''}> Desactivar dúo</label>
              <label><input type="checkbox" id="pub-ss" ${cr?.stitch_disabled ? 'checked disabled' : ''}> Desactivar stitch</label>
              <label><input type="checkbox" id="pub-ia"> Contenido generado con IA</label>
              <label><input type="checkbox" id="pub-mp"> Promociona mi marca</label>
              <label><input type="checkbox" id="pub-mt"> Contenido de marca (tercero)</label>
            </div>
          </div>
          <div class="barra-sub" id="pub-barra" hidden><div></div></div>
          <button class="btn btn-primary" id="pub-enviar" type="submit" ${p.borrador || p.directo ? '' : 'disabled'}>${ico('i-sync', 15)} Enviar a TikTok</button>
          <p class="sub" style="margin-top:8px">Al enviar aceptas la <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener">Confirmación de uso de música</a> de TikTok.</p>
        </form></div>
      <div class="card panel"><div class="sec-title">Cuenta de destino</div>
        ${cr ? `<div class="destino">${cr.creator_avatar_url ? `<img src="${esc(cr.creator_avatar_url)}" alt="">` : ''}<div><b>${esc(cr.creator_nickname || '')}</b><p class="sub">@${esc(cr.creator_username || estado.datos.cuenta.username || '')}</p></div></div>
          <dl class="kv" style="margin-top:12px"><dt>Duración máxima</dt><dd>${maxDur ? maxDur + ' s' : '—'}</dd>
          <dt>Privacidades</dt><dd>${(cr.privacy_level_options || []).map(o => PRIVACIDAD[o] || o).join(', ') || '—'}</dd></dl>`
        : `<div class="destino"><img src="${esc(estado.datos.cuenta.avatar_grande || estado.datos.cuenta.avatar_url || '')}" alt=""><div><b>${esc(estado.datos.cuenta.display_name || '')}</b><p class="sub">@${esc(estado.datos.cuenta.username || '')}</p></div></div>`}
        <dl class="kv" style="margin-top:12px">
          <dt>Borradores (video.upload)</dt><dd><span class="chip ${p.borrador ? 'ok' : 'err'}">${p.borrador ? 'autorizado' : 'falta'}</span></dd>
          <dt>Publicar (video.publish)</dt><dd><span class="chip ${p.directo ? 'ok' : 'err'}">${p.directo ? 'autorizado' : 'falta'}</span></dd>
        </dl>
        <div class="insight" style="margin-top:12px"><span class="e">💡</span><div><b>Consejo</b><p>Según tu Estrategia, publica en tu mejor franja y usa 3–5 hashtags.</p></div></div>
      </div>
    </section>
    <section class="card panel"><div class="sec-title">Historial de envíos <button class="btn btn-sec" id="pub-recargar" style="margin-left:auto">${ico('i-sync', 14)} Actualizar</button></div>
      ${pub.lista.length ? `<div class="scroll"><table><thead><tr><th>Fecha</th><th>Archivo</th><th>Modo</th><th>Estado</th><th>Tamaño</th><th></th></tr></thead><tbody>
        ${pub.lista.map(x => { const [t, c] = ESTADOS_PUB[x.estado] || [x.estado || '—', '']; return `<tr>
          <td>${fecha(x.creado_en)}</td><td class="tt">${esc(x.archivo || '')}${x.titulo ? `<br><small class="sub">${esc(x.titulo.slice(0, 60))}</small>` : ''}</td>
          <td>${x.modo === 'directo' ? 'Directo' + (x.privacidad ? ' · ' + (PRIVACIDAD[x.privacidad] || x.privacidad) : '') : 'Borrador'}</td>
          <td><span class="chip ${c}">${esc(t)}</span>${x.error ? `<br><small class="sub">${esc(x.error)}</small>` : ''}</td>
          <td>${(x.tamano / 1048576).toFixed(1)} MB</td>
          <td><button class="btn btn-sec btn-mini" data-estado-pub="${x.id}">Consultar</button></td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="sub">Aún no se ha enviado ningún video desde OCM.</p>'}
    </section>`;
}

function enlazarPublicar() {
  const form = $('form-pub');
  $('pub-recargar')?.addEventListener('click', () => { pub.cargado = false; pintar(); });
  document.querySelectorAll('[data-estado-pub]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { const r = await api(`/tiktok/publicaciones/${b.dataset.estadoPub}/estado`, { method: 'POST' }); pub.lista = pub.lista.map(x => x.id === r.id ? r : x); pintar(); }
    catch (e) { toast(e.message, true); b.disabled = false; }
  });
  if (!form) return;
  const arch = $('pub-archivo'), soltar = $('soltar'), previa = $('pub-previa'), tit = $('pub-titulo');
  const modo = () => form.querySelector('[name=modo]:checked')?.value || 'borrador';
  const verModo = () => { $('campos-directo').classList.toggle('apagado', modo() !== 'directo'); };
  form.querySelectorAll('[name=modo]').forEach(r => r.onchange = verModo); verModo();
  tit.oninput = () => { $('pub-cont').textContent = `${tit.value.length} / 2200 · ${(tit.value.match(/#[\p{L}\p{N}_]+/gu) || []).length} hashtags`; };
  const elegir = f => {
    if (!f) return;
    if (f.size > 64 * 1048576) { toast('El video supera 64 MB', true); return; }
    const dt = new DataTransfer(); dt.items.add(f); arch.files = dt.files;
    $('pub-nombre').innerHTML = `${ico('i-video', 22)}<b>${esc(f.name)}</b><small>${(f.size / 1048576).toFixed(1)} MB · pulsa para cambiar</small>`;
    previa.src = URL.createObjectURL(f); previa.hidden = false;
    previa.onloadedmetadata = () => {
      const d = Math.round(previa.duration), max = pub.creador?.max_video_post_duration_sec;
      const orient = previa.videoHeight >= previa.videoWidth ? 'vertical ✓' : 'horizontal (TikTok prefiere vertical 9:16)';
      $('pub-nombre').querySelector('small').textContent = `${(f.size / 1048576).toFixed(1)} MB · ${d} s · ${previa.videoWidth}×${previa.videoHeight} ${orient}${max && d > max ? ` · ⚠ supera ${max} s` : ''}`;
    };
  };
  arch.onchange = () => elegir(arch.files[0]);
  soltar.ondragover = e => { e.preventDefault(); soltar.classList.add('sobre'); };
  soltar.ondragleave = () => soltar.classList.remove('sobre');
  soltar.ondrop = e => { e.preventDefault(); soltar.classList.remove('sobre'); elegir(e.dataTransfer.files[0]); };
  form.onsubmit = e => {
    e.preventDefault();
    const f = arch.files[0];
    if (!f) { toast('Elige un video primero', true); return; }
    const fd = new FormData();
    fd.append('video', f); fd.append('modo', modo());
    if (modo() === 'directo') {
      fd.append('titulo', tit.value); fd.append('privacidad', $('pub-priv').value);
      [['sin_comentarios', 'pub-sc'], ['sin_duo', 'pub-sd'], ['sin_stitch', 'pub-ss'], ['ia', 'pub-ia'], ['marca_propia', 'pub-mp'], ['marca_terceros', 'pub-mt']]
        .forEach(([k, id]) => fd.append(k, String($(id).checked)));
    }
    const btn = $('pub-enviar'), barra = $('pub-barra'); btn.disabled = true; barra.hidden = false;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API + '/api/ocm/tiktok/publicar');
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.upload.onprogress = ev => { if (ev.lengthComputable) barra.firstElementChild.style.width = (ev.loaded / ev.total * 100) + '%'; };
    xhr.onload = () => {
      let d = {}; try { d = JSON.parse(xhr.responseText); } catch { }
      if (xhr.status >= 200 && xhr.status < 300) { toast(modo() === 'directo' ? 'Enviado: TikTok lo está publicando' : 'Enviado: revisa la bandeja de TikTok en tu celular'); pub.lista.unshift(d); pintar(); }
      else { toast(d.error || 'No se pudo enviar', true); btn.disabled = false; barra.hidden = true; }
    };
    xhr.onerror = () => { toast('Error de red al subir', true); btn.disabled = false; barra.hidden = true; };
    xhr.send(fd);
  };
}

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
