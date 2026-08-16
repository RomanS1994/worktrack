import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useContractPersistence } from '../../useContractPersistence.js';
import { CustomerFields } from '../CustomerFields/CustomerFields.jsx';
import { ProviderSelector } from '../ProviderSelector/ProviderSelector.jsx';
import { TripFields } from '../TripFields/TripFields.jsx';
import { ContractActions } from '../ContractActions/ContractActions.jsx';
import { PriceField } from '../PriceField/PriceField.jsx';
import './ContractForm.css';

export function ContractForm() {
  const { t } = useI18n();
  useContractPersistence();

  return (
    <section className="contractForm">
      <div className="contractForm-header">
        <h2 className="contractForm-title">{t('contract.form')}</h2>
      </div>

      <div className="contractForm-grid">
        <ProviderSelector />

        <section className="contractSection">
          <h3 className="contractSection-title">{t('contract.passenger')}</h3>
          <CustomerFields />
        </section>

        <section className="contractSection">
          <h3 className="contractSection-title">{t('contract.trip')}</h3>
          <TripFields />
        </section>

        <PriceField />

        <ContractActions />
      </div>
    </section>
  );
}
