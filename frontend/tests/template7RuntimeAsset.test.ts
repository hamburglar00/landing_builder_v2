import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {template7RuntimeAsset,template7RuntimeAssetResponse} from '../components/public-landing/template7RuntimeAsset';
import {renderPublicLandingHtml,renderClassicTemplate7InlineHtml} from '../components/public-landing/renderPublicLandingHtml';
import {optimizeTemplate7Images,template8Image} from '../lib/landing/template7Images';
import type {PublicLandingConfig} from '../components/public-landing/types';

for(const template of [7,8] as const)for(const classic of [false,true])test(`T${template} ${classic?'classic':'builder'} reusable runtime is immutable, config-free and matches its content hash`,async()=>{
  const asset=template7RuntimeAsset(template,classic);
  const hash=createHash('sha256').update(asset.source).digest('hex').slice(0,24);
  assert.ok(asset.name.endsWith('-'+hash+'.js'));
  assert.equal(readFileSync(new URL('../public/public-assets/template-entry/'+asset.name,import.meta.url),'utf8'),asset.source);
  assert.doesNotMatch(asset.source,/__PUBLIC_LANDING_RUNTIME_CONFIG__\s*=/);
  const response=template7RuntimeAssetResponse(asset.name);
  assert.equal(response.status,200);
  assert.match(response.headers.get('Cache-Control')!,/immutable/);
  assert.equal(await response.text(),asset.source);
  assert.equal(template7RuntimeAssetResponse(asset.name.replace(hash,'0'.repeat(24))).status,404);
  const config:PublicLandingConfig={id:'a0000000-0000-4000-8000-000000000001',schemaVersion:1,updatedAt:'',comment:'',name:'Secret Tenant Marker',layout:{template,ctaPosition:'bottom'},tracking:{pixelId:'987654321',postUrl:'',landingTag:'TEST'},content:{logoUrl:'',title:['Cuenta'],subtitle:[],ctaText:'Crear',template8:{cardCount:1,backgroundImageUrl:'',cards:[],headerText:'Elegí',footerText:''}}};
  const html=classic?renderClassicTemplate7InlineHtml({slug:'tenant-specific-marker',config},'function getOrCreateDeviceId(){return "stable-fixture";}'):renderPublicLandingHtml({slug:'tenant-specific-marker',config});
  assert.ok(html.includes('/public-assets/template-entry/'+asset.name));
  assert.doesNotMatch(html,/function firePixelContact\(/);
  assert.ok(Buffer.byteLength(html)<65000,`HTML is ${Buffer.byteLength(html)} bytes`);
  assert.doesNotMatch(asset.source,/tenant-specific-marker|987654321|Secret Tenant Marker|stable-fixture/);
});

test('T8 responsive images keep saved originals and private/third-party resources untouched',()=>{
  const original='https://audit.supabase.co/storage/v1/object/public/landing-images/a/image.png';
  const config={layout:{template:8},content:{template8:{backgroundImageUrl:original,cards:[{imageUrl:original},{imageUrl:'https://other.example/logo.png'}]}}};
  const snapshot=JSON.stringify(config),optimized=optimizeTemplate7Images(config);
  assert.equal(JSON.stringify(config),snapshot);
  assert.deepEqual(optimizeTemplate7Images(optimized),optimized);
  const image=template8Image(optimized.content.template8.cards[0].imageUrl);
  assert.match(image.srcSet,/240w, .*480w, .*720w$/);
  assert.equal(optimized.content.template8.cards[1].imageUrl,'https://other.example/logo.png');
});
