import type { CSSProperties, Ref } from "react";
import { LandingBuilderLogo } from "./LandingBuilderLogo";
import styles from "./LandingBuilderLaunch.module.css";

const flightPath = "M160 294C144 278 214 266 210 244S105 220 108 198S208 170 201 150S125 124 128 106S183 82 180 66S143 43 149 28S164 8 160-10";

function Rocket() {
  return <g className={styles.rocketDepth}>
    <path className={styles.jet} d="M-18-7C-36-14-57-8-78 0C-57 8-36 14-18 7Z" fill="url(#launch-jet)" />
    <path className={styles.jetCore} d="M-18-4C-30-8-40-5-54 0C-40 5-30 8-18 4Z" fill="url(#launch-core)" />
    {[0, 1, 2, 3, 4].map(i => <circle key={i} className={styles.vapor} cx="-42" cy="0" r="8" style={{ "--i": i, "--drift": `${i % 2 ? 6 : -6}px` } as CSSProperties} />)}
    <image href="/brand/landingbuilder/landingbuilder-isotipo-dark.svg" x="-32" y="-32" width="64" height="64" transform="rotate(50)" />
  </g>;
}

/** Decorative login transition; completion follows the destination, never the animation. */
export function LandingBuilderLaunch({ leaving = false, overlayRef }: {
  leaving?: boolean;
  overlayRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={overlayRef} className={`${styles.overlay} ${leaving ? styles.leaving : ""}`} role="status" aria-live="polite" aria-label="Iniciando sesión en LandingBuilder" aria-busy="true" tabIndex={-1}>
      <div className={styles.composition} aria-hidden="true">
        <div className={styles.scene}>
          <div className={styles.halo} />
          <div className={styles.stars} />
          <svg className={styles.orbit} viewBox="0 0 320 352" fill="none">
            <defs>
              <linearGradient id="launch-jet" x1="-18" y1="0" x2="-78" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#f3ffd5" /><stop offset=".25" stopColor="#c3ff83" /><stop offset=".6" stopColor="#8ee04e" stopOpacity=".7" /><stop offset="1" stopColor="#8ee04e" stopOpacity="0" /></linearGradient>
              <linearGradient id="launch-core" x1="-18" y1="0" x2="-54" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="white" /><stop offset=".45" stopColor="#f6ffcb" /><stop offset="1" stopColor="#d1ff87" stopOpacity="0" /></linearGradient>
            </defs>
            <path className={styles.orbitBack} d="M160 294C68 268 252 238 160 210S88 164 160 142S214 102 160 80S126 46 160 20" />
            <path className={styles.orbitFront} d={flightPath} />
            <g className={styles.movingRocket}><Rocket /><animateMotion dur="3.2s" repeatCount="indefinite" rotate="auto" path={flightPath} /></g>
            <g className={styles.stillRocket} transform="translate(160 160) rotate(-90)"><Rocket /></g>
          </svg>
          <div className={styles.pad} />
          <div className={styles.groundSmoke}>
            {[-1, 1].map(side => <span key={side} style={{ "--side": side } as CSSProperties} />)}
          </div>
          <div className={styles.sparkles}>
            {[0, 1, 2, 3, 4, 5].map(i => <span key={i} style={{ "--i": i } as CSSProperties} />)}
          </div>
        </div>
        <LandingBuilderLogo className={styles.wordmark} />
        <div className={styles.dots}><span /><span /><span /></div>
      </div>
      <span className={styles.caption}>Preparando tu inicio.</span>
    </div>
  );
}
