import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useLazyGetMeQuery } from '@shared/features/auth/authApi.js';
import { selectToken, selectUser, setSession } from '@shared/features/auth/authSlice.js';
import { saveSession } from '@shared/features/auth/authStorage.js';
import {
  getUserProviders,
  hasSameProviderDetails,
  hasProviderData,
} from '@shared/features/auth/providerProfile.js';
import { selectProvider, setProvider } from '../../contractSlice.js';
import './ProviderSelector.css';

export function ProviderSelector() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const token = useSelector(selectToken);
  const provider = useSelector(selectProvider);
  const { t } = useI18n();
  const [getMe] = useLazyGetMeQuery();
  const [isOpen, setIsOpen] = useState(false);
  const providers = useMemo(() => getUserProviders(user), [user]);
  const hasSelectedProviderData = hasProviderData(provider);
  const defaultProviderId = user?.profile?.defaultProviderId || providers[0]?.id || '';
  const defaultProvider =
    providers.find(item => item.id && item.id === defaultProviderId) ||
    providers[0] ||
    null;
  const profileSignature = useMemo(
    () => `${defaultProviderId}:${providers.map(item => item.id).join('|')}`,
    [defaultProviderId, providers],
  );
  const previousProfileRef = useRef({
    defaultProviderId: '',
    signature: '',
  });
  const matchedProvider =
    providers.find(item => item.id && item.id === provider?.id) ||
    providers.find(item => hasSameProviderDetails(item, provider));
  const selectedProvider = matchedProvider || defaultProvider;
  const selectedProviderId = selectedProvider?.id || '';

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
        const updatedUser = response?.user || response;

        if (!isActive || !updatedUser) {
          return;
        }

        saveSession(token, updatedUser);
        dispatch(setSession({ token, user: updatedUser }));
      })
      .catch(() => {
        // Keep the current session if this scoped server sync fails.
      });

    return () => {
      isActive = false;
    };
  }, [dispatch, getMe, token]);

  useEffect(() => {
    const previousProfile = previousProfileRef.current;
    const hasProfileChanged = Boolean(
      previousProfile.signature && previousProfile.signature !== profileSignature,
    );

    if (previousProfile.signature !== profileSignature) {
      previousProfileRef.current = {
        defaultProviderId,
        signature: profileSignature,
      };
    }

    if (!providers.length) {
      if (hasSelectedProviderData) {
        dispatch(setProvider({}));
      }

      return;
    }

    if (
      hasProfileChanged &&
      defaultProvider &&
      previousProfile.defaultProviderId &&
      provider?.id === previousProfile.defaultProviderId &&
      previousProfile.defaultProviderId !== defaultProvider.id
    ) {
      dispatch(setProvider(defaultProvider));
      return;
    }

    if (!matchedProvider) {
      dispatch(setProvider(defaultProvider));
      return;
    }

    if (
      provider?.id !== matchedProvider.id ||
      !hasSameProviderDetails(provider, matchedProvider)
    ) {
      dispatch(setProvider(matchedProvider));
    }
  }, [
    defaultProvider,
    defaultProviderId,
    dispatch,
    hasSelectedProviderData,
    matchedProvider,
    profileSignature,
    provider,
    providers,
  ]);

  function handleSelect(nextProvider) {
    if (!nextProvider) {
      return;
    }

    dispatch(setProvider(nextProvider));
    setIsOpen(false);
  }

  return (
    <div className="providerSelector">
      {providers.length ? (
        <section className={`providerSelector-card ${isOpen ? 'is-open' : ''}`}>
          <button
            className="providerSelector-header"
            type="button"
            onClick={() => setIsOpen(current => !current)}
            aria-expanded={isOpen}
            aria-controls="providerSelectorDetails"
          >
            <span className="providerSelector-icon" aria-hidden="true">
              <SvgIcon name="invoice" />
            </span>
            <strong>{t('contract.providerForOrder')}</strong>
            <span className="providerSelector-chevron" aria-hidden="true">
              <SvgIcon name="chevron-right" />
            </span>
          </button>

          {isOpen ? (
            <div className="providerSelector-details" id="providerSelectorDetails">
              <div className="providerSelector-panel">
                <label className="providerSelector-field">
                  <span>{t('contract.selectProvider')}</span>
                  <select
                    value={selectedProviderId}
                    onChange={event => {
                      const nextProvider = providers.find(item => item.id === event.target.value);
                      handleSelect(nextProvider);
                      setIsOpen(true);
                    }}
                  >
                    {providers.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name || t('common.noName')}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="providerSelector-info">
                  <div className="providerSelector-infoRow">
                    <span className="providerSelector-infoCopy">
                      <span>{t('auth.address')}</span>
                      <strong>{selectedProvider?.address || '-'}</strong>
                    </span>
                  </div>

                  <div className="providerSelector-infoRow">
                    <span className="providerSelector-infoCopy">
                      <span>{t('auth.ico')}</span>
                      <strong>{selectedProvider?.ico || '-'}</strong>
                    </span>
                  </div>

                  {selectedProvider?.dic ? (
                    <div className="providerSelector-infoRow">
                      <span className="providerSelector-infoCopy">
                        <span>{t('auth.dic')}</span>
                        <strong>{selectedProvider.dic}</strong>
                      </span>
                    </div>
                  ) : null}
                </div>

                <Link className="providerSelector-manage" to="/settings/providers">
                  <SvgIcon name="accounts" />
                  <span>{t('contract.manageProviders')}</span>
                  <SvgIcon name="chevron-right" />
                </Link>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <div className="providerSelector-empty">
          <p>{t('contract.noProvidersForOrder')}</p>
          <Link to="/settings/providers">
            <SvgIcon name="plus" />
            <span>{t('contract.manageProviders')}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
