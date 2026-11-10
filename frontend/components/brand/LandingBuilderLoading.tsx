import { LandingBuilderLogo } from "./LandingBuilderLogo";
import styles from "./LandingBuilderLoading.module.css";

export function LandingBuilderLoading({ label = "Cargando...", fullScreen = false, variant = "brand", size = "page", className = "" }: {
  label?: string;
  fullScreen?: boolean;
  variant?: "brand" | "rocket" | "dots";
  size?: "page" | "panel" | "inline";
  className?: string;
}) {
  const Root = size === "inline" ? "span" : "div";
  return <Root className={`${styles.loading} ${styles[size]} ${fullScreen ? styles.screen : ""} ${className}`} role="status" aria-label={label} aria-live="polite" aria-busy="true">
    {variant === "brand" && <div className={styles.motion} aria-hidden="true">
      <LandingBuilderLogo variant="vertical" className="h-auto w-full max-w-full" />
    </div>}
    {variant === "rocket" ? <div className={styles.flight} aria-hidden="true"><span className={styles.rocket}><span className={styles.rocketIcon}>
      <LandingBuilderLogo variant="mark" className="h-auto w-full max-w-full" />
    </span></span></div> : <span className={styles.dots} aria-hidden="true"><span /><span /><span /></span>}
    <span className={styles.caption}>{label}</span>
  </Root>;
}
