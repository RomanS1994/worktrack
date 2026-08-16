import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useI18n } from '@shared/app/i18n/useI18n.js';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { formatDateTime } from '@shared/app/utils/dateFormat.js';
import { AddressAutocompleteField } from '../../../addressAutocomplete/AddressAutocompleteField.jsx';
import { TripAdditionalInfoModal } from '../TripAdditionalInfoModal/TripAdditionalInfoModal.jsx';
import { getChildSeatCount, toCount } from '../TripAdditionalInfoModal/additionalInfoUtils.js';
import { TripDateTimePickerModal } from '../TripDateTimePickerModal/TripDateTimePickerModal.jsx';
import {
  selectContract,
  selectTrip,
  setFlightNumber,
  updateTripField,
} from '../../contractSlice.js';
import './TripFields.css';

function getPaymentIcon(key) {
  if (key === 'card') {
    return <SvgIcon name="card" />;
  }

  if (key === 'cash') {
    return <SvgIcon name="cash" />;
  }

  return <SvgIcon name="invoice" />;
}

export function TripFields() {
  const { language, t } = useI18n();
  const dispatch = useDispatch();
  const contract = useSelector(selectContract);
  const trip = useSelector(selectTrip);
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const selectedDate = toDateValue(trip.time);
  const formattedTripTime = selectedDate ? formatDateTime(selectedDate, language) : '';
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isAdditionalOpen, setIsAdditionalOpen] = useState(false);
  const additionalInfoSummary = buildAdditionalInfoSummary(contract, trip, t);
  const paymentMethods = [
    { key: 'card', label: t('contract.card') },
    { key: 'cash', label: t('contract.cash') },
    { key: 'invoice', label: t('contract.invoice') },
  ];

  function openTimePicker() {
    setIsTimePickerOpen(true);
  }

  function closeTimePicker() {
    setIsTimePickerOpen(false);
  }

  function saveTimePicker(value) {
    dispatch(
      updateTripField({
        key: 'time',
        value,
      }),
    );
    setIsTimePickerOpen(false);
  }

  return (
    <>
      <div className="contractFieldsBlock">
        <label className="contractField">
          <AddressAutocompleteField
            apiKey={mapsApiKey}
            ariaLabel={t('contract.pickupAddress')}
            clearLabel={t('contract.clearPickupAddress')}
            placeholder={`${t('contract.pickupAddress')} *`}
            value={trip.from?.address || ''}
            onChange={value => dispatch(updateTripField({ key: 'from', value }))}
            onClear={() => dispatch(updateTripField({ key: 'from', value: '' }))}
          />
        </label>

        <label className="contractField">
          <AddressAutocompleteField
            apiKey={mapsApiKey}
            ariaLabel={t('contract.dropoffAddress')}
            clearLabel={t('contract.clearDropoffAddress')}
            placeholder={`${t('contract.dropoffAddress')} *`}
            value={trip.to?.address || ''}
            onChange={value => dispatch(updateTripField({ key: 'to', value }))}
            onClear={() => dispatch(updateTripField({ key: 'to', value: '' }))}
          />
        </label>

        <div className="contractOptionalFields">
          <div className="contractOptionalField">
            <button
              className="contractOptionalField-trigger"
              type="button"
              onClick={() => setIsAdditionalOpen(true)}
            >
              <span className="contractOptionalField-copy">
                <span className="contractOptionalField-title">{t('contract.additionalInfo')}</span>
                {additionalInfoSummary ? (
                  <span className="contractOptionalField-value">
                    {additionalInfoSummary}
                  </span>
                ) : (
                  <span className="contractOptionalField-value">
                    {t('contract.additionalInfoHint')}
                  </span>
                )}
              </span>
              <span className="contractOptionalField-chevron" aria-hidden="true">
                <SvgIcon name="chevron-right" />
              </span>
            </button>
          </div>
        </div>

        <label className="contractField">
          <div className={`contractDateField ${trip.time ? 'is-selected' : ''}`}>
            <button
              className="contractDateField-trigger"
              type="button"
              onClick={openTimePicker}
              aria-label={formattedTripTime || t('contract.pickupDateTime')}
            >
              <span className="contractDateField-icon" aria-hidden="true">
                <SvgIcon name="calendar" />
              </span>
              <span className={`contractDateField-value ${trip.time ? '' : 'is-placeholder'}`}>
                {formattedTripTime || `${t('contract.pickupDateTime')} *`}
              </span>
            </button>
            {trip.time ? (
              <button
                className="contractField-clear contractDateField-clear"
                type="button"
                aria-label={t('contract.clearPickupDateTime')}
                onClick={() => dispatch(updateTripField({ key: 'time', value: '' }))}
              >
                ×
              </button>
            ) : null}
          </div>
        </label>

        <div className="paymentMethodBlock">
          <div className="paymentMethodLabel">
            <span>{t('contract.paymentMethod')}</span>
            <span aria-hidden="true" className="paymentMethodRequired">
              *
            </span>
          </div>
          <div className="paymentMethodButtons">
            {paymentMethods.map(method => (
              <button
                key={method.key}
                className={`paymentMethodButton ${trip.paymentMethod === method.key ? 'is-active' : ''}`}
                type="button"
                onClick={() => dispatch(updateTripField({ key: 'paymentMethod', value: method.key }))}
              >
                <span className="paymentMethodButton-icon" aria-hidden="true">
                  {getPaymentIcon(method.key)}
                </span>
                {method.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <TripDateTimePickerModal
        isOpen={isTimePickerOpen}
        value={trip.time}
        onClose={closeTimePicker}
        onSave={saveTimePicker}
      />
      <TripAdditionalInfoModal
        isOpen={isAdditionalOpen}
        flightNumber={contract.flightNumber}
        driverComment={trip.driverComment}
        luggageUnits={trip.luggageUnits}
        childSeats={trip.childSeats}
        onClose={() => setIsAdditionalOpen(false)}
        onFlightNumberChange={value => dispatch(setFlightNumber(value))}
        onDriverCommentChange={value => dispatch(updateTripField({ key: 'driverComment', value }))}
        onLuggageUnitsChange={value => dispatch(updateTripField({ key: 'luggageUnits', value }))}
        onChildSeatsChange={value => dispatch(updateTripField({ key: 'childSeats', value }))}
      />
    </>
  );
}

function toDateValue(value) {
  const text = toDateTimeLocalValue(value);

  if (!text) {
    return null;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildAdditionalInfoSummary(contract, trip, t) {
  const luggageUnits = toCount(trip.luggageUnits);
  const childSeatCount = getChildSeatCount(trip.childSeats);
  const items = [
    contract.flightNumber,
    trip.driverComment,
    luggageUnits > 0 ? `${t('contract.luggageUnits')}: ${luggageUnits}` : '',
    childSeatCount > 0 ? `${t('contract.addChildSeats')}: ${childSeatCount}` : '',
  ].filter(Boolean);

  return items.join(' · ');
}

function toDateTimeLocalValue(value) {
  const text = String(value ?? '').trim();

  if (!text) {
    return '';
  }

  const match = text.match(
    /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/,
  );

  if (match) {
    return `${match[1]}T${match[2] || '00:00'}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}T${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
}
