import assert from 'node:assert/strict';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DEFAULT_CONFIG} from '../lib/landing/mocks';
import {switchLandingTemplate} from '../lib/landing/templateVariants';
import {buildLandingConfig} from '../lib/landing/buildLandingConfig';
import {buildPublicLandingRuntimeSource} from '../components/public-landing/PublicLandingRuntimeScript';
import {buildTemplate7RuntimeConfig} from '../components/public-landing/template7FastRuntime';
import {LandingEditorForm} from '../components/landing/LandingEditorForm';
import type {TemplateOption,TargetProvider} from '../lib/landing/types';

const source=buildPublicLandingRuntimeSource();
const pixelFunction=source.match(/function firePixelContact\(eventId\) \{[\s\S]*?\n      \}/)![0];
for(const template of ['template7','template8','template9'] as TemplateOption[]) {
  test(`${template} publishes and executes only the selected Meta event for all casinos`,()=>{
    for(const provider of ['rey_de_ases','ases_del_norte','ganamos_net','multi_skin'] as TargetProvider[])for(const event of ['Lead','CompleteRegistration'] as const){
      const theme={...switchLandingTemplate(DEFAULT_CONFIG,template),targetProvider:provider,ctaMetaEvent:event};
      const published=buildLandingConfig({id:'11111111-1111-4111-8111-111111111111',name:'fixture',comment:'',pixelId:'123',postUrl:'https://events.invalid',landingTag:'TEST',config:theme});
      const cfg=buildTemplate7RuntimeConfig('fixture',{...published,layout:{...published.layout,ctaPosition:'bottom'}});
      assert.equal(published.tracking.ctaMetaEvent,event);assert.equal(cfg.ctaMetaEvent,event);
      const calls:unknown[][]=[];
      runInNewContext(pixelFunction+';firePixelContact("original-id");',{cfg,window:{fbq:(...args:unknown[])=>calls.push(args)}});
      assert.equal(calls.length,1);assert.equal(calls[0][1],event);
      assert.equal((calls[0][3] as any).eventID,'original-id');
      assert.equal((calls[0][2] as any).status,event==='CompleteRegistration'?'registered':undefined);
      assert.equal(switchLandingTemplate(switchLandingTemplate(theme,'template2'),template).ctaMetaEvent,event);
    }
  });
}
test('selector is shared by both editors, applies only to T7/T8/T9 and defaults legacy rows to Lead',()=>{
  for(const template of ['template2','template7','template8','template9'] as TemplateOption[]){
    const theme=switchLandingTemplate(DEFAULT_CONFIG,template);
    const html=renderToStaticMarkup(createElement(LandingEditorForm,{config:theme,setConfig(){},onSave(){},onReset(){}}));
    assert.equal(html.includes('Evento de Meta al tocar el CTA'),template!=='template2');
  }
});
