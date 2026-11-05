import { getTemplate9Brand, template9Style } from "../../lib/landing/template9";
import type { PublicLandingConfig } from "./types";

export const TEMPLATE9_LEGAL_PAGES = {
  privacidad: "Privacidad",
  terminos: "Términos",
  cookies: "Cookies",
  "juego-responsable": "Juego Responsable",
} as const;

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export function template9LegalLinks(basePath: string, preview = false) {
  return Object.entries(TEMPLATE9_LEGAL_PAGES).map(([path, label]) =>
    `<a href="${escape(basePath)}/${path}"${preview ? ' tabindex="-1" aria-disabled="true"' : ' target="_blank" rel="noopener"'}>${label}</a>`
  ).join("");
}

/** Branded informational pages only: no Pixel, entry runtime or account requests. */
export function renderTemplate9LegalHtml(config: PublicLandingConfig, page: string, basePath: string): string | null {
  if (config.layout?.template !== 9 || !Object.hasOwn(TEMPLATE9_LEGAL_PAGES, page)) return null;
  const brand = getTemplate9Brand(config.tracking?.target_provider || "rey_de_ases", config.tracking?.skin_code);
  const name = escape(brand.name);
  const country = (config.workspaceCurrency || config.tracking?.currency) === "PYG" ? "Paraguay" : "Argentina";
  const title = TEMPLATE9_LEGAL_PAGES[page as keyof typeof TEMPLATE9_LEGAL_PAGES];
  const section = (heading: string, text: string) => `<section><h2>${heading}</h2><p>${text}</p></section>`;
  const content: Record<string, string> = {
    privacidad: section("Sobre esta página", `Esta información corresponde al acceso a ${name} desde esta landing en ${country}. Explica cómo se utilizan los datos durante el registro, la atención y la medición de este recorrido.`) +
      section("Información que se procesa", "Al completar el formulario se procesa el nombre y, si está habilitado, el teléfono que proporcionás. La navegación puede generar datos técnicos como dirección IP, navegador, identificadores del dispositivo, procedencia de la visita y eventos de uso. Si continuás al chat, también se procesan los mensajes y archivos que enviás para atender tu consulta.") +
      section("Para qué se utiliza", `Estos datos permiten preparar el acceso a ${name}, mantener la continuidad de tu cuenta, conectar con el asesor correspondiente, atender consultas y medir el funcionamiento de la landing y los resultados publicitarios.`) +
      section("Plataforma, atención y publicidad", `El recorrido utiliza la plataforma ${name}, el servicio de atención de Atrio y los servicios técnicos necesarios para operar el sitio. Cuando la landing tiene medición publicitaria habilitada, Meta Pixel y Conversions API pueden recibir identificadores y eventos para medir y atribuir conversiones. La configuración de anuncios de Meta permite revisar tus preferencias.`) +
      section("Tus datos y preferencias", "Podés consultar al asesor de tu chat sobre acceso, corrección o eliminación de tus datos y sobre las condiciones aplicables a tu cuenta. También podés administrar cookies y almacenamiento local desde el navegador. Borrarlos puede interrumpir el reconocimiento de tu acceso.") +
      `<p>Consultá también la <a href="${escape(basePath)}/cookies">información sobre cookies</a> y la <a href="https://www.facebook.com/privacy/policy/" rel="noopener" target="_blank">política de privacidad de Meta</a>.</p>`,
    terminos: section("Acceso", `Este acceso a ${name} está destinado a mayores de 18 años en ${country}. El formulario permite solicitar una cuenta y continuar al chat de atención. El envío del formulario no garantiza que el alta o la conexión se completen: dependen de la disponibilidad de los servicios.`) +
      section("Cuenta y credenciales", "Proporcioná datos correctos y mantené tus credenciales en privado. Antes de operar, revisá que la cuenta y la plataforma mostradas correspondan a tu acceso. Las reglas de la cuenta y de los juegos son las que informa la plataforma.") +
      section("Cargas, retiros y promociones", "Consultá en el chat los medios disponibles y las condiciones vigentes de cada operación: importes, plazos, verificaciones y condiciones de los bonos. La aparición de una promoción no garantiza su aplicación a todas las cuentas. Ningún resultado de juego está garantizado.") +
      section("Atención y disponibilidad", "Usá el chat del asesor vinculado a esta landing para consultas sobre tu acceso u operaciones. La disponibilidad puede variar por mantenimiento o incidencias de los servicios. Esta página no establece límites de retiro, requisitos de verificación ni condiciones comerciales distintos de los informados para tu cuenta.") +
      section("Juego responsable", `El juego implica riesgo de pérdida y debe ser una actividad de entretenimiento. Revisá las <a href="${escape(basePath)}/juego-responsable">recomendaciones de juego responsable</a> antes de participar.`),
    cookies: section("Cookies y almacenamiento del navegador", `Esta landing de ${name} utiliza cookies y almacenamiento local para mantener el recorrido y, cuando está configurado, medir publicidad. La información se guarda en el navegador que utilizás.`) +
      section("Continuidad del acceso", "La cookie propia lb_cid identifica técnicamente el navegador y ayuda a recuperar el mismo acceso, evitando registros duplicados. Puede conservarse hasta dos años. También pueden guardarse referencias de recuperación y preferencias locales, como haber cerrado el aviso de cookies.") +
      section("Medición de Meta", "Si está habilitada, la medición puede utilizar _fbp y _fbc, además de parámetros de procedencia. El identificador de clic se conserva asociado a la landing y al píxel donde se obtuvo, con una vigencia máxima de 90 días; un valor global de otra landing no basta para atribuirle esa visita. Su presencia no prueba un clic nuevo en un anuncio.") +
      section("Cómo administrarlas", "Podés borrar o bloquear cookies y almacenamiento local desde la configuración de tu navegador, y revisar tus preferencias de anuncios en Meta. Esto puede afectar la recuperación del acceso o la medición. El botón «Entendido» cierra el aviso informativo; no cambia por sí mismo la configuración publicitaria ni las preferencias del navegador.") +
      `<p><a href="https://www.facebook.com/adpreferences/ad_settings" target="_blank" rel="noopener">Preferencias publicitarias de Meta</a></p>`,
    "juego-responsable": section("Entretenimiento y riesgo", `El acceso a ${name} es sólo para mayores de 18 años. Jugar puede causar pérdidas y dependencia. No lo uses como fuente de ingresos ni como solución a problemas económicos.`) +
      section("Poné límites antes de empezar", "Decidí cuánto tiempo y dinero podés dedicar sin afectar tus gastos necesarios. Tomá pausas, evitá pedir dinero prestado para jugar y no aumentes las apuestas para recuperar pérdidas.") +
      section("Señales para prestar atención", "Detenete si jugás más de lo previsto, ocultás lo que gastás, descuidás obligaciones o sentís que no podés parar. Evitá jugar bajo efectos del alcohol o cuando estás angustiado.") +
      section("Pausas y ayuda", `Si necesitás dejar de jugar, pedí ayuda a una persona de confianza y a un profesional de salud. Consultá en la atención de ${name} qué opciones de pausa, límites o autoexclusión ofrece esa plataforma y cómo solicitarlas. No esperes a recuperar lo perdido para pedir ayuda.`),
  };
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><meta name="theme-color" content="${brand.deep}"><title>${title} · ${name}</title><style>*{box-sizing:border-box}body{margin:0;background:var(--t9-deep);color:#eee;font:16px/1.65 system-ui,-apple-system,sans-serif}main{max-width:840px;margin:auto;padding:28px 22px 56px}header{display:flex;align-items:center;gap:14px}header img{width:112px;height:56px;object-fit:contain;flex-shrink:0}@media(max-width:380px){header img{width:88px}header{gap:10px}}header strong{font-size:20px}header span{margin-left:auto;color:var(--t9-highlight)}nav{display:flex;flex-wrap:wrap;gap:12px 20px;margin:24px 0}a{color:var(--t9-secondary);text-underline-offset:3px}a:focus-visible{outline:2px solid var(--t9-highlight);outline-offset:4px}article{padding:24px;border:1px solid color-mix(in srgb,var(--t9-secondary) 30%,transparent);border-radius:24px;background:var(--t9-card-bottom,#120922)}h1{font-size:30px;line-height:1.2;margin:0 0 24px}h2{font-size:20px;margin:24px 0 6px}p{margin:8px 0;color:#c7c7c7}footer{margin-top:24px}@media(max-width:420px){main{padding:20px 16px 40px}article{padding:20px}h1{font-size:26px}}</style></head><body style="${template9Style(brand)}"><main><header><img src="${brand.logo}" alt="" width="112" height="56"><strong>${name}</strong><span>+18</span></header><nav aria-label="Información del sitio">${template9LegalLinks(basePath)}</nav><article><h1>${title}</h1>${content[page]}</article><footer><a href="${escape(basePath)}">← Volver a la landing</a></footer></main></body></html>`;
}
