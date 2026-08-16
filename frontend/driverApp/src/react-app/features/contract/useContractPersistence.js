import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { selectUser } from '@shared/features/auth/authSlice.js';
import { getDefaultProvider, hasProviderData } from '@shared/features/auth/providerProfile.js';
import { replaceContract, selectContract, syncBusinessProfile } from './contractSlice.js';
import { loadContractDraft, saveContractDraft } from './contractStorage.js';

function getProfileContractPatch(user) {
  const profile = user?.profile || {};
  const driver = profile.driver || {};
  const provider = getDefaultProvider(user);
  const fallbackName = user?.name || '';
  const hasSelectedProvider = hasProviderData(provider);

  return {
    driver: {
      name: driver.name || fallbackName,
      address: driver.address || '',
      spz: driver.spz || '',
      ico: driver.ico || '',
      dic: driver.dic || '',
    },
    provider: {
      id: hasSelectedProvider ? provider.id || profile.defaultProviderId || '' : '',
      name: hasSelectedProvider ? provider.name || '' : '',
      address: hasSelectedProvider ? provider.address || '' : '',
      ico: hasSelectedProvider ? provider.ico || '' : '',
      dic: hasSelectedProvider ? provider.dic || '' : '',
    },
  };
}

function hasSameDriverProfile(contract, patch) {
  return (
    contract?.driver?.name === patch.driver.name &&
    contract?.driver?.address === patch.driver.address &&
    contract?.driver?.spz === patch.driver.spz &&
    contract?.driver?.ico === patch.driver.ico &&
    (contract?.driver?.dic || '') === patch.driver.dic
  );
}

function shouldSyncProvider(contract, patch) {
  return hasProviderData(patch?.provider) && !hasProviderData(contract?.provider);
}

export function useContractPersistence() {
  const dispatch = useDispatch();
  const contract = useSelector(selectContract);
  const user = useSelector(selectUser);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const savedContract = loadContractDraft();

    if (savedContract) {
      dispatch(replaceContract(savedContract));
    }

    setIsReady(true);
  }, [dispatch]);

  useEffect(() => {
    if (!isReady || !user) return;

    const nextProfile = getProfileContractPatch(user);
    const shouldUpdateDriver = !hasSameDriverProfile(contract, nextProfile);
    const shouldUpdateProvider = shouldSyncProvider(contract, nextProfile);

    if (shouldUpdateDriver || shouldUpdateProvider) {
      dispatch(syncBusinessProfile({
        ...(shouldUpdateDriver ? { driver: nextProfile.driver } : {}),
        ...(shouldUpdateProvider ? { provider: nextProfile.provider } : {}),
      }));
    }
  }, [contract, dispatch, isReady, user]);

  useEffect(() => {
    if (!isReady) return;

    saveContractDraft(contract);
  }, [contract, isReady]);
}
