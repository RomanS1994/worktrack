function normalizeText(value) {
  return String(value || '').trim();
}

export function createEmptyProvider() {
  return {
    id: '',
    name: '',
    address: '',
    ico: '',
    dic: '',
  };
}

export function hasProviderData(provider) {
  return Boolean(
    normalizeText(provider?.name) ||
      normalizeText(provider?.address) ||
      normalizeText(provider?.ico) ||
      normalizeText(provider?.dic || provider?.dicVat)
  );
}

export function createProviderId() {
  const randomValue =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return `provider-${randomValue}`;
}

export function normalizeProvider(provider, fallbackId = '') {
  const source = provider && typeof provider === 'object' ? provider : {};

  return {
    id: normalizeText(source.id) || fallbackId || createProviderId(),
    name: normalizeText(source.name),
    address: normalizeText(source.address),
    ico: normalizeText(source.ico),
    dic: normalizeText(source.dic || source.dicVat),
  };
}

export function getProfileProviders(profile, userName = '') {
  const source = profile && typeof profile === 'object' ? profile : {};
  const providers = [];
  const seen = new Set();
  const hasExplicitProviders = Array.isArray(source.providers);

  if (hasExplicitProviders) {
    source.providers.forEach((item, index) => {
      const provider = normalizeProvider(item, `provider-${index + 1}`);

      if (!hasProviderData(provider) || seen.has(provider.id)) {
        return;
      }

      seen.add(provider.id);
      providers.push(provider);
    });
  }

  if (!hasExplicitProviders && !providers.length) {
    const legacyProvider = normalizeProvider(
      {
        ...(source.provider || {}),
        name: source.provider?.name || userName || '',
      },
      'provider-1',
    );

    if (hasProviderData(legacyProvider)) {
      providers.push(legacyProvider);
    }
  }

  return providers;
}

export function getUserProviders(user) {
  return getProfileProviders(user?.profile, user?.name || '');
}

export function getDefaultProviderFromProfile(profile, userName = '') {
  const source = profile && typeof profile === 'object' ? profile : {};
  const providers = getProfileProviders(profile, userName);
  const defaultProviderId = normalizeText(source.defaultProviderId);

  const defaultProvider =
    providers.find(provider => provider.id === defaultProviderId) ||
    providers[0];

  if (defaultProvider) {
    return defaultProvider;
  }

  return Array.isArray(source.providers)
    ? createEmptyProvider()
    : normalizeProvider({ name: userName }, 'provider-1');
}

export function getDefaultProvider(user) {
  return getDefaultProviderFromProfile(user?.profile, user?.name || '');
}

export function hasSameProviderDetails(left, right) {
  return (
    normalizeText(left?.name) === normalizeText(right?.name) &&
    normalizeText(left?.address) === normalizeText(right?.address) &&
    normalizeText(left?.ico) === normalizeText(right?.ico) &&
    normalizeText(left?.dic || left?.dicVat) === normalizeText(right?.dic || right?.dicVat)
  );
}

export function serializeProviders(providers) {
  const seen = new Set();

  return (Array.isArray(providers) ? providers : []).reduce((items, item, index) => {
    const provider = normalizeProvider(item, `provider-${index + 1}`);

    if (!hasProviderData(provider) || seen.has(provider.id)) {
      return items;
    }

    seen.add(provider.id);
    items.push(provider);
    return items;
  }, []);
}
