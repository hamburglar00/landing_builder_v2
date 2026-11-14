export const TEMPLATE9_CSS = `
.template9,.template9 *{box-sizing:border-box}
.template9{position:fixed;inset:0;height:100%;height:100dvh;display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom);background:var(--t9-deep);font:16px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff;isolation:isolate}
.template9 [hidden]{display:none!important}
.template9 button{font-family:inherit;cursor:pointer}
.template9 input,.template9 .template9__cta,.template9__cookies button[data-template9-cookie-dismiss]{font-family:Arial,sans-serif}
.template9__background,.template9__overlay{position:absolute;inset:0;pointer-events:none;z-index:-1}
.template9__background{background:radial-gradient(130% 90% at 50% 6%,var(--t9-background-glow,color-mix(in srgb,var(--t9-primary) 34%,transparent)) 0%,var(--t9-background-mid,color-mix(in srgb,var(--t9-primary) 25%,var(--t9-deep))) 40%,var(--t9-background-low,color-mix(in srgb,var(--t9-primary) 8%,var(--t9-deep))) 70%,var(--t9-deep) 100%)}
.template9__overlay{background:radial-gradient(120% 90% at 50% 15%,var(--t9-overlay-glow,color-mix(in srgb,var(--t9-primary) 26%,transparent)),transparent 55%),radial-gradient(90% 60% at 50% 50%,color-mix(in srgb,var(--t9-deep) 50%,transparent),transparent 70%),linear-gradient(180deg,color-mix(in srgb,var(--t9-deep) 74%,transparent),color-mix(in srgb,var(--t9-deep) 90%,transparent))}
/* The notice takes its actual height in the layout; it never covers the form/footer. */
.template9__wrap{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:safe center;padding:max(22px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) 20px max(20px,env(safe-area-inset-left));overflow-y:auto;scroll-padding-block:16px}
.template9__card{flex-shrink:0;width:100%;max-width:400px;background:linear-gradient(180deg,var(--t9-card-top,color-mix(in srgb,var(--t9-primary) 9%,#140c24)),var(--t9-card-bottom,color-mix(in srgb,var(--t9-deep) 94%,#201330)));backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid color-mix(in srgb,var(--t9-secondary) 35%,transparent);border-radius:24px;padding:calc(32px - 32px * (var(--t9-logo-scale,1) - 1)) 26px calc(26px - 20px * (var(--t9-logo-scale,1) - 1));box-shadow:0 24px 70px #0009,0 0 0 1px #ffffff0a inset,0 0 60px color-mix(in srgb,var(--t9-primary) 25%,transparent);text-align:center;animation:t9-in .5s cubic-bezier(.16,1,.3,1) both}
.template9__logo{width:calc(220px * var(--t9-logo-scale,1));max-width:100%;height:calc(110px * var(--t9-logo-scale,1));margin:0 auto 18px;display:block;object-fit:contain}
.template9 h1{font-size:27px;line-height:1.15;font-weight:800;letter-spacing:-.5px;text-wrap:balance;margin:0 0 8px;overflow-wrap:anywhere}
.template9 h1 b{background:linear-gradient(90deg,var(--t9-secondary),var(--t9-highlight));background-clip:text;-webkit-background-clip:text;color:transparent}
.template9__subtitle{font-size:15px;color:var(--t9-subtitle,color-mix(in srgb,var(--t9-highlight) 22%,#c8bde0));line-height:1.4;margin:0 0 calc(24px - 24px * (var(--t9-logo-scale,1) - 1))}
.template9 input{width:100%;height:54px;font-size:17px;padding:16px 18px;border-radius:14px;border:1.5px solid color-mix(in srgb,var(--t9-secondary) 30%,transparent);background:var(--t9-input,#0a051499);color:#fff;outline:none;transition:border-color .2s,box-shadow .2s;-webkit-appearance:none}
.template9 input::placeholder{color:var(--t9-placeholder,#7a6e94)}
.template9 input:focus{border-color:var(--t9-secondary);box-shadow:0 0 0 4px color-mix(in srgb,var(--t9-secondary) 18%,transparent)}
.template9__phone-label{display:block;font-size:12px;text-align:left;margin:12px 0 6px}
.template9 .template9__cta{width:100%;margin-top:16px;min-height:60px;font-size:18px;font-weight:800;letter-spacing:.3px;line-height:normal;color:var(--t9-cta-foreground,#fff);border:0;border-radius:14px;padding:17px;background:linear-gradient(135deg,var(--t9-primary),var(--t9-secondary));box-shadow:0 10px 30px color-mix(in srgb,var(--t9-primary) 50%,transparent),0 0 20px color-mix(in srgb,var(--t9-secondary) 35%,transparent);transition:transform .12s,box-shadow .2s;animation:t9-glow 2.4s ease-in-out infinite}
.template9__cta:active{transform:scale(.97)}
.template9__cta[disabled]{cursor:default;animation:none}
.template9__cta[aria-busy=true]{opacity:.75}
.template9__trust{margin:calc(18px - 16px * (var(--t9-logo-scale,1) - 1)) 0 0;font-size:12.5px;color:var(--t9-muted,#9d90ba);letter-spacing:.2px}
.template9__error{margin:14px 0 0;font-size:13.5px;color:#ffc2c2;background:#ff40401a;border:1px solid #ff5a5a57;border-radius:12px;padding:10px 13px;line-height:1.35;text-align:left}
.template9__sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.template9__footer{flex-shrink:0;width:100%;max-width:460px;margin:calc(22px - 20px * (var(--t9-logo-scale,1) - 1)) auto 0;padding:0 8px;text-align:center}
.template9__footer nav{display:flex;flex-wrap:wrap;gap:0 8px;justify-content:center;margin-bottom:6px}
.template9__footer a{color:var(--t9-link,#b49ad6);font-size:11.5px;font-weight:600;text-decoration:underline;background:transparent;border:0;padding:0}
.template9__footer nav a{padding:9px 6px;min-height:40px;display:inline-flex;align-items:center;line-height:1}
.template9__footer p{font-size:10.5px;line-height:1.4;color:var(--t9-muted,#988cb3);margin:3px 0}
.template9__cookies{position:relative;flex-shrink:0;margin:0 max(12px,env(safe-area-inset-right)) 12px max(12px,env(safe-area-inset-left));z-index:3;display:flex;gap:10px;align-items:center;justify-content:center;background:var(--t9-surface,color-mix(in srgb,var(--t9-primary) 8%,#120a22));border:1px solid color-mix(in srgb,var(--t9-secondary) 45%,transparent);border-radius:14px;padding:11px 14px;font-size:13px;line-height:1.4;color:#f4ecff;box-shadow:0 12px 34px #0009}
.template9__cookies span{flex:0 1 auto;min-width:0}
.template9__cookies a{color:var(--t9-highlight);font-size:inherit;font-weight:700;text-decoration:underline;background:none;border:0;padding:0}
.template9__cookies button[data-template9-cookie-dismiss]{flex:none;min-height:44px;font-size:13px;font-weight:800;color:var(--t9-cta-foreground,#fff);border:0;border-radius:10px;padding:9px 18px;background:linear-gradient(135deg,var(--t9-primary),var(--t9-secondary))}
.template9 button:focus-visible,.template9 a:focus-visible{outline:2px solid var(--t9-highlight);outline-offset:3px}
.template9--preview{position:relative;width:100%;height:100dvh;min-height:0}
.template9--preview .template9__card,.template9--preview .template9__cta{animation:none}
.template9--preview a{pointer-events:none}
@keyframes t9-in{from{opacity:0;transform:translateY(24px) scale(.96)}to{opacity:1;transform:none}}
@keyframes t9-glow{0%,100%{box-shadow:0 10px 30px color-mix(in srgb,var(--t9-primary) 50%,transparent),0 0 18px color-mix(in srgb,var(--t9-secondary) 30%,transparent)}50%{box-shadow:0 10px 34px color-mix(in srgb,var(--t9-primary) 62%,transparent),0 0 30px color-mix(in srgb,var(--t9-secondary) 50%,transparent)}}
@media(max-width:380px){.template9__card{padding:26px 20px 22px}.template9 h1{font-size:24px}}
@media(max-width:599px) and (max-height:740px){
  .template9__wrap{padding:max(14px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) 14px max(14px,env(safe-area-inset-left))}
  .template9__card{padding:calc(20px - 20px * (var(--t9-logo-scale,1) - 1)) 20px calc(18px - 20px * (var(--t9-logo-scale,1) - 1))}.template9__logo{width:calc(180px * var(--t9-logo-scale,1));height:calc(70px * var(--t9-logo-scale,1));margin-bottom:12px}
  .template9 h1{font-size:24px}.template9__subtitle{font-size:14px;margin-bottom:calc(16px - 12px * (var(--t9-logo-scale,1) - 1))}
  .template9 input{height:48px;padding:12px 14px}.template9 .template9__cta{min-height:50px;padding:13px;margin-top:12px;font-size:16px}
  .template9__trust{font-size:11.5px;margin-top:calc(12px - 8px * (var(--t9-logo-scale,1) - 1))}.template9__footer{margin-top:calc(12px - 12px * (var(--t9-logo-scale,1) - 1));padding:0 4px}
  .template9__footer nav{gap:0 4px;margin-bottom:3px}.template9__footer nav button{font-size:10.5px;min-height:36px;padding:8px 4px}
  .template9__footer p{font-size:10px;line-height:1.35}.template9__footer p a{font-size:inherit}
  .template9__cookies{font-size:11.5px;padding:9px 10px;gap:8px}
  .template9__cookies button[data-template9-cookie-dismiss]{font-size:12px;padding:9px 12px}
}
@media(max-width:599px) and (max-height:660px){
  .template9__wrap{padding-top:max(8px,env(safe-area-inset-top));padding-bottom:8px}
  .template9__card{padding:calc(12px - 16px * (var(--t9-logo-scale,1) - 1)) 16px}.template9__logo{width:calc(160px * var(--t9-logo-scale,1));height:calc(56px * var(--t9-logo-scale,1));margin-bottom:calc(6px - 12px * (var(--t9-logo-scale,1) - 1))}
  .template9 h1{font-size:22px;margin-bottom:6px}.template9__subtitle{font-size:13px;margin-bottom:8px}
  .template9 input{height:44px;padding:10px 12px;font-size:16px}.template9__phone-label{font-size:11px;margin-top:8px;margin-bottom:4px}
  .template9 .template9__cta{min-height:46px;margin-top:8px;padding:12px}.template9__trust{font-size:10.5px;margin-top:calc(8px - 8px * (var(--t9-logo-scale,1) - 1))}
  .template9__footer{margin-top:6px}.template9__footer p{font-size:9.5px;line-height:1.3;margin:2px 0}
  .template9__footer nav{gap:0}.template9__footer nav a{font-size:10px;min-height:28px;padding:6px 3px}
  .template9__cookies{font-size:10.5px;line-height:1.35;margin-bottom:6px}
}
@media(max-height:480px) and (min-width:600px){
  .template9__wrap{flex-direction:row;gap:24px;justify-content:center;padding-top:max(4px,env(safe-area-inset-top));padding-bottom:4px}.template9__card{max-width:320px;padding:calc(4px - 4px * (var(--t9-logo-scale,1) - 1)) 16px}
  .template9__logo{width:calc(120px * var(--t9-logo-scale,1));height:calc(38px * var(--t9-logo-scale,1));margin-bottom:calc(4px - 8px * (var(--t9-logo-scale,1) - 1))}
  .template9 h1{font-size:22px;margin-bottom:calc(6px - 4px * (var(--t9-logo-scale,1) - 1))}.template9__subtitle{font-size:13px;margin-bottom:calc(8px - 8px * (var(--t9-logo-scale,1) - 1))}
  .template9 input{height:44px;padding:10px 12px;font-size:16px}.template9__phone-label{font-size:11px;margin:8px 0 4px}
  .template9 .template9__cta{min-height:46px;margin-top:8px;padding:12px;font-size:16px}.template9__trust{font-size:10.5px;margin-top:calc(8px - 8px * (var(--t9-logo-scale,1) - 1))}
  .template9__footer{max-width:360px;margin:0}.template9__cookies{font-size:11px}
}
@media(min-width:600px) and (min-height:481px) and (max-height:740px){
  .template9__wrap{padding-bottom:12px}
  .template9__card{padding-top:calc(32px - 36px * (var(--t9-logo-scale,1) - 1));padding-bottom:calc(26px - 28px * (var(--t9-logo-scale,1) - 1))}
  .template9__logo{height:calc(84px * var(--t9-logo-scale,1));margin-bottom:12px}
  .template9__footer{max-width:560px;margin-top:calc(12px / var(--t9-logo-scale,1))}
  .template9__footer nav{margin-bottom:3px}.template9__footer nav a{min-height:28px;padding:7px 6px}
  .template9__footer p{font-size:10px;line-height:1.4}
  .template9__footer p a{font-size:inherit}
}
/* Full-width gallery composition. The public page/editor retain their legal content. */
.template9--gallery .template9__wrap{padding:24px 16px 100px;justify-content:flex-start;overflow:hidden}
.template9--gallery .template9__card{padding:20px 18px calc(16px - 8px * (var(--t9-logo-scale,1) - 1));border-radius:22px}
.template9--gallery .template9__logo{width:calc(220px * var(--t9-logo-scale,1));height:calc(96px * var(--t9-logo-scale,1));margin-bottom:14px}
.template9--gallery h1{font-size:24px;margin-bottom:6px}
.template9--gallery .template9__subtitle{font-size:14px;margin-bottom:18px}
.template9--gallery input{height:44px;padding:12px 14px;font-size:15px;border-radius:11px}
.template9--gallery .template9__cta{min-height:48px;font-size:16px;padding:13px;margin-top:12px;border-radius:11px;animation:none}
.template9--gallery .template9__trust{font-size:11px;margin-top:12px}
.template9--gallery .template9__footer,.template9--gallery .template9__cookies,.template9--gallery .template9__phone-label,.template9--gallery [data-template7-whatsapp]{display:none}
@media(prefers-reduced-motion:reduce){.template9__card,.template9__cta{animation:none}}
`;
