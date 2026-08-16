import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectContract, setTotalPrice } from '../../contractSlice.js';
import {
  detectCurrency,
  extractNumericPrice,
  formatPrice,
  sanitizePriceInput,
  setCurrentCurrency,
} from '../../utils/priceUtils.js';
import './PriceField.css';

export function PriceField() {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const totalPrice = useSelector(selectContract).totalPrice;
  const [priceInput, setPriceInput] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const skipSyncRef = useRef(false);

  const convertedPrice = useMemo(() => {
    if (!priceInput) {
      return '';
    }

    return formatPrice(priceInput, currency);
  }, [currency, priceInput]);

  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }

    const currentValue = String(totalPrice || '').trim();
    const nextCurrency = detectCurrency(currentValue);
    const nextInput = extractNumericPrice(currentValue);

    setCurrency(nextCurrency);
    setCurrentCurrency(nextCurrency);
    setPriceInput(nextInput);
  }, [totalPrice]);

  function syncPrice(nextInput, nextCurrency) {
    const formatted = formatPrice(nextInput, nextCurrency);
    const nextValue = formatted || nextInput;

    skipSyncRef.current = true;
    setCurrentCurrency(nextCurrency);
    setCurrency(nextCurrency);
    setPriceInput(nextInput);
    dispatch(setTotalPrice(nextValue));
  }

  function handleInputChange(event) {
    const nextInput = sanitizePriceInput(event.target.value);
    syncPrice(nextInput, currency);
  }

  function handleCurrencyChange(nextCurrency) {
    if (nextCurrency === currency) {
      return;
    }

    syncPrice(priceInput, nextCurrency);
  }

  function clearPrice() {
    skipSyncRef.current = true;
    setPriceInput('');
    dispatch(setTotalPrice(''));
  }

  return (
    <section className="contractSection contractSection-price">
      <h3 className="contractSection-title">{t('contract.price')}</h3>

      <div className="priceField">
        <div className="priceField-row">
          <div className="priceField-inputWrap">
            <input
              className="priceField-input"
              type="text"
              inputMode="decimal"
              aria-label={t('contract.tripPrice')}
              placeholder={`${t('contract.tripPrice')} *`}
              required
              value={priceInput}
              onChange={handleInputChange}
            />

            {priceInput ? (
              <button className="priceField-clear" type="button" aria-label={t('common.clear')} onClick={clearPrice}>
                ×
              </button>
            ) : null}
          </div>

          {['EUR', 'CZK'].map(item => (
            <button
              key={item}
              className={`priceField-currencyButton ${currency === item ? 'is-active' : ''}`}
              type="button"
              onClick={() => handleCurrencyChange(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {convertedPrice ? <p className="priceField-converted">{convertedPrice}</p> : null}
      </div>
    </section>
  );
}
