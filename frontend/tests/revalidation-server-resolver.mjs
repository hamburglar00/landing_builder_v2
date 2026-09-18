export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return {
    url: new URL('../node_modules/next/dist/compiled/server-only/empty.js', import.meta.url).href,
    shortCircuit: true,
  };
  return nextResolve(specifier, context);
}
