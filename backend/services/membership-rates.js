export function rateDate(value) {
  const key = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '');
  const date = new Date(`${key}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) throw new Error('Invalid rate effective date');
  return key;
}

export function ratesForDate(membership, date) {
  const key = rateDate(date);
  const history = Array.isArray(membership.rateHistory) ? membership.rateHistory : [];
  const match = [...history].sort((a,b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).find(item => item.effectiveFrom <= key);
  return {
    hourlyRateCzk: String(match?.hourlyRateCzk ?? membership.hourlyRateCzk ?? '0.00'),
    customerRateCzk: String(match?.customerRateCzk ?? membership.customerRateCzk ?? membership.hourlyRateCzk ?? '0.00'),
  };
}

export function changedRateHistory(membership, effectiveFrom, rates) {
  const key = rateDate(effectiveFrom);
  const history = Array.isArray(membership.rateHistory) ? [...membership.rateHistory] : [];
  if (!history.length && key > '0001-01-01') history.push({ effectiveFrom:'0001-01-01', ...ratesForDate(membership, key), baseline:true });
  const next = history.filter(item => item.effectiveFrom !== key);
  next.push({ effectiveFrom:key, ...rates });
  return next.sort((a,b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

export async function loadRatesForDate(client, membership, date) {
  const fresh = await client.companyMembership.findFirst({ where: { id: membership.id, companyId: membership.companyId }, select: { hourlyRateCzk:true, customerRateCzk:true, rateHistory:true } });
  return ratesForDate(fresh || membership, date);
}
