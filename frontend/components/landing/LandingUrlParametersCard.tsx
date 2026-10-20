type LandingUrlParametersCardProps = {
  landingName: string;
};

export function LandingUrlParametersCard({ landingName }: LandingUrlParametersCardProps) {
  const slug = landingName.trim();
  const example = `landing=${encodeURIComponent(slug)}&facebook=MI_FACEBOOK&portofolio=MI_PORTOFOLIO&cp=MI_CUENTA_PUBLICITARIA&campana={{campaign.name}}&conjunto={{adset.name}}&anuncio={{ad.name}}`;

  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="text-sm font-semibold text-zinc-200">Parámetros de URL disponibles</h3>
      <p className="text-xs text-zinc-400">
        En ambos motores, podés usar el dominio de publicación sin ruta en el CTA
        de Meta y elegir la landing desde el campo «Parámetros de URL» de cada anuncio.
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
        <dt className="font-mono text-emerald-300">landing</dt>
        <dd className="text-zinc-300">Define la landing que se muestra. Tiene prioridad sobre la ruta de la URL.</dd>
        <dt className="font-mono text-emerald-300">facebook</dt>
        <dd className="text-zinc-300">Identifica el Facebook desde el que se hizo la publicidad.</dd>
        <dt className="font-mono text-emerald-300">portofolio</dt>
        <dd className="text-zinc-300">Identifica el portofolio desde el que se hizo la publicidad.</dd>
        <dt className="font-mono text-emerald-300">cp</dt>
        <dd className="text-zinc-300">Identifica la cuenta publicitaria.</dd>
        <dt className="font-mono text-emerald-300">campana</dt>
        <dd className="text-zinc-300">Identifica la campaña.</dd>
        <dt className="font-mono text-emerald-300">conjunto</dt>
        <dd className="text-zinc-300">Identifica el conjunto de anuncios.</dd>
        <dt className="font-mono text-emerald-300">anuncio</dt>
        <dd className="text-zinc-300">Identifica el anuncio.</dd>
      </dl>
      <div className="space-y-2 border-t border-zinc-800 pt-4">
        <p className="text-xs font-medium text-zinc-300">Ejemplo para esta landing en Meta</p>
        <p className="text-xs text-zinc-400">Reemplazá MI_FACEBOOK, MI_PORTOFOLIO y MI_CUENTA_PUBLICITARIA por tus nombres o identificadores.</p>
        {slug ? (
          <code className="block select-all break-all rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-200">
            {example}
          </code>
        ) : (
          <p className="text-xs text-zinc-400">Ingresá el nombre de la landing para ver el ejemplo.</p>
        )}
      </div>
    </section>
  );
}
