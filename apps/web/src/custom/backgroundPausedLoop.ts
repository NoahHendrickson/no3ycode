/**
 * The new-agent backdrops' frame loop — see `.fork/customizations.yaml#fork-basic-theme`. It holds
 * while the window is in the background and takes that time off its clock, so nothing jumps on return.
 */
export function runWhileFocused(gapMs: number, onFrame: (elapsedMs: number) => void): () => void {
  const start = performance.now();
  let last = 0;
  let frame = 0;
  let timer = 0;
  let pausedFor = 0;
  let pausedAt: number | null = null;

  const tick = (time: number) => {
    last = Math.max(last, time - start - pausedFor);
    onFrame(last);
    timer = window.setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, gapMs);
  };
  const pause = () => {
    if (pausedAt !== null) return;
    pausedAt = performance.now();
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
  };
  const resume = () => {
    if (pausedAt === null) return;
    pausedFor += performance.now() - pausedAt;
    pausedAt = null;
    frame = requestAnimationFrame(tick);
  };

  window.addEventListener("blur", pause);
  window.addEventListener("focus", resume);
  if (document.hasFocus()) frame = requestAnimationFrame(tick);
  else pausedAt = performance.now();
  return () => {
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    window.removeEventListener("blur", pause);
    window.removeEventListener("focus", resume);
  };
}
