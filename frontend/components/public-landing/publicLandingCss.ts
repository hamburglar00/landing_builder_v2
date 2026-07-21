export const PUBLIC_LANDING_CSS = String.raw`
html, body {
  margin: 0;
  min-height: 100%;
  background: #000;
  color: #fff;
  font-family: Arial, Helvetica, sans-serif;
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
  padding: 32px 20px;
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
  animation: publicLandingHeartbeat 2s infinite ease-in-out;
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
  width: 50%;
  background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.55), transparent);
  transform: translateX(-150%) skewX(-25deg);
  animation: publicLandingShineX 3.5s infinite;
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
  padding: 0 16px calc(10px + env(safe-area-inset-bottom));
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
  animation: publicLandingCtaHeartbeat 1.6s ease-in-out infinite;
  will-change: transform;
}

.public-landing.lp .cta::after {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  border: 2px solid rgba(255, 255, 255, 0.44);
  opacity: 0;
  transform: scale(1);
  pointer-events: none;
  z-index: 0;
  animation: publicLandingCtaPulseRing 1.45s ease-out infinite;
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

@keyframes publicLandingCtaPulseRing {
  0% {
    opacity: 0.48;
    transform: scale(1);
  }
  70% {
    opacity: 0;
    transform: scale(1.13);
  }
  100% {
    opacity: 0;
    transform: scale(1.13);
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
    padding: 0 12px calc(8px + env(safe-area-inset-bottom));
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
    padding-bottom: 30px;
  }

  .public-landing.lp .frame {
    max-height: 840px;
  }

  .public-landing.lp .frame__copy .title {
    font-size: 25px;
  }
}
`;
