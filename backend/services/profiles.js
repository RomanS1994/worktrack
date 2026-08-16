import { normalizeText } from '../validation/common.js';

function hasProviderData(provider) {
  return Boolean(
    normalizeText(provider?.name) ||
      normalizeText(provider?.address) ||
      normalizeText(provider?.ico) ||
      normalizeText(provider?.dic)
  );
}

function normalizeProviderId(value, index = 0) {
  const id = normalizeText(value);

  return id || `provider-${index + 1}`;
}

function normalizeProviderRecord(provider, fallbackName = '', index = 0) {
  const source = provider && typeof provider === 'object' ? provider : {};
  const safeName = normalizeText(source.name || fallbackName);

  return {
    id: normalizeProviderId(source.id, index),
    name: safeName,
    address: normalizeText(source.address),
    ico: normalizeText(source.ico),
    dic: normalizeText(source.dic || source.dicVat),
  };
}

function normalizeProviders(source, providerFallback, fallbackName = '') {
  const providers = [];
  const seen = new Set();
  const hasExplicitProviders = Array.isArray(source.providers);
  const rawProviders = hasExplicitProviders ? source.providers : [];

  for (const item of rawProviders) {
    const provider = normalizeProviderRecord(item, '', providers.length);

    if (!hasProviderData(provider) || seen.has(provider.id)) {
      continue;
    }

    seen.add(provider.id);
    providers.push(provider);
  }

  if (!hasExplicitProviders && !providers.length && hasProviderData(providerFallback)) {
    const provider = normalizeProviderRecord(providerFallback, fallbackName, 0);
    providers.push(provider);
  }

  return providers;
}

export function buildDefaultProfile(name = '') {
  const safeName = normalizeText(name);

  return {
    avatarUrl: '',
    driver: {
      name: safeName,
      address: '',
      spz: '',
      ico: '',
    },
    provider: {
      id: '',
      name: safeName,
      address: '',
      ico: '',
      dic: '',
    },
    providers: [],
    defaultProviderId: '',
  };
}

export function normalizeTeamDriverIds(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const ids = [];

  for (const item of source) {
    const id = normalizeText(item);
    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    ids.push(id);
  }

  return ids;
}

export function normalizeUserProfile(profile, name = '') {
  const source = profile && typeof profile === 'object' ? profile : {};
  const defaults = buildDefaultProfile(name);
  const driverSource =
    source.driver && typeof source.driver === 'object' ? source.driver : {};
  const providerSource =
    source.provider && typeof source.provider === 'object' ? source.provider : {};
  const hasExplicitProviders = Array.isArray(source.providers);
  const providers = normalizeProviders(source, providerSource, defaults.provider.name);
  const defaultProviderId = normalizeText(source.defaultProviderId);
  const emptyProvider = {
    id: '',
    name: '',
    address: '',
    ico: '',
    dic: '',
  };
  const defaultProvider =
    providers.find(provider => provider.id === defaultProviderId) ||
    providers[0] ||
    (hasExplicitProviders ? emptyProvider : normalizeProviderRecord(providerSource, defaults.provider.name, 0));

  return {
    avatarUrl: normalizeText(source.avatarUrl || source.avatar || defaults.avatarUrl),
    driver: {
      ...defaults.driver,
      name: normalizeText(driverSource.name || defaults.driver.name),
      address: normalizeText(driverSource.address),
      spz: normalizeText(driverSource.spz),
      ico: normalizeText(driverSource.ico),
      dic: normalizeText(driverSource.dic || driverSource.dicVat),
    },
    provider: {
      ...defaults.provider,
      id: normalizeText(defaultProvider.id),
      name: normalizeText(defaultProvider.name || (hasExplicitProviders ? '' : defaults.provider.name)),
      address: normalizeText(defaultProvider.address),
      ico: normalizeText(defaultProvider.ico),
      dic: normalizeText(defaultProvider.dic || defaultProvider.dicVat),
    },
    providers,
    defaultProviderId: providers.length ? normalizeText(defaultProvider.id || providers[0]?.id) : '',
  };
}
