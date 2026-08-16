const PROMO_BANNERS_VISIBLE_KEY = 'pdf-app-home-promo-banners-visible';

export const DEFAULT_PROMO_BANNERS_VISIBLE = true;

export function readStoredPromoBannersVisible() {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_PROMO_BANNERS_VISIBLE;

    const rawValue = localStorage.getItem(PROMO_BANNERS_VISIBLE_KEY);

    if (rawValue === 'false') return false;
    if (rawValue === 'true') return true;

    return DEFAULT_PROMO_BANNERS_VISIBLE;
  } catch {
    return DEFAULT_PROMO_BANNERS_VISIBLE;
  }
}

export function saveStoredPromoBannersVisible(isVisible) {
  try {
    if (typeof localStorage === 'undefined') return;

    localStorage.setItem(PROMO_BANNERS_VISIBLE_KEY, isVisible ? 'true' : 'false');
  } catch {
    // Ignore storage failures in private/incognito contexts.
  }
}
