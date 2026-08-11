import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politica de privacidad | PanelBot Admin",
  description:
    "Politica de privacidad de PanelBot Admin para el uso del panel, landings, integraciones publicitarias y WhatsApp Cloud API.",
  robots: {
    index: true,
    follow: true,
  },
};

const updatedAt = "11 de agosto de 2026";

const sections = [
  {
    title: "1. Responsable y alcance",
    body: [
      "Esta politica describe como PanelBot Admin trata informacion relacionada con el uso del panel, landings, integraciones publicitarias, WhatsApp Cloud API, webhooks y servicios asociados.",
      "El servicio es utilizado por clientes que configuran sus propios canales, gerencias, telefonos de contacto, pixels publicitarios e integraciones. Cada cliente es responsable por la informacion que carga y por el uso que realiza de las herramientas.",
    ],
  },
  {
    title: "2. Informacion que podemos tratar",
    body: [
      "Podemos tratar datos de cuenta y configuracion, como usuarios, correos, permisos, integraciones, identificadores de Meta, pixels, tokens tecnicos, gerencias, telefonos configurados y preferencias operativas.",
      "Tambien podemos tratar informacion generada por interacciones comerciales, como eventos de contacto, mensajes recibidos, telefonos de usuarios, nombres de perfil de WhatsApp, codigos promocionales, datos de atribucion publicitaria, identificadores de anuncios y eventos de conversion.",
      "Ademas, se pueden registrar datos tecnicos necesarios para seguridad, auditoria y operacion, como timestamps, logs, estado de procesamiento, errores, IPs, user agents, cookies o identificadores equivalentes cuando correspondan.",
    ],
  },
  {
    title: "3. Finalidades del tratamiento",
    body: [
      "Usamos la informacion para operar el servicio, administrar landings y configuraciones, derivar contactos a telefonos asignados, procesar eventos de WhatsApp Cloud API, medir resultados comerciales y mantener trazabilidad de conversiones.",
      "Tambien usamos datos para seguridad, prevencion de abuso, depuracion de errores, soporte tecnico, mejoras del producto, cumplimiento de obligaciones aplicables y generacion de reportes para los clientes.",
      "Cuando un cliente configura Meta Pixel, Conversions API u otras integraciones, determinados datos pueden utilizarse para medicion, atribucion, optimizacion publicitaria y envio de eventos a plataformas externas segun la configuracion elegida por el cliente.",
    ],
  },
  {
    title: "4. WhatsApp Cloud API y comunicaciones",
    body: [
      "Cuando se utiliza WhatsApp Cloud API, podemos recibir y almacenar eventos enviados por Meta, incluyendo identificadores de mensajes, numero de telefono del usuario, nombre de perfil, contenido del mensaje recibido, estado de mensajes enviados, referral o datos asociados a anuncios Click-to-WhatsApp cuando Meta los entregue.",
      "Esta informacion se usa para responder consultas, asignar un telefono de atencion, generar codigos de seguimiento, registrar el recorrido comercial y permitir que el cliente de PanelBot Admin gestione sus metricas.",
    ],
  },
  {
    title: "5. Terceros e integraciones",
    body: [
      "El servicio puede integrarse con proveedores externos como Supabase, Vercel, Meta Platforms, WhatsApp Business Platform, servicios de bots, analitica, hosting, mensajeria, bases de datos y otros proveedores tecnicos necesarios para operar la plataforma.",
      "Cuando un cliente activa integraciones con Meta, WhatsApp u otros servicios, el tratamiento de datos por esos terceros se rige tambien por sus propias politicas y condiciones.",
    ],
  },
  {
    title: "6. Conservacion y seguridad",
    body: [
      "Conservamos la informacion durante el tiempo necesario para prestar el servicio, mantener historiales operativos, cumplir obligaciones, resolver incidencias, prevenir fraude o abuso y permitir auditoria de eventos.",
      "Aplicamos medidas tecnicas y organizativas razonables para proteger la informacion, incluyendo controles de acceso, separacion por usuario o cliente, politicas de permisos, registros de eventos y uso de credenciales de servicio para procesos backend.",
    ],
  },
  {
    title: "7. Derechos y solicitudes",
    body: [
      "Las personas pueden solicitar acceso, rectificacion, actualizacion o eliminacion de sus datos cuando corresponda. En muchos casos, las solicitudes deben dirigirse al comercio o cliente que utiliza PanelBot Admin como responsable directo de la relacion comercial.",
      "Para consultas relacionadas con privacidad o datos tratados por la plataforma, se puede escribir a privacidad@panelbotadmin.com.",
    ],
  },
  {
    title: "8. Cambios en esta politica",
    body: [
      "Podemos actualizar esta politica para reflejar cambios legales, tecnicos u operativos. La version vigente sera la publicada en esta pagina, indicando su fecha de ultima actualizacion.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-10 text-zinc-200 sm:px-8">
      <article className="mx-auto max-w-4xl">
        <header className="border-b border-zinc-800 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">
            PanelBot Admin
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Politica de privacidad
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
            Ultima actualizacion: {updatedAt}. Esta pagina informa como se tratan
            datos en el panel, landings, integraciones publicitarias y WhatsApp
            Cloud API.
          </p>
        </header>

        <div className="space-y-8 py-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-zinc-100">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-zinc-300">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="border-t border-zinc-800 py-6 text-xs leading-6 text-zinc-500">
          <p>
            Esta politica tiene fines informativos para usuarios y plataformas de
            integracion. No reemplaza acuerdos comerciales especificos ni
            obligaciones particulares asumidas por cada cliente frente a sus
            propios usuarios.
          </p>
        </footer>
      </article>
    </main>
  );
}
