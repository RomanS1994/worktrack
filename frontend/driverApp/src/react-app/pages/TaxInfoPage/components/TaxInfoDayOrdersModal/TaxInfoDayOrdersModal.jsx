import { useEffect } from 'react';

import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { getTaxOrderDisplayData } from '../../taxInfoData.js';
import './TaxInfoDayOrdersModal.css';

function getLocale(language) {
  if (language === 'cs') return 'cs-CZ';
  if (language === 'en') return 'en-GB';

  return 'uk-UA';
}

function formatDayLabel(date, day, language) {
  const locale = getLocale(language);
  const value = new Date(date.getFullYear(), date.getMonth(), day);

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value);
}

function formatTime(value, language) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat(getLocale(language), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
}

function getPaymentIcon(paymentMethod) {
  if (paymentMethod === 'cash') {
    return 'cash';
  }

  if (paymentMethod === 'card') {
    return 'card';
  }

  if (paymentMethod === 'invoice') {
    return 'invoice';
  }

  return 'file';
}

function getPaymentLabel(paymentMethod, t) {
  if (paymentMethod === 'cash' || paymentMethod === 'card' || paymentMethod === 'invoice') {
    return t(`contract.${paymentMethod}`);
  }

  return t('settings.taxInfo.dayOrders.paymentMissing');
}

export function TaxInfoDayOrdersModal({ date, day, isOpen, onClose, orders = [] }) {
  const { language, t } = useI18n();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const body = document.body;
    body.classList.add('no-scroll');

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      body.classList.remove('no-scroll');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !day) {
    return null;
  }

  const dayLabel = formatDayLabel(date, day, language);

  return (
    <div className="taxDayOrdersModal" role="presentation" onClick={onClose}>
      <div className="taxDayOrdersModal-backdrop" aria-hidden="true" />
      <section
        className="taxDayOrdersModal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="taxDayOrdersTitle"
        onClick={event => event.stopPropagation()}
      >
        <div className="taxDayOrdersModal-handle" aria-hidden="true" />

        <header className="taxDayOrdersModal-header">
          <div className="taxDayOrdersModal-titleBlock">
            <span className="taxDayOrdersModal-eyebrow">{dayLabel}</span>
            <h2 id="taxDayOrdersTitle">{t('settings.taxInfo.dayOrders.title')}</h2>
            <p>{t('settings.taxInfo.dayOrders.count', { count: orders.length })}</p>
          </div>
          <button
            className="taxDayOrdersModal-close"
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <SvgIcon name="clear" />
          </button>
        </header>

        {orders.length ? (
          <div className="taxDayOrdersModal-list">
            {orders.map(order => {
              const details = getTaxOrderDisplayData(order);
              const paymentIcon = getPaymentIcon(details.paymentMethod);
              const paymentLabel = getPaymentLabel(details.paymentMethod, t);
              const route = [details.from, details.to].filter(Boolean).join(' - ');

              return (
                <article className="taxDayOrdersModal-order" key={order.id || details.orderNumber}>
                  <div className="taxDayOrdersModal-orderTop">
                    <span className="taxDayOrdersModal-orderIcon" aria-hidden="true">
                      <SvgIcon name="file" />
                    </span>
                    <div className="taxDayOrdersModal-orderCopy">
                      <span>{details.customerName || t('common.noName')}</span>
                      <strong>{details.orderNumber || t('contract.orderNumber')}</strong>
                    </div>
                    <strong className="taxDayOrdersModal-amount">{details.amountLabel}</strong>
                  </div>

                  <div className="taxDayOrdersModal-orderMeta">
                    <span>
                      <SvgIcon name="clock" />
                      {formatTime(details.orderDate, language)}
                    </span>
                    <span>
                      <SvgIcon name={paymentIcon} />
                      {t('settings.taxInfo.dayOrders.paymentType', { value: paymentLabel })}
                    </span>
                  </div>

                  {route ? (
                    <div className="taxDayOrdersModal-route">
                      <SvgIcon name="route" />
                      <span>{route}</span>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="taxDayOrdersModal-empty">
            <span className="taxDayOrdersModal-emptyIcon" aria-hidden="true">
              <SvgIcon name="calendar" />
            </span>
            <h3>{t('settings.taxInfo.dayOrders.emptyTitle')}</h3>
            <p>{t('settings.taxInfo.dayOrders.emptyCopy')}</p>
          </div>
        )}
      </section>
    </div>
  );
}
