/* ============================================================
   OCM — Cierre de sesión por inactividad (1 hora).
   A los 60 min sin mover el mouse, escribir, tocar o desplazarse aparece
   el aviso «¿Sigues ahí?» con 30 s para continuar; si no, se cierra la sesión.
   La actualización automática de datos NO cuenta como actividad.
   Usa Date.now() y un tick por segundo: funciona aunque el navegador
   frene los temporizadores de la pestaña en segundo plano.
   ============================================================ */
(function () {
  const AVISO_MS = 60 * 60 * 1000;          // 1 hora sin actividad
  const CIERRE_MS = AVISO_MS + 30 * 1000;   // + 30 s de aviso
  let ultima = Date.now(), overlay = null, cuenta = null;

  function cerrarSesion() {
    ocultar();
    localStorage.removeItem('ocm_token'); localStorage.removeItem('ocm_user');
    location.href = (typeof LOGIN !== 'undefined' ? LOGIN : 'login.html');
  }
  function ocultar() { if (overlay) { overlay.remove(); overlay = null; } clearInterval(cuenta); }
  function avisar() {
    if (overlay) return;
    let seg = Math.round((CIERRE_MS - AVISO_MS) / 1000);
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(17,24,39,.6);z-index:2147483600;display:flex;align-items:center;justify-content:center;font-family:inherit';
    overlay.innerHTML = `<div style="background:#fff;border-radius:16px;padding:28px;max-width:340px;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,.25)">
        <div style="width:48px;height:48px;border-radius:50%;background:#fef3c7;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:22px">⏱</div>
        <h3 style="font-size:16px;font-weight:800;margin:0 0 8px;color:#111827">¿Sigues ahí?</h3>
        <p style="font-size:13px;color:#6b7280;margin:0 0 18px;line-height:1.5">Llevas 1 hora sin actividad. Tu sesión se cerrará en <strong id="ocm-inact-seg">${seg}</strong> segundos.</p>
        <button id="ocm-inact-seguir" style="width:100%;padding:12px;border:none;border-radius:10px;background:#db2777;color:#fff;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">Seguir conectado</button>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('ocm-inact-seguir').onclick = () => { ultima = Date.now(); ocultar(); };
    cuenta = setInterval(() => { seg -= 1; const e = document.getElementById('ocm-inact-seg'); if (e) e.textContent = String(Math.max(seg, 0)); }, 1000);
  }
  function actividad() { ultima = Date.now(); if (overlay) ocultar(); }
  /* Solo acciones reales: el navegador genera mousemove «falsos» cuando cambia lo que hay
     bajo el cursor, y el repintado automático puede mover el scroll; esos no cuentan. */
  let px = null, py = null;
  document.addEventListener('mousemove', e => { if (px !== null && Math.abs(e.clientX - px) + Math.abs(e.clientY - py) > 3) actividad(); px = e.clientX; py = e.clientY; }, { passive: true, capture: true });
  ['mousedown', 'keydown', 'touchstart', 'wheel'].forEach(ev => document.addEventListener(ev, actividad, { passive: true, capture: true }));

  function tick() {
    if (!localStorage.getItem('ocm_token')) return;
    const t = Date.now() - ultima;
    if (t >= CIERRE_MS) return cerrarSesion();
    if (t >= AVISO_MS) avisar();
  }
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  // Para pruebas: window.__ocmInactividad.simular(ms) adelanta el reloj de inactividad
  window.__ocmInactividad = { simular: ms => { ultima = Date.now() - ms; tick(); } };
})();
