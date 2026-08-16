import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectContract, selectCustomer, setPassengers, updateCustomerField } from '../../contractSlice.js';
import {
  CustomerBirthDatePickerModal,
  formatBirthDateDisplay,
  parseBirthDateParts,
} from './CustomerBirthDatePickerModal.jsx';
import './CustomerFields.css';

export function CustomerFields() {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const customer = useSelector(selectCustomer);
  const passengers = useSelector(selectContract).passengers;
  const [isAdditionalOpen, setIsAdditionalOpen] = useState(false);
  const [isBirthDatePickerOpen, setIsBirthDatePickerOpen] = useState(false);
  const birthDateParts = parseBirthDateParts(customer.birthDate);
  const birthDateLabel = formatBirthDateDisplay(customer.birthDate);
  const additionalSummary = [
    birthDateLabel ? `${t('contract.customerBirthDate')}: ${birthDateLabel}` : '',
    customer.address ? `${t('contract.customerAddress')}: ${customer.address}` : '',
  ].filter(Boolean).join(' · ');

  function handlePassengersChange(event) {
    const nextValue = event.target.value.replace(/[^\d]/g, '');
    dispatch(setPassengers(nextValue));
  }

  return (
    <>
      <div className="contractFieldsBlock">
        <label className="contractField">
          <div className="contractFieldControl">
            <input
              className="contractField-input"
              type="text"
              placeholder={`${t('contract.fullName')} *`}
              required
              value={customer.name}
              onChange={event =>
                dispatch(updateCustomerField({ key: 'name', value: event.target.value }))
              }
            />
            {customer.name ? (
              <button
                className="contractField-clear"
                type="button"
                aria-label={t('common.clear')}
                onClick={() => dispatch(updateCustomerField({ key: 'name', value: '' }))}
              >
                ×
              </button>
            ) : null}
          </div>
        </label>

        <label className="contractField">
          <div className="contractFieldControl">
            <input
              className="contractField-input"
              type="text"
              placeholder={`${t('contract.contact')} *`}
              required
              value={customer.email}
              onChange={event =>
                dispatch(updateCustomerField({ key: 'email', value: event.target.value }))
              }
            />
            {customer.email ? (
              <button
                className="contractField-clear"
                type="button"
                aria-label={t('common.clear')}
                onClick={() => dispatch(updateCustomerField({ key: 'email', value: '' }))}
              >
                ×
              </button>
            ) : null}
          </div>
        </label>

        <label className="contractField">
          <div className="contractFieldControl">
            <input
              className="contractField-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={`${t('contract.passengers')} *`}
              required
              value={passengers}
              onChange={handlePassengersChange}
            />
            {passengers ? (
              <button
                className="contractField-clear"
                type="button"
                aria-label={t('common.clear')}
                onClick={() => dispatch(setPassengers(''))}
              >
                ×
              </button>
            ) : null}
          </div>
        </label>
      </div>

      <div className={`customerAdditional ${isAdditionalOpen ? 'is-open' : ''}`}>
        <button
          className="customerAdditional-trigger"
          type="button"
          aria-expanded={isAdditionalOpen}
          aria-controls="customerAdditionalFields"
          onClick={() => setIsAdditionalOpen(value => !value)}
        >
          <span className="customerAdditional-copy">
            <span className="customerAdditional-title">{t('contract.customerAdditionalInfo')}</span>
            <span className="customerAdditional-value">
              {additionalSummary || t('contract.customerAdditionalInfoHint')}
            </span>
          </span>
          <span className="customerAdditional-chevron" aria-hidden="true">
            <SvgIcon name="chevron-right" />
          </span>
        </button>

        {isAdditionalOpen ? (
          <div className="customerAdditional-panel" id="customerAdditionalFields">
            <div className="contractField">
              <div className={`customerBirthDateField ${customer.birthDate ? 'is-selected' : ''}`}>
                <button
                  className="customerBirthDateField-trigger"
                  type="button"
                  aria-label={birthDateLabel || t('contract.customerBirthDate')}
                  onClick={() => setIsBirthDatePickerOpen(true)}
                >
                  <span className={`customerBirthDateField-part ${birthDateParts.day ? '' : 'is-placeholder'}`}>
                    {birthDateParts.day || 'ДД'}
                  </span>
                  <span className="customerBirthDateField-separator" aria-hidden="true">.</span>
                  <span className={`customerBirthDateField-part ${birthDateParts.month ? '' : 'is-placeholder'}`}>
                    {birthDateParts.month || 'ММ'}
                  </span>
                  <span className="customerBirthDateField-separator" aria-hidden="true">.</span>
                  <span className={`customerBirthDateField-part customerBirthDateField-year ${birthDateParts.year ? '' : 'is-placeholder'}`}>
                    {birthDateParts.year || 'РРРР'}
                  </span>
                </button>
                {customer.birthDate ? (
                  <button
                    className="contractField-clear"
                    type="button"
                    aria-label={t('common.clear')}
                    onClick={() => dispatch(updateCustomerField({ key: 'birthDate', value: '' }))}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>

            <label className="contractField">
              <div className="contractFieldControl">
                <input
                  className="contractField-input"
                  type="text"
                  autoComplete="street-address"
                  placeholder={t('contract.customerAddress')}
                  value={customer.address || ''}
                  onChange={event =>
                    dispatch(updateCustomerField({ key: 'address', value: event.target.value }))
                  }
                />
                {customer.address ? (
                  <button
                    className="contractField-clear"
                    type="button"
                    aria-label={t('common.clear')}
                    onClick={() => dispatch(updateCustomerField({ key: 'address', value: '' }))}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </label>
          </div>
        ) : null}
      </div>

      <CustomerBirthDatePickerModal
        isOpen={isBirthDatePickerOpen}
        value={customer.birthDate}
        onClose={() => setIsBirthDatePickerOpen(false)}
        onSave={value => {
          dispatch(updateCustomerField({ key: 'birthDate', value }));
          setIsBirthDatePickerOpen(false);
        }}
      />
    </>
  );
}
