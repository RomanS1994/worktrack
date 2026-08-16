import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { RequestLoader } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useLazyGetMeQuery, useUpdateProfileMutation } from '@shared/features/auth/authApi.js';
import { selectToken, selectUser, setSession } from '@shared/features/auth/authSlice.js';
import { saveSession } from '@shared/features/auth/authStorage.js';
import {
  createEmptyProvider,
  createProviderId,
  getUserProviders,
  hasProviderData,
  normalizeProvider,
  serializeProviders,
} from '@shared/features/auth/providerProfile.js';
import './ProvidersPage.css';

function buildProviderDraft(user) {
  const providers = getUserProviders(user);

  return {
    providers,
    defaultProviderId: user?.profile?.defaultProviderId || providers[0]?.id || '',
  };
}

function createDraftProvider() {
  return {
    ...createEmptyProvider(),
    id: createProviderId(),
  };
}

function getDefaultProviderId(providers, currentDefaultId) {
  if (providers.some(provider => provider.id === currentDefaultId)) {
    return currentDefaultId;
  }

  return providers[0]?.id || '';
}

export function ProvidersPage() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const token = useSelector(selectToken);
  const { t } = useI18n();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const [getMe] = useLazyGetMeQuery();
  const [providers, setProviders] = useState(() => buildProviderDraft(user).providers);
  const [defaultProviderId, setDefaultProviderId] = useState(
    () => buildProviderDraft(user).defaultProviderId,
  );
  const [newProvider, setNewProvider] = useState(null);
  const [expandedProviderIds, setExpandedProviderIds] = useState(() => new Set());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function applyUserSession(updatedUser) {
    if (!updatedUser || !token) {
      return;
    }

    saveSession(token, updatedUser);
    dispatch(setSession({ token, user: updatedUser }));
  }

  useEffect(() => {
    const draft = buildProviderDraft(user);
    setProviders(draft.providers);
    setDefaultProviderId(draft.defaultProviderId);
    setNewProvider(null);
    setExpandedProviderIds(new Set());
  }, [user]);

  useEffect(() => {
    let isActive = true;

    if (!token) {
      return () => {
        isActive = false;
      };
    }

    getMe()
      .unwrap()
      .then(response => {
        if (!isActive) {
          return;
        }

        applyUserSession(response?.user || response);
      })
      .catch(() => {
        // Keep the current session if this scoped server sync fails.
      });

    return () => {
      isActive = false;
    };
  }, [getMe, token]);

  function addProvider() {
    setMessage('');
    setError('');
    setNewProvider(current => current || createDraftProvider());
  }

  function updateNewProvider(field, value) {
    setNewProvider(current => ({
      ...(current || createDraftProvider()),
      [field]: value,
    }));
  }

  function cancelNewProvider() {
    setMessage('');
    setError('');
    setNewProvider(null);
  }

  function toggleProvider(providerId) {
    setExpandedProviderIds(current => {
      const next = new Set(current);

      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
      }

      return next;
    });
  }

  function updateProvider(providerId, field, value) {
    setProviders(current =>
      current.map(provider =>
        provider.id === providerId
          ? {
              ...provider,
              [field]: value,
            }
          : provider,
      ),
    );
  }

  async function deleteProvider(providerId) {
    const nextProviders = providers.filter(provider => provider.id !== providerId);
    const nextDefaultProviderId = getDefaultProviderId(nextProviders, defaultProviderId);
    const saved = await saveProviders(
      nextProviders,
      nextDefaultProviderId,
      t('settings.providers.saved'),
    );

    if (saved) {
      setExpandedProviderIds(current => {
        const next = new Set(current);
        next.delete(providerId);
        return next;
      });
    }
  }

  async function makeDefaultProvider(providerId) {
    await saveProviders(
      providers,
      providerId,
      t('settings.providers.saved'),
    );
  }

  async function commitProviderUpdate(providerId, field, value) {
    const nextProviders = providers.map(provider =>
      provider.id === providerId
        ? {
            ...provider,
            [field]: value,
          }
        : provider,
    );
    const nextDefaultProviderId = getDefaultProviderId(nextProviders, defaultProviderId);

    await saveProviders(
      nextProviders,
      nextDefaultProviderId,
      t('settings.providers.saved'),
    );
  }

  async function saveProviders(nextProviders, nextDefaultProviderId, successMessage) {
    setMessage('');
    setError('');

    const serializedProviders = serializeProviders(nextProviders);
    const resolvedDefaultProviderId = getDefaultProviderId(
      serializedProviders,
      nextDefaultProviderId,
    );
    const defaultProvider =
      serializedProviders.find(provider => provider.id === resolvedDefaultProviderId) ||
      serializedProviders[0] ||
      createEmptyProvider();

    try {
      const updatedUser = await updateProfile({
        providers: serializedProviders,
        defaultProviderId: resolvedDefaultProviderId,
        provider: defaultProvider,
      }).unwrap();

      applyUserSession(updatedUser);
      setProviders(serializedProviders);
      setDefaultProviderId(resolvedDefaultProviderId);
      setMessage(successMessage);
      return true;
    } catch (error) {
      setError(getApiErrorMessage(error, 'settings.providers.failed'));
      return false;
    }
  }

  async function handleSaveNewProvider() {
    if (!hasProviderData(newProvider)) {
      setMessage('');
      setError(t('settings.providers.fillNewProvider'));
      return;
    }

    const draftProvider = normalizeProvider(newProvider, newProvider.id || createProviderId());
    const nextProviders = serializeProviders([...providers, draftProvider]);
    const nextDefaultProviderId = getDefaultProviderId(
      nextProviders,
      defaultProviderId || draftProvider.id,
    );
    const saved = await saveProviders(
      nextProviders,
      nextDefaultProviderId,
      t('settings.providers.newSaved'),
    );

    if (saved) {
      setNewProvider(null);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextProviders = serializeProviders(providers);
    const nextDefaultProviderId = getDefaultProviderId(nextProviders, defaultProviderId);
    await saveProviders(
      nextProviders,
      nextDefaultProviderId,
      t('settings.providers.saved'),
    );
  }

  return (
    <section className="providersPage pageStack">
      <header className="providersPage-header">
        <BackButton to="/settings" />

        <div className="appTitleBlock">
          <h1>{t('settings.providers.title')}</h1>
          <p>{t('settings.providers.subtitle')}</p>
        </div>
      </header>

      <form className="screenCard providersPage-card" onSubmit={handleSubmit}>
        <div className="providersPage-toolbar">
          <button className="providersPage-addButton" type="button" onClick={addProvider}>
            <SvgIcon name="plus" />
            <span>{t('settings.providers.add')}</span>
          </button>
        </div>

        {newProvider || providers.length ? (
          <div className="providersPage-list">
            {newProvider ? (
              <section className="providersPage-providerCard providersPage-providerCard--new">
                <div className="providersPage-providerHeader">
                  <span className="providersPage-providerIcon" aria-hidden="true">
                    <SvgIcon name="invoice" />
                  </span>

                  <div className="providersPage-providerTitle">
                    <strong>{t('settings.providers.newTitle')}</strong>
                  </div>
                </div>

                <div className="providersPage-fields">
                  <label className="providersPage-field">
                    <span>{t('auth.name')}</span>
                    <input
                      type="text"
                      value={newProvider.name}
                      placeholder={t('settings.providers.namePlaceholder')}
                      onChange={event => updateNewProvider('name', event.target.value)}
                    />
                  </label>

                  <label className="providersPage-field">
                    <span>{t('auth.address')}</span>
                    <input
                      type="text"
                      value={newProvider.address}
                      placeholder={t('settings.providers.addressPlaceholder')}
                      onChange={event => updateNewProvider('address', event.target.value)}
                    />
                  </label>

                  <div className="providersPage-fieldGrid">
                    <label className="providersPage-field">
                      <span>{t('auth.ico')}</span>
                      <input
                        type="text"
                        value={newProvider.ico}
                        placeholder={t('settings.providers.icoPlaceholder')}
                        onChange={event => updateNewProvider('ico', event.target.value)}
                      />
                    </label>

                    <label className="providersPage-field">
                      <span>{t('auth.dic')}</span>
                      <input
                        type="text"
                        value={newProvider.dic}
                        placeholder={t('settings.providers.dicPlaceholder')}
                        onChange={event => updateNewProvider('dic', event.target.value)}
                      />
                    </label>
                  </div>
                </div>

                <div className="providersPage-actions providersPage-newActions">
                  <button
                    className="providersPage-saveNewButton"
                    type="button"
                    onClick={handleSaveNewProvider}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <RequestLoader inline size="sm" label={t('common.saving')} />
                    ) : (
                      <>
                        <SvgIcon name="check-circle" />
                        <span>{t('settings.providers.saveNew')}</span>
                      </>
                    )}
                  </button>

                  <button
                    className="providersPage-secondaryButton"
                    type="button"
                    onClick={cancelNewProvider}
                    disabled={isLoading}
                  >
                    <span>{t('settings.providers.cancelNew')}</span>
                  </button>
                </div>
              </section>
            ) : null}

            {providers.map((provider, index) => {
              const isDefault = provider.id === defaultProviderId;
              const isExpanded = expandedProviderIds.has(provider.id);
              const title = provider.name || `${t('settings.providers.title')} ${index + 1}`;

              return (
                <section
                  className={`providersPage-providerCard ${isExpanded ? 'is-expanded' : ''}`}
                  key={provider.id}
                >
                  <button
                    className="providersPage-providerHeader providersPage-providerToggle"
                    type="button"
                    onClick={() => toggleProvider(provider.id)}
                    aria-expanded={isExpanded}
                  >
                    <span className="providersPage-providerIcon" aria-hidden="true">
                      <SvgIcon name="invoice" />
                    </span>

                    <div className="providersPage-providerTitle">
                      <strong>{title}</strong>
                      {isDefault ? <span>{t('settings.providers.defaultBadge')}</span> : null}
                    </div>

                    <span className="providersPage-providerChevron" aria-hidden="true">
                      <SvgIcon name="chevron-right" />
                    </span>
                  </button>

                  {isExpanded ? (
                    <div className="providersPage-providerDetails">
                      <div className="providersPage-fields">
                        <label className="providersPage-field">
                          <span>{t('auth.name')}</span>
                          <input
                            type="text"
                            value={provider.name}
                            placeholder={t('settings.providers.namePlaceholder')}
                            onChange={event => updateProvider(provider.id, 'name', event.target.value)}
                            onBlur={event =>
                              commitProviderUpdate(provider.id, 'name', event.target.value)
                            }
                          />
                        </label>

                        <label className="providersPage-field">
                          <span>{t('auth.address')}</span>
                          <input
                            type="text"
                            value={provider.address}
                            placeholder={t('settings.providers.addressPlaceholder')}
                            onChange={event =>
                              updateProvider(provider.id, 'address', event.target.value)
                            }
                            onBlur={event =>
                              commitProviderUpdate(provider.id, 'address', event.target.value)
                            }
                          />
                        </label>

                        <div className="providersPage-fieldGrid">
                          <label className="providersPage-field">
                            <span>{t('auth.ico')}</span>
                            <input
                              type="text"
                              value={provider.ico}
                              placeholder={t('settings.providers.icoPlaceholder')}
                              onChange={event => updateProvider(provider.id, 'ico', event.target.value)}
                              onBlur={event =>
                                commitProviderUpdate(provider.id, 'ico', event.target.value)
                              }
                            />
                          </label>

                          <label className="providersPage-field">
                            <span>{t('auth.dic')}</span>
                            <input
                              type="text"
                              value={provider.dic}
                              placeholder={t('settings.providers.dicPlaceholder')}
                              onChange={event => updateProvider(provider.id, 'dic', event.target.value)}
                              onBlur={event =>
                                commitProviderUpdate(provider.id, 'dic', event.target.value)
                              }
                            />
                          </label>
                        </div>
                      </div>

                      <div className="providersPage-actions">
                        <button
                          className="providersPage-secondaryButton"
                          type="button"
                          onClick={() => makeDefaultProvider(provider.id)}
                          disabled={isDefault || isLoading}
                        >
                          <SvgIcon name="check-circle" />
                          <span>{t('settings.providers.makeDefault')}</span>
                        </button>

                        <button
                          className="providersPage-deleteButton"
                          type="button"
                          onClick={() => deleteProvider(provider.id)}
                          disabled={isLoading}
                        >
                          <SvgIcon name="trash" />
                          <span>{t('settings.providers.delete')}</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : (
          <section className="providersPage-empty">
            <span aria-hidden="true">
              <SvgIcon name="invoice" />
            </span>
            <h2>{t('settings.providers.emptyTitle')}</h2>
            <p>{t('settings.providers.emptyCopy')}</p>
            <button className="providersPage-addButton" type="button" onClick={addProvider}>
              <SvgIcon name="plus" />
              <span>{t('settings.providers.add')}</span>
            </button>
          </section>
        )}

        {message ? <p className="providersPage-message">{message}</p> : null}
        {error ? <p className="providersPage-error">{error}</p> : null}

        <button className="providersPage-saveButton" type="submit" disabled={isLoading || Boolean(newProvider)}>
          {isLoading ? (
            <RequestLoader inline size="sm" label={t('common.saving')} />
          ) : (
            t('settings.providers.save')
          )}
        </button>
      </form>
    </section>
  );
}
