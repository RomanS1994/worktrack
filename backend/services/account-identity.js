import { Prisma } from '@prisma/client';

import { normalizeUserProfile } from './profiles.js';
import { normalizeText } from '../validation/common.js';

const EMPTY_IDENTITY_SENTINEL = '__EMPTY_ACCOUNT_IDENTITY__';

export function normalizeBusinessIdentityValue(value) {
  return normalizeText(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function addIdentityValue(values, value) {
  const normalized = normalizeBusinessIdentityValue(value);

  if (normalized) {
    values.add(normalized);
  }
}

function addIdentityValues(values, source) {
  if (!Array.isArray(source)) {
    return;
  }

  for (const value of source) {
    addIdentityValue(values, value);
  }
}

function getIdentityLocks(profile) {
  const source = profile && typeof profile === 'object' ? profile : {};
  const locks = source.identityLocks && typeof source.identityLocks === 'object'
    ? source.identityLocks
    : {};

  return {
    icoValues: Array.isArray(locks.icoValues) ? locks.icoValues : [],
    dicValues: Array.isArray(locks.dicValues) ? locks.dicValues : [],
  };
}

export function collectBusinessIdentityValues(profile, name = '') {
  const locks = getIdentityLocks(profile);
  const normalizedProfile = normalizeUserProfile(profile, name);
  const icoValues = new Set();
  const dicValues = new Set();

  addIdentityValues(icoValues, locks.icoValues);
  addIdentityValues(dicValues, locks.dicValues);
  addIdentityValue(icoValues, normalizedProfile.driver?.ico);
  addIdentityValue(icoValues, normalizedProfile.provider?.ico);
  addIdentityValue(dicValues, normalizedProfile.driver?.dic);
  addIdentityValue(dicValues, normalizedProfile.provider?.dic);

  for (const provider of normalizedProfile.providers || []) {
    addIdentityValue(icoValues, provider.ico);
    addIdentityValue(dicValues, provider.dic || provider.dicVat);
  }

  return {
    icoValues: Array.from(icoValues),
    dicValues: Array.from(dicValues),
  };
}

export function buildProfileWithBusinessIdentityLocks(profile, previousProfile = null, name = '') {
  const normalizedProfile = normalizeUserProfile(profile, name);
  const currentIdentity = collectBusinessIdentityValues(previousProfile, name);
  const nextIdentity = collectBusinessIdentityValues(normalizedProfile, name);
  const icoValues = Array.from(new Set([
    ...currentIdentity.icoValues,
    ...nextIdentity.icoValues,
  ]));
  const dicValues = Array.from(new Set([
    ...currentIdentity.dicValues,
    ...nextIdentity.dicValues,
  ]));

  if (!icoValues.length && !dicValues.length) {
    return normalizedProfile;
  }

  return {
    ...normalizedProfile,
    identityLocks: {
      icoValues,
      dicValues,
    },
  };
}

export function buildBusinessIdentityData(profile, name = '') {
  const identity = collectBusinessIdentityValues(profile, name);

  return {
    businessIco: identity.icoValues[0] || null,
    businessDic: identity.dicValues[0] || null,
  };
}

export async function assertBusinessIdentityAvailable(
  client,
  { profile, name = '', excludeUserId = '' } = {}
) {
  const identity = collectBusinessIdentityValues(profile, name);
  const icoValues = identity.icoValues.length ? identity.icoValues : [EMPTY_IDENTITY_SENTINEL];
  const dicValues = identity.dicValues.length ? identity.dicValues : [EMPTY_IDENTITY_SENTINEL];

  if (!identity.icoValues.length && !identity.dicValues.length) {
    return;
  }

  const excludedUserFilter = excludeUserId
    ? Prisma.sql`AND id <> ${excludeUserId}`
    : Prisma.empty;
  const matches = await client.$queryRaw`
    SELECT id
    FROM users
    WHERE true
      ${excludedUserFilter}
      AND (
        "businessIco" IN (${Prisma.join(icoValues)})
        OR "businessDic" IN (${Prisma.join(dicValues)})
        OR regexp_replace(upper(COALESCE(profile#>>'{driver,ico}', '')), '[^A-Z0-9]', '', 'g') IN (${Prisma.join(icoValues)})
        OR regexp_replace(upper(COALESCE(profile#>>'{provider,ico}', '')), '[^A-Z0-9]', '', 'g') IN (${Prisma.join(icoValues)})
        OR regexp_replace(upper(COALESCE(profile#>>'{driver,dic}', profile#>>'{driver,dicVat}', '')), '[^A-Z0-9]', '', 'g') IN (${Prisma.join(dicValues)})
        OR regexp_replace(upper(COALESCE(profile#>>'{provider,dic}', profile#>>'{provider,dicVat}', '')), '[^A-Z0-9]', '', 'g') IN (${Prisma.join(dicValues)})
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(
            CASE
              WHEN jsonb_typeof(profile#>'{identityLocks,icoValues}') = 'array' THEN profile#>'{identityLocks,icoValues}'
              ELSE '[]'::jsonb
            END
          ) AS locked_ico(value)
          WHERE regexp_replace(upper(COALESCE(locked_ico.value, '')), '[^A-Z0-9]', '', 'g') IN (${Prisma.join(icoValues)})
        )
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(
            CASE
              WHEN jsonb_typeof(profile#>'{identityLocks,dicValues}') = 'array' THEN profile#>'{identityLocks,dicValues}'
              ELSE '[]'::jsonb
            END
          ) AS locked_dic(value)
          WHERE regexp_replace(upper(COALESCE(locked_dic.value, '')), '[^A-Z0-9]', '', 'g') IN (${Prisma.join(dicValues)})
        )
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(profile->'providers') = 'array' THEN profile->'providers'
              ELSE '[]'::jsonb
            END
          ) AS provider
          WHERE regexp_replace(upper(COALESCE(provider->>'ico', '')), '[^A-Z0-9]', '', 'g') IN (${Prisma.join(icoValues)})
             OR regexp_replace(upper(COALESCE(provider->>'dic', provider->>'dicVat', '')), '[^A-Z0-9]', '', 'g') IN (${Prisma.join(dicValues)})
        )
      )
    LIMIT 1
  `;

  if (matches.length) {
    throw new Error('Business identifiers are already used');
  }
}
