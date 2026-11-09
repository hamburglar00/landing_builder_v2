import { LandingBuilderLogo } from "./LandingBuilderLogo";
import styles from "./LandingBuilderLoading.module.css";

export function LandingBuilderLoading({ label = "Cargando...", fullScreen = false }: {
  label?: string;
  fullScreen?: boolean;
}) {
  return <div className={`${styles.loading} ${fullScreen ? styles.screen : ""}`} role="status" aria-label="Cargando LandingBuilder" aria-live="polite" aria-busy="true">
    <div className={styles.motion} aria-hidden="true">
      <LandingBuilderLogo variant="vertical" className="h-auto w-full max-w-full" />
    </div>
    <div className={styles.dots} aria-hidden="true"><span /><span /><span /></div>
    <p className={styles.caption}>{label}</p>
  </div>;
}
