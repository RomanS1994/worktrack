function shouldOpenInNewTab() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = String(navigator.userAgent || '').toLowerCase();
  const platform = String(navigator.platform || '').toLowerCase();
  const vendor = String(navigator.vendor || '').toLowerCase();
  const hasTouchPoints = Number(navigator.maxTouchPoints || 0) > 1;

  const isIosDevice =
    /iphone|ipad|ipod/.test(userAgent) ||
    (platform === 'macintel' && hasTouchPoints);
  const isMobileSafari = isIosDevice && vendor.includes('apple');

  return isMobileSafari;
}

export function downloadFile(blob, fileName = 'contract.pdf') {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('Downloads are not available in this environment');
  }

  const blobUrl = URL.createObjectURL(blob);
  const openInNewTab = shouldOpenInNewTab();

  if (openInNewTab) {
    const openedWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');

    if (openedWindow) {
      window.setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 30000);
      return;
    }
  }

  const link = document.createElement('a');

  link.href = blobUrl;
  link.download = fileName;
  link.target = openInNewTab ? '_blank' : '_self';
  link.rel = openInNewTab ? 'noopener noreferrer' : 'noopener';
  link.style.display = 'none';

  document.body.appendChild(link);

  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 30000);
  }
}
