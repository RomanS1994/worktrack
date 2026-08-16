import { nowIso } from '../../validation/common.js';

export function buildCycleWindow(startIso = nowIso()) {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) {
    return buildCycleWindow(nowIso());
  }

  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);

  return {
    currentPeriodStart: start.toISOString(),
    currentPeriodEnd: end.toISOString(),
  };
}

export function buildCurrentMonthWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0) - 1
  );

  return {
    currentPeriodStart: start.toISOString(),
    currentPeriodEnd: end.toISOString(),
  };
}
