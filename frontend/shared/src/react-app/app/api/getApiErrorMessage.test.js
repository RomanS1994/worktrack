import assert from 'node:assert/strict';
import test from 'node:test';

import { getApiErrorMessageForLanguage } from './getApiErrorMessage.js';

test('preserves an untranslated concrete backend error for Ukrainian UI', () => {
  const error = {
    status: 400,
    data: { error: 'Manager timesheet entry is locked' },
  };

  assert.equal(
    getApiErrorMessageForLanguage(error, 'uk'),
    'Manager timesheet entry is locked',
  );
});

test('uses localized copy when a translation exists', () => {
  const error = {
    status: 403,
    data: { error: 'Manager access is required' },
  };

  assert.equal(
    getApiErrorMessageForLanguage(error, 'uk'),
    'Для цієї дії потрібен доступ менеджера.',
  );
});

test('uses connection message only when there is no concrete backend detail', () => {
  assert.equal(
    getApiErrorMessageForLanguage({ status: 'FETCH_ERROR' }, 'uk'),
    'Не вдалося з’єднатися із сервером.',
  );
});
