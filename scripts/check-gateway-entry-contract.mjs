import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHmac} from 'node:crypto';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const {build} = require('esbuild');
const workspace = fileURLToPath(new URL('../../', import.meta.url));
async function load(repo, source) {
  const root = workspace + repo;
  const result = await build({absWorkingDir:root, tsconfig:root+'/tsconfig.json',
    stdin:{contents:source,resolveDir:root,loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external'});
  const module={exports:{}};
  new Function('module','exports','require',result.outputFiles[0].text)(module,module.exports,createRequire(root+'/package.json'));
  return module.exports;
}
const secret='gateway-entry-contract-fixture-secret-32-characters';
process.env.INTERNAL_CHAT_GATEWAY_SECRET=secret;
process.env.INTERNAL_CHAT_GATEWAY_ORIGINS='https://gateway.fixture.test';
const {verifyGatewayEmbedToken}=await load('internal-chat','export {verifyGatewayEmbedToken} from "./src/lib/gateway-contract";');
const cases=[];
for(const [repo,provider] of [['landing-autologuin','rey_de_ases'],['ases-gateway','ases_del_norte'],['ganamos-gateway','ganamos_net'],['multi-skin-gateway','multi_skin']]){
  const theme=repo==='landing-autologuin'?'':repo==='multi-skin-gateway'
    ?'import{getSkinConfig}from"./src/lib/skin-registry"; const theme=getSkinConfig("ganamos_plus").widgetTheme;'
    :'import{getProviderConfig}from"./src/lib/skin-registry";const theme=getProviderConfig().widgetTheme;';
  const {make}=await load(repo,'import{createChatEmbedUrl}from"./src/lib/chat-embed-token";'+theme+'export const make=(input)=>createChatEmbedUrl({...input,'+(theme?'widgetTheme:theme,':'')+'});');
  const input={appId:'gateway_fixture',advisorSlug:'gera',baseUrl:'https://chat.fixture.test/embed',parentOrigin:'https://gateway.fixture.test',
    playerId:'36c0ecb1-10e4-4a11-a2b8-2a25ca0f5f11',playerProviderAccountId:'46c0ecb1-10e4-4a11-a2b8-2a25ca0f5f12',targetProvider:provider,promoCode:'LP-fixture',secret};
  const token=new URL(make({...input,initialAction:'wallet'})).searchParams.get('token');
  const verified=verifyGatewayEmbedToken(token);assert.equal(verified?.initialAction,'wallet');assert.equal(verified?.targetProvider,provider);
  const legacy=verifyGatewayEmbedToken(new URL(make(input)).searchParams.get('token'));assert.ok(legacy);assert.equal(legacy.initialAction,undefined);
  const [version,body,signature]=token.split('.'),payload=JSON.parse(Buffer.from(body,'base64url'));
  payload.initialAction='withdraw';const tampered=Buffer.from(JSON.stringify(payload)).toString('base64url');
  assert.equal(verifyGatewayEmbedToken(`${version}.${tampered}.${signature}`),null);
  const signed=`${version}.${tampered}`;assert.equal(verifyGatewayEmbedToken(`${signed}.${createHmac('sha256',secret).update(signed).digest('base64url')}`),null);
  cases.push({repo,provider,checks:4});
}
console.log(JSON.stringify({passed:16,cases}));
