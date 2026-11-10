// Compatibility/test response only. Rendering imports the tiny name manifest;
// it must not load four complete browser programs into each HTML function.
import generated from './template7RuntimeAssets.generated.json';

export function template7RuntimeAssetResponse(name: string): Response {
  const asset = Object.values(generated).find(asset => asset.name === name);
  if (!asset) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(asset.source, { headers: {
    'Content-Type': 'text/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  } });
}
