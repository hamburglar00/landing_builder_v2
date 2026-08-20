export const PUBLIC_LANDING_CSS = String.raw`
html, body {
  margin: 0;
  min-height: 100%;
  background: #000;
  color: #fff;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

*, *::before, *::after {
  box-sizing: border-box;
}

p, h1 {
  margin: 0;
}

img {
  max-width: 100%;
}

button, a {
  -webkit-tap-highlight-color: transparent;
}

.public-privacy-footer {
  position: fixed;
  z-index: 20;
  left: 50%;
  bottom: max(8px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
}

.public-privacy-link {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  padding: 5px 9px;
  color: rgba(255, 255, 255, 0.78);
  background: rgba(0, 0, 0, 0.66);
  font: 500 11px/1.2 Arial, Helvetica, sans-serif;
  cursor: pointer;
  backdrop-filter: blur(8px);
}

.public-privacy-link:hover,
.public-privacy-link:focus-visible {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.45);
}

.public-privacy-link:focus-visible,
.public-privacy-dialog__close:focus-visible,
.public-privacy-dialog a:focus-visible {
  outline: 2px solid #25d366;
  outline-offset: 2px;
}

.public-privacy-dialog {
  width: min(92vw, 620px);
  max-height: min(82vh, 720px);
  margin: auto;
  padding: 0;
  overflow: hidden;
  border: 1px solid #343a46;
  border-radius: 16px;
  color: #e8ebf0;
  background: #12151b;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
}

.public-privacy-dialog::backdrop {
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(3px);
}

.public-privacy-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid #2a2f39;
}

.public-privacy-dialog__header h2 {
  margin: 0;
  color: #fff;
  font: 700 18px/1.25 Arial, Helvetica, sans-serif;
}

.public-privacy-dialog__close {
  appearance: none;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border: 1px solid #3a414d;
  border-radius: 8px;
  color: #d8dde5;
  background: #1b2028;
  font: 400 24px/1 Arial, Helvetica, sans-serif;
  cursor: pointer;
}

.public-privacy-dialog__content {
  max-height: calc(min(82vh, 720px) - 69px);
  padding: 18px 20px 22px;
  overflow-y: auto;
  color: #c9cfd8;
  font: 400 13px/1.55 Arial, Helvetica, sans-serif;
}

.public-privacy-dialog__content p {
  margin: 0 0 13px;
}

.public-privacy-dialog__content strong {
  color: #fff;
}

.public-privacy-dialog__links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  padding-top: 3px;
}

.public-privacy-dialog__links a {
  color: #67e8a5;
  text-decoration: underline;
  text-underline-offset: 3px;
}

body.public-lead-capture-open {
  overflow: hidden;
}

.public-lead-capture {
  position: fixed;
  z-index: 80;
  inset: 0;
  display: grid;
  place-items: center;
  padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(7px);
}

.public-lead-capture[hidden] {
  display: none;
}

.public-lead-capture__card {
  position: relative;
  width: min(100%, 430px);
  max-height: min(86vh, 620px);
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 22px;
  padding: 24px;
  color: #f8fafc;
  background:
    radial-gradient(circle at 18% 0%, rgba(37, 211, 102, 0.18), transparent 36%),
    linear-gradient(180deg, rgba(19, 25, 34, 0.98), rgba(9, 12, 18, 0.98));
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.64);
}

.public-lead-capture__close {
  appearance: none;
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.82);
  background: rgba(255, 255, 255, 0.06);
  font: 400 22px/1 Arial, Helvetica, sans-serif;
  cursor: pointer;
}

.public-lead-capture__card h2 {
  margin: 0;
  padding-right: 34px;
  color: #fff;
  font: 800 22px/1.12 Arial, Helvetica, sans-serif;
  letter-spacing: -0.03em;
}

.public-lead-capture__description {
  margin: 10px 0 0;
  color: rgba(226, 232, 240, 0.78);
  font: 500 13px/1.45 Arial, Helvetica, sans-serif;
}

.public-lead-capture__grid {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.public-lead-capture__field {
  display: grid;
  gap: 6px;
  color: rgba(226, 232, 240, 0.86);
  font: 700 11px/1.2 Arial, Helvetica, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.public-lead-capture__input {
  width: 100%;
  min-height: 46px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 14px;
  padding: 0 14px;
  color: #fff;
  background: rgba(2, 6, 12, 0.72);
  outline: none;
  font: 600 15px/1 Arial, Helvetica, sans-serif;
}

.public-lead-capture__input::placeholder {
  color: rgba(148, 163, 184, 0.62);
}

.public-lead-capture__input:focus {
  border-color: rgba(37, 211, 102, 0.72);
  box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.16);
}

.public-lead-capture__actions {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.public-lead-capture__submit,
.public-lead-capture__skip {
  appearance: none;
  min-height: 46px;
  border-radius: 999px;
  padding: 0 16px;
  font: 800 14px/1 Arial, Helvetica, sans-serif;
  cursor: pointer;
}

.public-lead-capture__submit {
  border: 0;
  color: #04130a;
  background: #25d366;
  box-shadow: 0 14px 30px rgba(37, 211, 102, 0.24);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  animation: publicLeadCapturePulse 2.7s ease-in-out infinite;
}

.public-lead-capture__skip {
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(226, 232, 240, 0.86);
  background: rgba(255, 255, 255, 0.04);
  text-transform: uppercase;
  letter-spacing: 0.035em;
}

.public-lead-capture__submit:focus-visible,
.public-lead-capture__skip:focus-visible,
.public-lead-capture__close:focus-visible {
  outline: 2px solid #25d366;
  outline-offset: 2px;
}

@media (max-width: 430px), (max-height: 720px) {
  .public-lead-capture {
    align-items: center;
    padding: 10px 10px max(10px, env(safe-area-inset-bottom));
  }

  .public-lead-capture__card {
    width: 100%;
    max-height: min(92svh, 580px);
    border-radius: 18px;
    padding: 16px;
  }

  .public-lead-capture__close {
    top: 9px;
    right: 9px;
    width: 28px;
    height: 28px;
    font-size: 19px;
  }

  .public-lead-capture__card h2 {
    padding-right: 30px;
    font-size: 18px;
    line-height: 1.08;
  }

  .public-lead-capture__description {
    margin-top: 7px;
    font-size: 12px;
    line-height: 1.32;
  }

  .public-lead-capture__grid {
    gap: 7px;
    margin-top: 12px;
  }

  .public-lead-capture__field {
    gap: 4px;
    font-size: 10px;
    letter-spacing: 0.06em;
  }

  .public-lead-capture__input {
    min-height: 40px;
    border-radius: 12px;
    padding-inline: 12px;
    font-size: 14px;
  }

  .public-lead-capture__actions {
    gap: 8px;
    margin-top: 12px;
  }

  .public-lead-capture__submit,
  .public-lead-capture__skip {
    min-height: 40px;
    font-size: 13px;
  }
}

@keyframes publicLeadCapturePulse {
  0%, 100% {
    box-shadow: 0 14px 30px rgba(37, 211, 102, 0.24);
    transform: translateZ(0) scale(1);
  }
  50% {
    box-shadow: 0 16px 36px rgba(37, 211, 102, 0.38);
    transform: translateZ(0) scale(1.015);
  }
}

.public-landing,
.public-landing * {
  box-sizing: border-box;
}

.public-landing {
  color: #fff;
  background: #000;
}

.public-landing button,
.public-landing a,
.public-landing input,
.public-landing textarea,
.public-landing select {
  font: inherit;
}

.public-landing.landing-shell {
  min-height: 100vh;
}

.public-landing .container.background-image {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #000;
}

.public-landing .background-layer {
  position: absolute;
  inset: 0;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  background-color: #000;
}

.public-landing .background-layer__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.public-landing .overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
}

.public-landing .content {
  position: relative;
  z-index: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(100%, 720px);
  padding: 32px 20px max(76px, calc(32px + env(safe-area-inset-bottom)));
}

.public-landing .content .title,
.public-landing .content .subtitle,
.public-landing .content .description {
  width: 100%;
  max-width: min(85vw, 620px);
}

.public-landing .logo {
  width: 200px;
  height: 150px;
  object-fit: contain;
  margin-bottom: 12px;
}

.public-landing .title {
  margin: 10px 0 15px;
  line-height: 1.2;
}

.public-landing .subtitle {
  margin-top: 40px;
  line-height: 1.45;
}

.public-landing .description {
  margin: 35px 0 50px;
  letter-spacing: 0.05em;
}

.public-landing .whatsapp-button {
  position: relative;
  overflow: hidden;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 180px;
  border: none;
  border-radius: 8px;
  padding: 12px 16px;
  margin-top: 25px;
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.public-landing .container.background-image.template1-bottom-layout {
  --cta-thumb-frame-height: 74svh;
  align-items: flex-start;
}

.public-landing .template1-bottom-layout .content {
  min-height: var(--cta-thumb-frame-height);
  justify-content: center;
  padding-bottom: 16px;
}

.public-landing .template1-bottom-cta-slot {
  position: absolute;
  z-index: 2;
  top: var(--cta-thumb-frame-height);
  left: 50%;
  width: min(100vw, 430px);
  padding: 0 16px;
  display: flex;
  justify-content: center;
  transform: translateX(-50%);
}

.public-landing .template1-bottom-cta-slot .whatsapp-button {
  margin-top: 10px;
}

.public-landing .whatsapp-button::before {
  content: "";
  position: absolute;
  inset: 0;
  width: 44%;
  background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.34), transparent);
  transform: translateX(-150%) skewX(-25deg);
  animation: publicLandingShineX 5.8s infinite;
  pointer-events: none;
}

.public-landing .whatsapp-button:hover {
  transform: scale(1.02);
}

.public-landing .whatsapp-button:active {
  transform: scale(0.97);
  opacity: 0.92;
}

.public-landing .whatsapp-button:disabled {
  cursor: not-allowed;
  opacity: 0.75;
  animation: none;
}

.public-landing .whatsapp-button:disabled::before {
  animation: none;
  opacity: 0;
}

.public-landing .whatsapp-icon {
  width: 29px;
  height: 29px;
  display: block;
}

@keyframes publicLandingShineX {
  from {
    transform: translateX(-150%) skewX(-25deg);
  }
  to {
    transform: translateX(300%) skewX(-25deg);
  }
}

@keyframes publicLandingHeartbeat {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.03);
  }
}

.public-landing.lp {
  height: 100vh;
  height: 100svh;
  overflow: hidden;
  overscroll-behavior-y: none;
  touch-action: pan-x;
  background: #000;
}

.public-landing.lp .phone-view {
  height: 100vh;
  height: 100svh;
  display: flex;
  justify-content: center;
  overflow: hidden;
  overscroll-behavior-y: none;
  background: #000;
}

.public-landing.lp .artboard {
  --cta-thumb-frame-height: 74svh;
  width: min(100vw, 430px);
  height: 100vh;
  height: 100svh;
  padding: 0 16px calc(46px + env(safe-area-inset-bottom));
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  overscroll-behavior-y: none;
}

.public-landing.lp .frame {
  position: relative;
  width: 100%;
  height: var(--cta-thumb-frame-height);
  min-height: 0;
  max-height: none;
  margin-top: 0;
  background: #000;
  border-radius: 0 0 34px 34px;
  overflow: hidden;
}

.public-landing.lp .frame__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  border-radius: 28px;
}

.public-landing.lp .frame::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.04) 0%,
    rgba(0, 0, 0, 0.08) 36%,
    rgba(0, 0, 0, 0.24) 56%,
    rgba(0, 0, 0, 0.72) 84%,
    rgba(0, 0, 0, 0.96) 100%
  );
  pointer-events: none;
  border-radius: 28px;
}

.public-landing.lp .frame__logo {
  position: absolute;
  z-index: 2;
  top: 8.5%;
  left: 50%;
  transform: translateX(-50%);
  width: 54%;
  max-width: 220px;
  min-width: 170px;
  filter:
    drop-shadow(0 8px 20px rgba(0, 0, 0, 0.55))
    drop-shadow(0 0 12px rgba(255, 208, 79, 0.15));
}

.public-landing.lp .frame__copy {
  position: absolute;
  z-index: 2;
  left: 0;
  right: 0;
  width: 85%;
  max-width: 365px;
  bottom: 26px;
  padding: 0;
  margin: 0 auto;
  text-align: center;
}

.public-landing.lp .eyebrow {
  color: #dfb117;
  font-size: 21px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
}

.public-landing.lp .frame__copy .title {
  margin-top: 10px;
  color: #fff;
  font-size: 23px;
  line-height: 1.05;
  font-weight: 900;
  text-shadow: 0 3px 10px rgba(0, 0, 0, 0.95);
}

.public-landing.lp .cta {
  position: relative;
  width: 80%;
  min-height: 45px;
  margin-top: 10px;
  border-radius: 16px;
  background: #08c95f;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px 14px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 10px 24px rgba(0, 0, 0, 0.26);
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  overflow: visible;
  isolation: isolate;
  will-change: transform;
}

.public-landing.lp .cta::after {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: inherit;
  border: 1px solid rgba(255, 255, 255, 0.34);
  opacity: 0;
  transform: scale(1);
  pointer-events: none;
  z-index: 0;
  animation: publicLandingCtaPulseRing 2.8s ease-out infinite;
  will-change: transform, opacity;
}

.public-landing.lp .cta > * {
  position: relative;
  z-index: 1;
}

.public-landing.lp .cta:hover {
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 14px 28px rgba(0, 0, 0, 0.28);
}

.public-landing.lp .cta:active {
  transform: scale(0.97);
  box-shadow:
    inset 0 2px 8px rgba(0, 0, 0, 0.2),
    0 4px 12px rgba(0, 0, 0, 0.2);
}

.public-landing.lp .cta:disabled {
  cursor: not-allowed;
  opacity: 0.75;
}

.public-landing.lp .cta:disabled::after {
  animation: none;
  opacity: 0;
}

@keyframes publicLandingCtaPulseRing {
  0% {
    opacity: 0.34;
    transform: scale(1);
  }
  70% {
    opacity: 0;
    transform: scale(1.07);
  }
  100% {
    opacity: 0;
    transform: scale(1.07);
  }
}

@keyframes publicLandingCtaHeartbeat {
  0%,
  64%,
  100% {
    transform: scale(1);
  }
  72% {
    transform: scale(1.02);
  }
  80% {
    transform: scale(1);
  }
  88% {
    transform: scale(1.013);
  }
}

.public-landing.lp .cta__fill {
  flex: 1 1 auto;
  min-width: 0;
  color: #fff;
  font-size: inherit;
  font-weight: inherit;
  line-height: 1.1;
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.public-landing.lp .cta__icon {
  width: 29px;
  height: 29px;
  object-fit: contain;
  flex: 0 0 auto;
}

.public-landing.lp .social-proof {
  width: 80%;
  margin-top: 16px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.28);
}

.public-landing.lp .social-proof__quote {
  color: #fff;
  font-size: 12px;
  line-height: 1.22;
  font-weight: 600;
  text-align: left;
  animation: publicLandingSocialProofFadeIn 420ms ease;
  will-change: transform, opacity;
}

.public-landing.lp .social-proof__meta {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.92);
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
  text-align: left;
}

.public-landing.lp .social-proof__stars {
  color: #ffd24b;
  letter-spacing: 1px;
}

.public-landing.lp .social-proof__progress {
  width: 100%;
  height: 3px;
  margin-top: 8px;
  border-radius: 999px;
  background: #25d366;
  transform: scaleX(0);
  transform-origin: left center;
  animation: publicLandingSocialProofProgress 5s linear forwards;
  will-change: transform;
}

@keyframes publicLandingSocialProofFadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes publicLandingSocialProofProgress {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

.public-landing.template4,
.public-landing.template5 {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 0;
  color: #f8fafc;
  background:
    radial-gradient(circle at 50% -10%, rgba(37, 211, 102, 0.18), transparent 34%),
    linear-gradient(180deg, #070a0d 0%, #050608 100%);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.template4__phone,
.template5__phone {
  position: relative;
  width: min(100vw, 430px);
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: #071013;
  box-shadow: 0 26px 80px rgba(0, 0, 0, 0.58);
}

.template4__phone::before,
.template5__phone::before {
  content: "";
  position: absolute;
  inset: 0;
  opacity: 0.17;
  background-image:
    radial-gradient(circle at 20px 20px, transparent 0 6px, rgba(148, 163, 184, 0.45) 7px, transparent 8px),
    radial-gradient(circle at 76px 58px, transparent 0 8px, rgba(148, 163, 184, 0.3) 9px, transparent 10px),
    linear-gradient(45deg, transparent 0 44%, rgba(148, 163, 184, 0.26) 45% 55%, transparent 56%),
    linear-gradient(135deg, transparent 0 44%, rgba(148, 163, 184, 0.22) 45% 55%, transparent 56%);
  background-size: 96px 96px, 120px 120px, 86px 86px, 132px 132px;
  background-position: 0 0, 18px 24px, 8px 18px, -16px 10px;
  pointer-events: none;
}

.template4__intro,
.template5__curtain {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  background: #071013;
  animation: publicLandingCurtain 2.2s ease forwards;
  pointer-events: none;
}

.template4__intro span,
.template5__curtain span {
  color: #7cf86e;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.template4__intro strong,
.template5__curtain strong {
  color: #fff;
  font-size: 28px;
  line-height: 1;
}

.template4__header,
.template5__topbar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 76px;
  padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
  background: rgba(8, 16, 20, 0.92);
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

.template4__avatar,
.template5__avatar {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  color: #c2f970;
  background: linear-gradient(145deg, #102126, #1e3338);
  border: 1px solid rgba(124, 248, 110, 0.2);
  font-size: 13px;
  font-weight: 900;
}

.template4__name {
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.1;
}

.template4__status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  color: rgba(226, 232, 240, 0.72);
  font-size: 12px;
  font-weight: 600;
}

.template4__status span,
.template5__live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #7cf86e;
  box-shadow: 0 0 0 4px rgba(124, 248, 110, 0.12);
}

.template4__time {
  margin-left: auto;
  color: rgba(226, 232, 240, 0.56);
  font-size: 11px;
  font-weight: 700;
}

.template4__thread {
  position: relative;
  z-index: 1;
  height: calc(100% - 222px);
  padding: 18px 14px 12px;
  overflow: hidden;
}

.template4__date {
  width: max-content;
  margin: 0 auto 16px;
  border-radius: 999px;
  padding: 6px 12px;
  color: rgba(226, 232, 240, 0.76);
  background: rgba(15, 23, 42, 0.62);
  font-size: 11px;
  font-weight: 800;
}

.template4__bubble {
  position: relative;
  width: fit-content;
  max-width: 83%;
  margin-bottom: 10px;
  border-radius: 16px;
  padding: 11px 12px 20px;
  color: #fff;
  font-size: 14px;
  line-height: 1.35;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
}

.template4__bubble span {
  position: absolute;
  right: 11px;
  bottom: 5px;
  color: rgba(226, 232, 240, 0.56);
  font-size: 10px;
  font-weight: 700;
}

.template4__bubble--in {
  background: #202c31;
  border-top-left-radius: 5px;
}

.template4__bubble--out {
  margin-left: auto;
  background: #075e54;
  border-top-right-radius: 5px;
}

.template4__bubble ul {
  margin: 9px 0 0;
  padding-left: 18px;
}

.template4__bubble li + li {
  margin-top: 3px;
}

.template4__footer,
.template5__footer {
  position: absolute;
  z-index: 2;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 14px 16px max(16px, env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(7, 16, 19, 0), rgba(7, 16, 19, 0.96) 24%, #071013 100%);
}

.template4__footer p {
  margin-bottom: 9px;
  color: rgba(226, 232, 240, 0.7);
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

.template4__cta,
.template5__cta {
  appearance: none;
  width: 100%;
  min-height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0;
  border-radius: 999px;
  color: #04130a;
  background: #7cf86e;
  font-size: 15px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 16px 34px rgba(124, 248, 110, 0.22);
}

.template4__cta b {
  font-size: 24px;
  line-height: 0.8;
}

.template4__cta:disabled,
.template5__cta:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.template4__footer small,
.template5__footer small {
  display: block;
  margin-top: 9px;
  color: rgba(226, 232, 240, 0.55);
  font-size: 11px;
  line-height: 1.3;
  text-align: center;
}

.template5__topbar {
  justify-content: center;
  gap: 8px;
  min-height: 56px;
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.template5__topbar time {
  margin-left: 4px;
  color: rgba(226, 232, 240, 0.56);
  letter-spacing: 0;
  text-transform: none;
}

.template5__hero {
  position: relative;
  z-index: 1;
  padding: 52px 24px 20px;
}

.template5__kicker {
  color: #7cf86e;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.template5__hero h1 {
  margin-top: 10px;
  color: #fff;
  font-size: clamp(38px, 13vw, 58px);
  line-height: 0.92;
  font-weight: 950;
}

.template5__hero p {
  max-width: 330px;
  margin-top: 15px;
  color: rgba(226, 232, 240, 0.76);
  font-size: 15px;
  line-height: 1.42;
}

.template5__advisor,
.template5__feed {
  position: relative;
  z-index: 1;
  margin: 0 18px;
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.62);
  backdrop-filter: blur(8px);
}

.template5__advisor {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px;
}

.template5__advisor strong,
.template5__advisor span {
  display: block;
}

.template5__advisor strong {
  color: #fff;
  font-size: 15px;
}

.template5__advisor span {
  margin-top: 3px;
  color: rgba(226, 232, 240, 0.66);
  font-size: 12px;
  font-weight: 650;
}

.template5__progress {
  position: relative;
  z-index: 1;
  height: 8px;
  margin: 18px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
}

.template5__progress span {
  display: block;
  width: 68%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #7cf86e, #25d366);
  box-shadow: 0 0 22px rgba(124, 248, 110, 0.26);
}

.template5__feed {
  padding: 14px;
}

.template5__feed div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.template5__feed strong {
  color: #fff;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.template5__feed div span {
  color: #7cf86e;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.template5__feed p {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  color: rgba(226, 232, 240, 0.72);
  font-size: 12px;
  line-height: 1.25;
}

.template5__feed p b {
  color: rgba(226, 232, 240, 0.92);
}

.template5__cta-icon {
  width: 24px;
  height: 24px;
}

.public-landing.template4 {
  background: #0f191b;
  font-family: Manrope, Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.public-landing.template4 .template4__phone {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 50px);
  max-height: 760px;
  margin-bottom: 42px;
  background:
    radial-gradient(circle at 18% 4%, rgba(229, 189, 66, 0.1), transparent 30%),
    linear-gradient(180deg, #152729 0%, #101b1d 100%);
}

.public-landing.template4 .template4__phone::before {
  display: block;
  opacity: 0.16;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'%3E%3Cg fill='none' stroke='%23a7f3d0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='.78'%3E%3Ccircle cx='34' cy='36' r='19'/%3E%3Ccircle cx='34' cy='36' r='10'/%3E%3Cpath d='M34 17v9M34 46v9M15 36h9M44 36h9'/%3E%3Cpath d='M91 22l18 18-18 18-18-18zM91 28v24M79 40h24'/%3E%3Cpath d='M161 24c9-11 27-2 20 10 14-3 20 14 7 21 6 12-12 20-22 8-10 12-28 4-21-9-14 3-20-15-7-22-6-11 12-21 23-8z'/%3E%3Cpath d='M29 94h42a7 7 0 017 7v28a7 7 0 01-7 7H29a7 7 0 01-7-7v-28a7 7 0 017-7zM33 107l7 7 7-7M64 123l-7-7-7 7'/%3E%3Cpath d='M126 91c10 7 11 22 0 29-11-7-10-22 0-29zM113 106h26M126 121v9'/%3E%3Cpath d='M179 92h18a9 9 0 019 9v18a9 9 0 01-9 9h-18a9 9 0 01-9-9v-18a9 9 0 019-9zM181 103h.5M194 103h.5M181 117h.5M194 117h.5M187 110h.5'/%3E%3Cpath d='M49 165l16 16-16 16-16-16zM126 161c15 0 21 17 9 28-14-7-23-17-9-28zM114 188h30M182 163c10 0 18 8 18 18s-8 18-18 18-18-8-18-18 8-18 18-18zM174 181h16'/%3E%3C/g%3E%3Cg fill='%23e5bd42' opacity='.48'%3E%3Ccircle cx='14' cy='71' r='2'/%3E%3Ccircle cx='115' cy='16' r='2'/%3E%3Ccircle cx='205' cy='54' r='2'/%3E%3Ccircle cx='96' cy='145' r='2'/%3E%3Ccircle cx='18' cy='205' r='2'/%3E%3Cpath d='M205 151l3 6 6 3-6 3-3 6-3-6-6-3 6-3z'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 220px 220px;
  background-position: -24px 12px;
}

.public-landing.template4 .template4__intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  background: #11191b;
  animation: publicLandingTemplate4Intro 2.15s ease forwards;
}

.public-landing.template4 .template4__spinner {
  position: relative;
  width: 100px;
  height: 100px;
  display: grid;
  place-items: center;
}

.public-landing.template4 .template4__spinner::before {
  content: "";
  position: absolute;
  inset: 0;
  border: 2px solid rgba(37, 211, 102, 0.18);
  border-top-color: #25d366;
  border-radius: 999px;
  animation: publicLandingTemplate4Ring 1.1s linear infinite;
}

.public-landing.template4 .template4__photo {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 999px;
  color: rgba(203, 213, 225, 0.74);
  background: repeating-linear-gradient(135deg, #425357 0 6px, #344448 6px 12px);
  font: 700 8px/1.25 "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  text-align: center;
  text-transform: lowercase;
  object-fit: cover;
}

.public-landing.template4 .template4__photo--large {
  width: 74px;
  height: 74px;
  font-size: 9px;
}

.public-landing.template4 .template4__intro-copy {
  display: flex;
  flex-direction: column;
  gap: 7px;
  max-width: 330px;
  padding: 0 28px;
  text-align: center;
}

.public-landing.template4 .template4__intro-copy span {
  color: #25d366;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.public-landing.template4 .template4__intro-copy strong {
  color: #f8fafc;
  font-size: 24px;
  line-height: 1.08;
  font-weight: 900;
  letter-spacing: -0.02em;
}

.public-landing.template4 .template4__intro-copy p {
  color: rgba(203, 213, 225, 0.76);
  font-size: 13.5px;
  line-height: 1.35;
}

.public-landing.template4 .template4__header {
  flex: 0 0 auto;
  min-height: 68px;
  padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
  background: rgba(35, 59, 61, 0.96);
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.public-landing.template4 .template4__avatar-wrap {
  position: relative;
  flex: 0 0 auto;
}

.public-landing.template4 .template4__online-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 12px;
  height: 12px;
  border: 2px solid #263639;
  border-radius: 999px;
  background: #25d366;
  animation: publicLandingTemplate4Blink 1.45s ease-in-out infinite;
}

.public-landing.template4 .template4__who {
  min-width: 0;
  flex: 1 1 auto;
}

.public-landing.template4 .template4__who b {
  display: block;
  overflow: hidden;
  color: #f8fafc;
  font-size: 16px;
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.public-landing.template4 .template4__who span {
  display: block;
  margin-top: 3px;
  color: #25d366;
  font-size: 12.5px;
  line-height: 1.2;
  font-weight: 700;
}

.public-landing.template4 .template4__time {
  color: rgba(203, 213, 225, 0.68);
  font: 700 11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
  text-align: right;
}

.public-landing.template4 .template4__time i {
  color: #e5bd42;
  font-style: normal;
}

.public-landing.template4 .template4__thread {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  height: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 10px 16px 8px;
}

.public-landing.template4 .template4__stack {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
}

.public-landing.template4 .template4__live-pill {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 13px;
  border: 1px solid rgba(37, 211, 102, 0.3);
  border-radius: 999px;
  color: #eef7f1;
  background: rgba(37, 211, 102, 0.11);
  font-size: 12.5px;
  line-height: 1.1;
  font-weight: 700;
}

.public-landing.template4 .template4__live-pill i,
.public-landing.template4 .template4__cta-sub i {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #25d366;
  animation: publicLandingTemplate4Blink 1.45s ease-in-out infinite;
}

.public-landing.template4 .template4__live-pill b {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.public-landing.template4 .template4__bubble {
  max-width: 82%;
  margin: 0;
  border-radius: 14px 14px 14px 4px;
  padding: 8px 12px 18px;
  background: #344448;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.36);
  animation: publicLandingTemplate4Rise 0.38s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.public-landing.template4 .template4__bubble--delay-1 {
  animation-delay: 2.2s;
}

.public-landing.template4 .template4__bubble--delay-2 {
  animation-delay: 3.15s;
}

.public-landing.template4 .template4__bubble--delay-3 {
  animation-delay: 4.1s;
}

.public-landing.template4 .template4__bubble p {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.4;
}

.public-landing.template4 .template4__bubble ul {
  list-style: none;
  margin: 9px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.public-landing.template4 .template4__bubble li {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  color: rgba(248, 250, 252, 0.9);
  font-size: 13.5px;
  line-height: 1.3;
}

.public-landing.template4 .template4__bubble li::before {
  content: "";
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  margin-top: 5px;
  border-radius: 2px;
  background: #e5bd42;
  transform: rotate(45deg);
}

.public-landing.template4 .template4__bubble span {
  position: absolute;
  right: 11px;
  bottom: 4px;
  color: rgba(203, 213, 225, 0.68);
  font: 700 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
}

.public-landing.template4 .template4__footer {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  padding: 10px 14px 18px;
  background: #203033;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
}

.public-landing.template4 .template4__cta {
  justify-content: center;
  gap: 10px;
  min-height: 58px;
  padding: 8px 18px;
  color: #092213;
  background: #25d366;
  border: 1px solid rgba(8, 112, 55, 0.64);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 0 0 0 rgba(37, 211, 102, 0.5),
    0 10px 22px rgba(0, 0, 0, 0.18);
  animation: publicLandingTemplate4Pulse 2.4s ease-out infinite;
}

.public-landing.template4 .template4__cta span {
  color: #092213;
  font-size: 17px;
  line-height: 1.15;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.public-landing.template4 .template4__cta-icon {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  color: #092213;
}

.public-landing.template4 .template4__cta-sub {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 8px;
  color: rgba(203, 213, 225, 0.76);
  font-size: 12.5px;
  line-height: 1.2;
}

.public-landing.template4 .template4__footer small {
  margin-top: 8px;
  color: rgba(203, 213, 225, 0.48);
  font: 600 9.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
}

@keyframes publicLandingTemplate4Intro {
  0%,
  74% {
    opacity: 1;
    visibility: visible;
  }
  100% {
    opacity: 0;
    visibility: hidden;
  }
}

@keyframes publicLandingTemplate4Ring {
  to {
    transform: rotate(360deg);
  }
}

@keyframes publicLandingTemplate4Blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}

@keyframes publicLandingTemplate4Rise {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes publicLandingTemplate4Pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.5);
  }
  70% {
    box-shadow: 0 0 0 15px rgba(37, 211, 102, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(37, 211, 102, 0);
  }
}

@keyframes publicLandingCurtain {
  0%,
  72% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-12px);
    visibility: hidden;
  }
}

@keyframes publicLandingTyping {
  0%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

.public-landing.lp .features {
  width: 85%;
  max-width: 365px;
  margin-top: 8px;
  text-align: center;
  color: #f4f4f4;
  font-size: 12px;
  line-height: 1.05;
  font-weight: 500;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}

.public-landing.lp .features p + p {
  margin-top: 1px;
}

.public-landing.template3 {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 12px;
  color: #10213a;
  text-align: center;
  background: #f2f4f5;
}

.public-landing.template3 .template3__card {
  width: min(100%, 384px);
  min-height: 396px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 31px 32px 26px;
  border-radius: 17px;
  background: #fff;
  box-shadow: 0 8px 18px rgba(16, 33, 58, 0.13);
}

.public-landing.template3 .template3__whatsapp {
  width: 82px;
  height: 82px;
  flex: none;
  color: #00cf70;
  filter: drop-shadow(0 3px 2px rgba(0, 207, 112, 0.18));
}

.public-landing.template3 .template3__title {
  margin: 20px 0 6px;
  color: #10213a;
  font-size: 24px;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.025em;
}

.public-landing.template3 .template3__copy {
  margin: 0;
  color: #586577;
  font-size: 14px;
  line-height: 1.5;
  font-weight: 400;
}

.public-landing.template3 .template3__spinner {
  width: 48px;
  height: 48px;
  margin-top: 23px;
  border: 4px solid #eef0f0;
  border-top-color: #00cf70;
  border-right-color: #00cf70;
  border-radius: 50%;
  animation: publicLandingTemplate3Spin 850ms linear infinite;
}

.public-landing.template3 .template3__fallback {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 31px;
  padding-top: 16px;
  border-top: 1px solid #dde1e4;
  color: #8a94a3;
  font-size: 12px;
  line-height: 1.35;
}

.public-landing.template3 .template3__retry {
  appearance: none;
  margin: 0;
  padding: 0;
  border: 0;
  color: #00ba66;
  background: transparent;
  font: inherit;
  font-weight: 700;
  line-height: inherit;
  cursor: pointer;
}

.public-landing.template3 .template3__retry:hover {
  color: #009f57;
  text-decoration: underline;
}

.public-landing.template3 .template3__retry:focus-visible {
  outline: 2px solid #00ba66;
  outline-offset: 3px;
  border-radius: 2px;
}

.public-landing.template3 .template3__retry:disabled {
  cursor: wait;
  opacity: 0.65;
}

@keyframes publicLandingTemplate3Spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .public-landing .whatsapp-button,
  .public-landing .whatsapp-button::before,
  .public-landing.lp .cta,
  .public-landing.lp .cta::after,
  .public-landing.lp .social-proof__quote,
  .public-landing.lp .social-proof__progress,
  .template4__intro,
  .template5__curtain,
  .public-landing.template3 .template3__spinner {
    animation: none !important;
  }

  .public-landing .whatsapp-button,
  .public-landing.lp .cta {
    transition: none;
  }

  .public-landing.lp .cta:hover {
    transform: none;
  }
}

@media (max-width: 640px) {
  .public-landing .logo {
    width: 170px;
    height: 130px;
  }

  .public-landing .subtitle {
    margin-top: 30px;
  }

  .public-landing .description {
    margin-bottom: 32px;
  }
}

@media (max-width: 390px) {
  .public-landing .container.background-image.template1-bottom-layout,
  .public-landing.lp .artboard {
    --cta-thumb-frame-height: 72svh;
  }

  .public-landing .template1-bottom-cta-slot {
    padding: 0 12px;
  }

  .public-landing.lp .artboard {
    padding: 0 12px calc(42px + env(safe-area-inset-bottom));
  }

  .public-landing.lp .frame {
    min-height: 0;
  }

  .public-landing.lp .frame__bg,
  .public-landing.lp .frame::after {
    border-radius: 23px;
  }

  .public-landing.lp .frame__logo {
    width: 56%;
    top: 8%;
  }

  .public-landing.lp .frame__copy {
    bottom: 22px;
  }

  .public-landing.lp .eyebrow {
    font-size: 18px;
  }

  .public-landing.lp .frame__copy .title {
    font-size: 20px;
  }

  .public-landing.lp .cta {
    width: 80%;
    min-height: 38px;
    border-radius: 14px;
    padding: 6px 11px;
    gap: 8px;
  }

  .public-landing.lp .cta__icon {
    width: 24px;
    height: 24px;
  }

  .public-landing.lp .social-proof {
    width: 80%;
    margin-top: 14px;
    padding: 7px 9px;
    border-radius: 11px;
  }

  .public-landing.lp .social-proof__quote {
    font-size: 12px;
  }

  .public-landing.lp .social-proof__meta {
    font-size: 11px;
  }

  .public-landing.lp .features {
    font-size: 11px;
  }
}

@media (max-height: 720px) {
  .public-landing.lp .artboard {
    --cta-thumb-frame-height: 69svh;
  }

  .public-landing.lp .social-proof {
    margin-top: 10px;
    padding: 6px 9px;
  }

  .public-landing.lp .social-proof__quote {
    font-size: 11px;
    line-height: 1.16;
  }

  .public-landing.lp .social-proof__progress {
    margin-top: 6px;
  }

  .public-landing.lp .features {
    margin-top: 6px;
    line-height: 1.02;
  }
}

@media (max-width: 420px) {
  .public-landing.template3 .template3__card {
    min-height: 0;
    padding-inline: 24px;
  }
}

@media (min-width: 431px) {
  .public-landing .container.background-image.template1-bottom-layout,
  .public-landing.lp .artboard {
    --cta-thumb-frame-height: 74vh;
  }

  .public-landing.lp .artboard {
    width: 430px;
  }

  .public-landing .template1-bottom-cta-slot {
    width: 430px;
  }
}

@media (min-width: 768px) {
  .public-landing .container.background-image.template1-bottom-layout,
  .public-landing.lp .artboard {
    --cta-thumb-frame-height: min(74vh, 840px);
  }

  .public-landing.lp .artboard {
    padding-bottom: calc(56px + env(safe-area-inset-bottom));
  }

  .public-landing.lp .frame {
    max-height: 840px;
  }

  .public-landing.lp .frame__copy .title {
    font-size: 25px;
  }
}
`;
