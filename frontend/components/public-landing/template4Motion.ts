/** Shared by the public chat and its editor preview. */
export const TEMPLATE4_BUBBLE_MOTION_CSS = String.raw`
.template4__bubble {
  position: relative;
  align-self: flex-start;
  width: fit-content;
  max-width: 82%;
  flex-shrink: 0;
  overflow-wrap: anywhere;
  padding: calc(8px * var(--template4-fit, 0.6)) calc(13px * var(--template4-fit, 0.6)) calc(30px * var(--template4-fit, 0.6));
  font-size: calc(31px * var(--template4-fit, 0.6));
  transform-origin: left bottom;
  animation: template4BubbleReveal 360ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.template4__bubble p { margin: 0; font-size: inherit; line-height: 1.38; }
.template4__bubble ul {
  list-style: none;
  margin: calc(8px * var(--template4-fit, 0.6)) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: calc(6px * var(--template4-fit, 0.6));
}
.template4__bubble li { font-size: calc(28px * var(--template4-fit, 0.6)); line-height: 1.34; }
.template4__bubble [data-template4-message-time] {
  position: absolute;
  right: calc(11px * var(--template4-fit, 0.6));
  bottom: calc(4px * var(--template4-fit, 0.6));
  font-size: calc(20px * var(--template4-fit, 0.6));
  line-height: 1;
}
.template4__bubble--delay-1 { animation-delay: 1s; }
.template4__bubble--delay-2 { animation-delay: 2s; }
.template4__bubble--delay-3 { animation-delay: 3s; }
@keyframes template4BubbleReveal {
  from { opacity: 0; transform: scale(0); }
  to { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .template4__bubble { animation: none; }
}
`;

/** Fit untransformed layout boxes, so revealing a bubble never changes sizing. */
export function fitTemplate4Messages(thread: HTMLElement) {
  const stack = thread.querySelector<HTMLElement>("[data-template4-stack]");
  if (!stack || !thread.clientHeight) return;
  const style = getComputedStyle(thread);
  const availableHeight = thread.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const availableWidth = thread.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const fits = (scale: number) => {
    thread.style.setProperty("--template4-fit", String(scale));
    return stack.offsetHeight <= availableHeight && stack.scrollWidth <= availableWidth;
  };
  if (fits(1)) return;
  let lower = 0.01;
  let upper = 1;
  for (let attempt = 0; attempt < 10; attempt++) {
    const scale = (lower + upper) / 2;
    if (fits(scale)) lower = scale;
    else upper = scale;
  }
  thread.style.setProperty("--template4-fit", String(lower));
}
