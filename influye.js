/* ============================================================
   OCM — ¿Qué influye en las vistas? (detallado). Para cada factor:
   correlación, explicación, comparación real (mitad con menos vs.
   mitad con más) y recomendación. Usa globales de estrategia.js.
   ============================================================ */
function tarjetaInfluye(videos) {
  const v = videos.filter(x => x.publicado_en);
  const F = [
    { n: 'Duración del video', f: x => +x.duracion || 0, u: ' s', mas: 'los videos más largos', menos: 'los videos más cortos', rec: ['Mantén videos más largos (sobre {c}).', 'Haz videos más cortos (hasta {c}).'] },
    { n: 'Hora de publicación', f: x => horaLima(x.publicado_en), u: ' h', mas: 'publicar más tarde en el día', menos: 'publicar más temprano', rec: ['Publica después de las {c}.', 'Publica hasta las {c}.'] },
    { n: 'Número de hashtags', f: x => nHashtags(x.titulo), u: '', mas: 'usar más hashtags', menos: 'usar menos hashtags', rec: ['Usa más de {c} hashtags.', 'Usa {c} hashtags o menos.'] },
    { n: 'Cantidad de emojis', f: x => nEmojis(x.titulo), u: '', mas: 'usar más emojis', menos: 'usar menos emojis', rec: ['Agrega más emojis (más de {c}).', 'Usa {c} emojis o menos.'] },
    { n: 'Largo del texto', f: x => largoTitulo(x.titulo), u: ' caracteres', mas: 'textos más largos', menos: 'textos más cortos', rec: ['Escribe descripciones más largas (más de {c}).', 'Escribe descripciones más cortas ({c} o menos).'] },
  ];
  const ys = v.map(x => Math.log10(+x.vistas + 1));
  const filas = F.map(fc => {
    const xs = v.map(fc.f), r = pearson(xs, ys), corte = mediana(xs);
    const bajo = v.filter((x, i) => xs[i] <= corte), alto = v.filter((x, i) => xs[i] > corte);
    return { ...fc, r, corte, nB: bajo.length, nA: alto.length, min: Math.min(...xs), max: Math.max(...xs),
      mB: bajo.length ? mediana(bajo.map(x => +x.vistas)) : 0, mA: alto.length ? mediana(alto.map(x => +x.vistas)) : 0 };
  }).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  const col = r => (Math.abs(r) < 0.1 ? '#94a3b8' : r > 0 ? '#059669' : '#dc2626');
  const top = filas[0];

  const bloque = fc => {
    const anchoB = Math.abs(fc.r) * 50, izq = fc.r < 0 ? 50 - anchoB : 50;
    // La tendencia general (correlación) y la comparación por mitades deben coincidir para sacar conclusiones
    const dif = fc.nA && fc.nB ? (fc.mA - fc.mB) / Math.max(1, Math.min(fc.mA, fc.mB)) : 0;
    const dirC = Math.abs(dif) < 0.15 ? 0 : Math.sign(dif), dirR = Math.abs(fc.r) < 0.1 ? 0 : Math.sign(fc.r);
    const mixto = dirC && dirR && dirC !== dirR;
    const sentido = !dirC && !dirR ? 'No se nota relación con las vistas.'
      : mixto ? '<b style="color:#b45309">Resultado mixto:</b> la tendencia general y la comparación por mitades no coinciden; no es concluyente.'
      : `Con ${(dirC || dirR) > 0 ? fc.mas : fc.menos} hay más vistas.`;
    const maxM = Math.max(1, fc.mB, fc.mA), cTxt = fc.corte + fc.u;
    const rec = !mixto && dirC && Math.abs(fc.r) >= 0.2 ? (dirC > 0 ? fc.rec[0] : fc.rec[1]).replace('{c}', cTxt) : '';
    const comp = fc.nA && fc.nB ? `<div class="inf-comp">
        <div><small>Hasta ${cTxt} · ${fc.nB} videos</small><span class="st-barra"><i style="width:${(fc.mB / maxM * 100).toFixed(1)}%;background:${dirC < 0 ? '#10b981' : '#cbd5e1'}"></i></span><b>${num(Math.round(fc.mB))}</b></div>
        <div><small>Más de ${cTxt} · ${fc.nA} videos</small><span class="st-barra"><i style="width:${(fc.mA / maxM * 100).toFixed(1)}%;background:${dirC > 0 ? '#10b981' : '#cbd5e1'}"></i></span><b>${num(Math.round(fc.mA))}</b></div>
      </div>` : '<p class="sub" style="font-size:11.5px">Todos tus videos tienen el mismo valor: no se puede comparar.</p>';
    return `<div class="inf-f">
      <div class="inf-cab"><b>${fc.n}</b><span class="inf-r" style="color:${col(fc.r)}">${fc.r >= 0 ? '+' : ''}${fc.r.toFixed(2)}</span><span class="inf-fz" style="color:${col(fc.r)}">${fuerza(fc.r)}</span></div>
      <div class="inf-barra"><i style="left:${izq}%;width:${Math.max(anchoB, 0.8)}%;background:${col(fc.r)}"></i><span></span></div>
      <p class="inf-txt">${sentido} <span class="sub">Rango en tus videos: ${fc.min}–${fc.max}${fc.u}.</span></p>
      ${comp}
      ${rec ? `<p class="inf-rec">💡 ${rec}</p>` : ''}
    </div>`;
  };

  const conclusion = Math.abs(top.r) >= 0.3
    ? `Videos con ${top.mA > top.mB ? 'más de ' : 'hasta '}${top.corte}${top.u} consiguen una mediana de ${num(Math.round(Math.max(top.mA, top.mB)))} vistas, frente a ${num(Math.round(Math.min(top.mA, top.mB)))}. `
    : 'El contenido en sí pesa más que estos factores. ';
  return `<div class="card panel"><div class="sec-title">¿Qué influye en las vistas?</div>
    <p class="sub" style="font-size:12px;margin:-4px 0 10px">Relación de cada factor con las vistas en tus ${v.length} videos (de −1 a +1). Debajo de cada uno, la comparación real: mediana de vistas de la mitad con menos de ese factor contra la mitad con más.</p>
    <div class="inf-escala"><span>−1 · menos vistas</span><span>0</span><span>+1 · más vistas</span></div>
    ${filas.map(bloque).join('')}
    <div class="insight" style="margin-top:6px"><span class="e">🎯</span><div><b>${Math.abs(top.r) >= 0.3 ? 'Lo que más pesa: ' + top.n.toLowerCase() : 'Ningún factor domina claramente'}</b>
      <p>${conclusion}Correlación no es causa: úsalo como pista para probar.</p></div></div>
  </div>`;
}
