export function toCount(value) {
  const numberValue = Number.parseInt(String(value ?? '0'), 10);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
}

export function normalizeChildSeats(value) {
  const source = value && typeof value === 'object' ? value : {};

  return {
    enabled: Boolean(source.enabled),
    infant: toCount(source.infant),
    child: toCount(source.child),
    booster: toCount(source.booster),
  };
}

export function getChildSeatCount(value) {
  const source = normalizeChildSeats(value);

  if (!source.enabled) {
    return 0;
  }

  return source.infant + source.child + source.booster;
}
