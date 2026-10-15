import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(process.argv[2] || tmpdir());
const destination = resolve(process.argv[3] || 'docs/optimization/template7-20261015');
const read = async file => JSON.parse(await readFile(join(root, file), 'utf8'));
const [load, previous, access, probe, beforeClickFix, captureDiagnostic, fixRelease, historicalAttempt1, historicalAttempt2] = await Promise.all([
  read('template7-release-20261015/release-report.json'),
  read('template7-access-20261015/release-report.json'),
  read('template7-stage3-20261015/post-fix/access.json'),
  read('template7-stage3-20261015/post-fix/probe.json'),
  read('template7-stage3-20261015/access.json'),
  read('template7-stage3-20261015/capture-diagnostic/probe.json'),
  read('template7-stage3-20261015/click-fix-release.json'),
  read('template7-access-20261015/verification/attempt1.json'),
  read('template7-access-20261015/verification/attempt2.json'),
]);
const stats = values => {
  const sorted = values.filter(Number.isFinite).sort((a,b)=>a-b), n = sorted.length;
  return n ? { n, median: Math.round(n % 2 ? sorted[(n-1)/2] : (sorted[n/2-1]+sorted[n/2])/2), min: sorted[0], max: sorted[n-1] } : null;
};
const providers = {
  'rey-de-ases-demo': 'Rey de Ases', 'ases-del-norte-demo': 'Ases del Norte',
  'ganamos-net-demo': 'Ganamos NET', 'multi-skin-demo': 'Multi Skin',
};
const engines = { constructor: 'Constructor', classic: 'Clásico' };
assert.equal(access.results.length, access.samples * 8, 'Incomplete access matrix');
assert.equal(probe.results.length, probe.samples, 'Incomplete probe');
const comparison = [];
for (const engine of ['constructor','classic']) for (const slug of Object.keys(providers)) {
  const rows = access.results.filter(r => r.engine === engine && r.slug === slug);
  assert.equal(rows.length, access.samples);
  const successes = rows.filter(r=>r.ok);
  const baseline = previous.before.results.find(r=>r.engine===engine && r.slug===slug);
  const networkPaths = [...new Set(successes.flatMap(r=>r.network.map(n=>n.path)))]
    .filter(path=>path==='/start'||path.includes('/template7/')||path.includes('/preparations/'));
  comparison.push({
    engine, slug, attempts: rows.length, successes: successes.length, failures: rows.length-successes.length,
    initialForm: load.comparison.find(r=>r.engine===engine && r.slug===slug),
    beforeAccess: { n: 1, accountMs: baseline.accountMs, sessionReadyMs: baseline.sessionReadyMs, destinationMs: baseline.destinationMs },
    afterAccess: {
      accountMs: stats(successes.map(r=>r.accountMs)),
      sessionReadyMs: stats(successes.map(r=>r.sessionReadyMs)),
      destinationMs: stats(successes.map(r=>r.destinationMs)),
      ctaToRequestMs: stats(successes.map(r=>r.accessSentMs)),
      readyToDestinationMs: stats(successes.map(r=>r.destinationMs-r.sessionReadyMs)),
    },
    endpoints: networkPaths.map(path=>({path, durationMs:stats(successes.flatMap(r=>r.network.filter(n=>n.path===path&&n.method!=='OPTIONS').map(n=>n.durationMs)))})),
    automaticDisplayMs: engine==='constructor' ? stats(successes.filter(r=>r.accountMs!==null).map(r=>r.destinationMs-r.accountMs)) : null,
    extraFinalizationRequests: successes.reduce((n,r)=>n+r.network.filter(e=>e.path==='/api/preparations/finalize').length,0),
  });
}
const newFailures = access.results.filter(r=>!r.ok);
const newErrors = access.results.flatMap(r=>r.errors);
const report = {
  date: '2026-10-15', title: 'Template 7 — comparación de las etapas 1 y 2',
  generatedAt: new Date().toISOString(),
  stages: [
    { stage: 1, status: 'complete', description: 'Formulario inmediato, imágenes optimizadas y preparación anticipada del asesor.' },
    { stage: 2, status: 'complete', description: 'Menos idas y vueltas entre servicios y menos consultas consecutivas.' },
    { stage: 3, status: 'complete', description: 'Comparación antes/después de carga, aparición del usuario e ingreso; corrección y verificación del clic temprano.' },
  ],
  productChangesInStage3: 'Classic CTA captures clicks before the React document hydration root; shared submission and tracking logic retained.',
  methodology: {
    initialLoad: load.profile, access: access.profile,
    initialLoadSamplesBefore: load.before.results.length,
    initialLoadSamplesAfter: load.after.results.length,
    accessSamplesBeforePerCombination: 1, accessSamplesAfterPerCombination: access.samples,
    probeSamples: probe.samples,
    notes: [
      'La carga inicial usa CPU y red limitadas; el acceso usa conexión normal. No sumar sus tiempos como si pertenecieran a una misma visita.',
      'El acceso previo tiene una sola muestra por combinación. La nueva muestra fuerza caché HTTP vacía, a diferencia del medidor anterior: la comparación es descriptiva, no una estimación causal de la mejora.',
      'Se interceptan Meta/analíticas y el documento final del proveedor. Entrada significa llegada al destino autenticado, sin medir el render del casino o el widget.',
      'Solo se usan las cuentas demo existentes. Estos tiempos no incluyen creación real mediante API2.',
      'Las medianas de acceso corresponden a los éxitos; los fallos se cuentan y se conservan por separado.',
      'El clásico entra directamente y no muestra la pantalla intermedia de usuario. Sus valores de aparición del usuario son no aplicables.',
      'El constructor conserva cuatro segundos desde la aparición del usuario; el login se prepara durante ese intervalo.',
      'En las pruebas probe el POST de acceso se intercepta con un 503 deliberado. ok significa que el formulario envió la solicitud; no es una prueba de login.',
    ],
  },
  validation: {
    accessAttempts: access.results.length, accessSuccesses: access.results.filter(r=>r.ok).length,
    accessFailures: newFailures.length, runtimeOrMeasurementErrors: newErrors,
    probeAttempts: probe.results.length, probeRequestsSent: probe.results.filter(r=>r.ok).length,
    successfulClicksDespiteHydrationCapture: access.results.filter(r=>r.ok && r.engine==='classic' && r.click?.eventDispatched===false && r.click.trace?.some(e=>e.at==='document'&&e.cancelBubble)).length,
    previousFailedAttemptsRetained: 2,
    beforeClickFixAttempts: beforeClickFix.results.length,
    beforeClickFixFailures: beforeClickFix.results.filter(r=>!r.ok).length,
    diagnosis: 'Se reprodujo un clic con botón habilitado que alcanzó window pero fue detenido en document antes del listener nativo del botón. React bloquea eventos discretos durante la hidratación. La corrección captura el CTA en window, conservando el bloqueo de doble clic y la deduplicación. No se puede demostrar retroactivamente la causa de cada fallo histórico sin la traza original.',
    removedFinalizeVerified: comparison.filter(r=>r.engine==='constructor'&&r.slug!=='rey-de-ases-demo')
      .every(r=>r.successes===r.attempts&&r.extraFinalizationRequests===0),
  },
  initialLoadSummary: load.summary,
  historicalReports: { initialLoad: load, accessStage2: previous },
  comparison,
  sourceCommits: {...previous.productCommits, previousMeasurement:previous.verificationCommit},
  clickFixRelease: fixRelease,
  historicalFailures: [
    {file:'template7-access-20261015/verification/attempt1.json',engine:'classic',slug:'rey-de-ases-demo',accessRequestObserved:false,diagnosis:'not established',data:historicalAttempt1},
    {file:'template7-access-20261015/verification/attempt2.json',engine:'classic',slug:'rey-de-ases-demo',accessRequestObserved:false,diagnosis:'not established',data:historicalAttempt2},
  ],
  currentAccessSamples: access.results,
  diagnosticSamples: probe.results,
  preFixAccessSamples: beforeClickFix.results,
  eventCaptureEvidence: captureDiagnostic.results,
};
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seconds = n => n===null||n===undefined ? '—' : (n/1000).toFixed(2).replace('.',',')+' s';
const interval = stat => stat ? seconds(stat.min)+'–'+seconds(stat.max) : '—';
const label = row => '<td>'+engines[row.engine]+'</td><th scope="row">'+providers[row.slug]+'</th>';
const loadRows = comparison.map(r=>'<tr>'+label(r)+'<td>'+seconds(r.initialForm.formBeforeMs)+'</td><td>'+seconds(r.initialForm.formAfterMs)+'</td><td>'+r.initialForm.formReductionPercent+'%</td></tr>').join('');
const accessRows = comparison.map(r=>'<tr>'+label(r)+'<td>'+seconds(r.afterAccess.accountMs?.median)+'</td><td>'+seconds(r.afterAccess.sessionReadyMs?.median)+'</td><td>'+seconds(r.afterAccess.destinationMs?.median)+'</td><td>'+interval(r.afterAccess.destinationMs)+'</td><td>'+r.successes+'/'+r.attempts+'</td></tr>').join('');
const beforeRows = comparison.map(r=>'<tr>'+label(r)+'<td>'+seconds(r.beforeAccess.destinationMs)+'</td><td>'+seconds(r.afterAccess.destinationMs?.median)+'</td></tr>').join('');
const gatewayRows = comparison.map(r=>{
  const start = r.endpoints.find(e=>e.path==='/start');
  return '<tr>'+label(r)+'<td>'+seconds(r.afterAccess.ctaToRequestMs?.median)+'</td><td>'+seconds(start?.durationMs?.median)+'</td><td>'+r.extraFinalizationRequests+'</td></tr>';
}).join('');
const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Template 7 — Etapa 3</title>
<style>
:root{color-scheme:light;font-family:system-ui,sans-serif;color:#172b45;background:#f3f6fa}body{max-width:1140px;margin:36px auto;padding:0 20px 48px}h1{font-size:32px;margin:8px 0}h2{font-size:21px;margin-top:32px}p,li{line-height:1.6}small,.muted{color:#53647a}section,.summary{background:white;border:1px solid #d7e0ec;border-radius:12px;padding:20px;margin:16px 0}.summary{display:flex;gap:28px;flex-wrap:wrap}.summary strong{display:block;font-size:28px;color:#164d76}.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:12px 10px;border-bottom:1px solid #e1e7f0;text-align:left;white-space:nowrap}thead th{font-size:12px;color:#52647b}tbody th{font-weight:600}.note{border-left:4px solid #d19a2b;padding-left:14px}a{color:#155c8b}details{margin-top:16px}code{font-size:12px}footer{margin-top:24px;color:#53647a;font-size:13px}@media print{body{max-width:none;margin:0;padding:0}section{break-inside:avoid}details{display:none}}
</style>
<header><small>15 de octubre de 2026 · Etapa 3</small><h1>Template 7: carga, usuario e ingreso</h1><p>Comparación de las mejoras publicadas en clásico y constructor. Todos los tiempos de acceso empiezan al tocar el CTA.</p></header>
<div class="summary"><div><strong>48</strong>muestras de carga inicial</div><div><strong>${report.validation.accessSuccesses}/${report.validation.accessAttempts}</strong>accesos nuevos correctos</div><div><strong>${report.validation.probeRequestsSent}/${report.validation.probeAttempts}</strong>envíos aislados de Rey clásico</div></div>
<section><h2>Estado del plan original</h2><ol>${report.stages.map(stage=>'<li><strong>Etapa '+stage.stage+' completada.</strong> '+escape(stage.description)+'</li>').join('')}</ol><p>El informe y los datos históricos quedan guardados en el repositorio para retomar el trabajo sin depender del hilo de VS Code. La creación real por API2 y las cuentas precreadas quedan fuera de estas tres etapas.</p></section>
<section><h2>1. Primera pantalla</h2><p>Mediana de tres muestras por motor y proveedor, antes y después de la etapa 1. Mismo perfil de red y CPU limitadas. Tiempo hasta poder escribir y habilitar el CTA.</p><div class="scroll"><table><thead><tr><th>Motor</th><th>Proveedor</th><th>Antes</th><th>Después</th><th>Reducción observada</th></tr></thead><tbody>${loadRows}</tbody></table></div></section>
<section><h2>2. Acceso actual</h2><p>Medianas de ${access.samples} intentos por combinación, con cuentas demo y conexión normal. El rango incluye todos los accesos exitosos de esa combinación.</p><div class="scroll"><table><thead><tr><th>Motor</th><th>Proveedor</th><th>Usuario visible</th><th>Sesión lista</th><th>Entrada automática</th><th>Rango de entrada</th><th>Éxitos</th></tr></thead><tbody>${accessRows}</tbody></table></div><p class="muted">El clásico entra directamente: no tiene la pantalla intermedia de usuario. En el constructor se conservan los cuatro segundos de exposición del usuario; parte del login ocurre durante ese intervalo. Entrada es la llegada al destino, antes de renderizar el casino o el widget.</p></section>
<section><h2>3. Referencia anterior y situación actual</h2><p class="note">La referencia anterior contiene un solo acceso por combinación. La muestra actual tiene tres y fuerza caché HTTP vacía. Estos números no permiten atribuir toda la diferencia a los cambios de código ni prometer un porcentaje de mejora del acceso.</p><div class="scroll"><table><thead><tr><th>Motor</th><th>Proveedor</th><th>Antes: entrada, n=1</th><th>Actual: mediana de entrada, n=${access.samples}</th></tr></thead><tbody>${beforeRows}</tbody></table></div><p>Mejora comprobable en el recorrido: Ases, Ganamos y Multi Skin del constructor ya no necesitan la llamada adicional de finalización. Rey obtiene pase y credenciales en una única operación atómica de base de datos.</p></section>
<section><h2>4. Dónde se emplea el tiempo</h2><p>El tiempo previo al envío puede incluir la selección del asesor y la identidad. El tiempo de <code>/start</code> incluye la preparación de sesión del proveedor. Son observaciones del navegador, no un desglose interno del servidor.</p><div class="scroll"><table><thead><tr><th>Motor</th><th>Proveedor</th><th>CTA → solicitud</th><th>Inicio de sesión /start</th><th>Llamadas finalize en ${access.samples} intentos</th></tr></thead><tbody>${gatewayRows}</tbody></table></div></section>
<section><h2>5. Clics tempranos del clásico: defecto reproducido y corregido</h2><p>La primera tanda de esta etapa registró ${report.validation.beforeClickFixFailures} fallos en ${report.validation.beforeClickFixAttempts} intentos. La traza demostró que un botón habilitado recibía el clic en window, pero el evento era detenido en document antes de llegar al código del botón. La captura de eventos de React durante la hidratación explica este defecto del motor clásico.</p><p>La corrección escucha el CTA antes de esa barrera y conserva la lógica de envío y deduplicación. Una prueba local reproduce la barrera: falla antes del cambio y pasa después, junto con los cuatro proveedores, doble clic, teléfono, promo_code y Pixel/CAPI.</p><p>Después del despliegue: <strong>${report.validation.accessSuccesses}/${report.validation.accessAttempts} accesos y ${report.validation.probeRequestsSent}/${report.validation.probeAttempts} envíos aislados</strong>. En ${report.validation.successfulClicksDespiteHydrationCapture} accesos correctos, la traza volvió a registrar la barrera de hidratación: el nuevo manejo procesó el clic antes de que fuera detenido. Los envíos aislados se interceptan antes de llamar al backend. Se conservan también los dos intentos históricos; sin sus trazas originales, no se atribuye retroactivamente cada fallo a esta causa.</p></section>
<section><h2>Alcance y límites</h2><ul>${report.methodology.notes.map(note=>'<li>'+escape(note)+'</li>').join('')}</ul><p>Esta etapa incorpora medición, documentación y la corrección del clic temprano en el clásico. API2, bypass, tracking y los cuatro segundos conservan su configuración.</p><p><a href="report.json">Datos completos en JSON</a> · <a href="comparison.csv">Tabla en CSV</a></p></section>
<footer>Generado: ${escape(report.generatedAt)}. Muestras de laboratorio; no son percentiles de usuarios reales ni una prueba de creación de cuentas en API2.</footer></html>`;
await mkdir(destination, {recursive:true});
await writeFile(join(destination,'report.json'),JSON.stringify(report,null,2));
await writeFile(join(destination,'report.html'),html);
const csv = [
  'engine,provider,form_before_ms,form_after_ms,access_before_n,entry_before_ms,access_after_n,successes,account_after_median_ms,session_after_median_ms,entry_after_median_ms,entry_after_min_ms,entry_after_max_ms',
  ...comparison.map(r=>[r.engine,r.slug,r.initialForm.formBeforeMs,r.initialForm.formAfterMs,1,r.beforeAccess.destinationMs,r.attempts,r.successes,r.afterAccess.accountMs?.median??'',r.afterAccess.sessionReadyMs?.median??'',r.afterAccess.destinationMs?.median??'',r.afterAccess.destinationMs?.min??'',r.afterAccess.destinationMs?.max??''].join(',')),
].join('\n')+'\n';
await writeFile(join(destination,'comparison.csv'),csv);
console.log(JSON.stringify({destination,validation:report.validation,comparison},null,2));
