const DEFAULT_MIN_DURATION_MS = 2300;
const DEFAULT_FADE_DURATION_MS = 520;

let isHidingStartupSplash = false;

export function hideStartupSplash({
  minDurationMs = DEFAULT_MIN_DURATION_MS,
  fadeDurationMs = DEFAULT_FADE_DURATION_MS,
} = {}) {
  if (isHidingStartupSplash) {
    return;
  }

  const splashElement = document.getElementById("app-splash");

  if (!splashElement) {
    return;
  }

  isHidingStartupSplash = true;

  const startedAt =
    typeof window.__APP_SPLASH_STARTED_AT === "number"
      ? window.__APP_SPLASH_STARTED_AT
      : performance.now();
  const elapsed = performance.now() - startedAt;
  const delay = Math.max(0, minDurationMs - elapsed);

  window.setTimeout(() => {
    window.requestAnimationFrame(() => {
      splashElement.classList.add("is-hiding");

      window.setTimeout(() => {
        splashElement.remove();
      }, fadeDurationMs);
    });
  }, delay);
}
