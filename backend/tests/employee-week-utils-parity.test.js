import assert from 'node:assert/strict';
import test from 'node:test';

import { getEmployeeWeekRange } from '../services/employee-work.js';
import { getWeekRange, serializeWeek } from '../services/week-utils.js';

function serializeEmployeeWeek(range) {
  return {
    weekStart: range.weekStart.toISOString().slice(0, 10),
    weekEnd: range.weekEnd.toISOString().slice(0, 10),
    days: range.days.map(day => ({ date: day.dateKey, label: day.label })),
  };
}

for (const value of ['2026-09-02', '2026-09-06', '2026-08-31']) {
  test(`employee week range matches shared week utils for ${value}`, () => {
    const employeeRange = getEmployeeWeekRange(value);
    const sharedRange = getWeekRange(value);

    assert.deepEqual(serializeEmployeeWeek(employeeRange), serializeWeek(sharedRange));
    assert.equal(employeeRange.nextWeekStart.toISOString(), sharedRange.nextWeekStart.toISOString());
  });
}
