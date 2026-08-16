import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { useGetOrdersQuery } from '../../features/orders/ordersApi.js';
import { downloadFile } from '../../features/contract/utils/downloadFile.js';
import { getTaxInfoMonthLabel } from '../TaxInfoPage/components/TaxInfoMonthSelector/TaxInfoMonthSelector.jsx';
import {
  buildTaxMonthData,
  formatEuro,
  getMonthKey,
  getMonthOrderQuery,
  parseMonthKey,
} from '../TaxInfoPage/taxInfoData.js';
import { downloadTaxReportFile } from '../TaxInfoPage/taxReportDownload.js';
import './TaxInfoFilePage.css';

const REPORT_TYPES = {
  accountant: {
    icon: 'luggage',
    tone: 'blue',
    items: [
      { icon: 'user', id: 'business', tone: 'blue' },
      { icon: 'wallet', id: 'income', tone: 'green' },
      { icon: 'percent', id: 'commissions', tone: 'orange' },
      { icon: 'file', id: 'totals', tone: 'purple' },
    ],
  },
  excel: {
    icon: 'excel',
    tone: 'green',
    items: [
      { icon: 'excel', id: 'orders', tone: 'green' },
      { icon: 'calendar', id: 'dates', tone: 'blue' },
      { icon: 'wallet', id: 'payments', tone: 'orange' },
      { icon: 'route', id: 'routes', tone: 'purple' },
    ],
  },
  pdf: {
    icon: 'file',
    tone: 'red',
    items: [
      { icon: 'stats', id: 'summary', tone: 'green' },
      { icon: 'calendar', id: 'dailyIncome', tone: 'blue' },
      { icon: 'stats', id: 'statistics', tone: 'purple' },
      { icon: 'star', id: 'topDays', tone: 'orange' },
    ],
  },
};

const MIME_TYPES = {
  accountant: 'application/pdf',
  excel: 'application/vnd.ms-excel',
  pdf: 'application/pdf',
};

function getCurrentMonth() {
  const today = new Date();

  return new Date(today.getFullYear(), today.getMonth(), 1);
}

function makeShareFile(blob, fileName, reportType) {
  return new File([blob], fileName, {
    type: blob.type || MIME_TYPES[reportType] || 'application/octet-stream',
  });
}

export function TaxInfoFilePage({ reportType = 'pdf' }) {
  const { language, t } = useI18n();
  const [searchParams] = useSearchParams();
  const [activeAction, setActiveAction] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const normalizedType = REPORT_TYPES[reportType] ? reportType : 'pdf';
  const reportConfig = REPORT_TYPES[normalizedType];
  const reportMonth = useMemo(
    () => parseMonthKey(searchParams.get('month'), getCurrentMonth()),
    [searchParams],
  );
  const monthQuery = useMemo(() => getMonthOrderQuery(reportMonth), [reportMonth]);
  const { data, isError, isFetching, isLoading } = useGetOrdersQuery(monthQuery);
  const orders = Array.isArray(data?.orders) ? data.orders : [];
  const monthData = useMemo(() => buildTaxMonthData(orders, reportMonth), [orders, reportMonth]);
  const monthKey = getMonthKey(reportMonth);
  const monthLabel = getTaxInfoMonthLabel(language, reportMonth);
  const isBusy = Boolean(activeAction);
  const titleKey = `settings.taxInfo.actions.${normalizedType}.title`;
  const detailsKey = `settings.taxInfo.fileScreens.${normalizedType}`;

  async function createReportFile() {
    return downloadTaxReportFile({
      language,
      month: monthKey,
      type: normalizedType,
    });
  }

  async function handleDownload() {
    if (isBusy) {
      return;
    }

    setActiveAction('download');
    setError('');
    setNotice('');

    try {
      const result = await createReportFile();
      downloadFile(result.blob, result.fileName);
    } catch {
      setError(t('settings.taxInfo.downloadFailed'));
    } finally {
      setActiveAction('');
    }
  }

  async function handleShare() {
    if (isBusy) {
      return;
    }

    setActiveAction('share');
    setError('');
    setNotice('');

    try {
      const result = await createReportFile();

      if (typeof File !== 'function' || !navigator.share) {
        downloadFile(result.blob, result.fileName);
        setNotice(t('settings.taxInfo.fileScreens.shareFallback'));
        return;
      }

      const file = makeShareFile(result.blob, result.fileName, normalizedType);
      const sharePayload = {
        files: [file],
        text: t(`${detailsKey}.shareText`, { month: monthLabel }),
        title: t(titleKey),
      };

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share(sharePayload);
      } else {
        downloadFile(result.blob, result.fileName);
        setNotice(t('settings.taxInfo.fileScreens.shareFallback'));
      }
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') {
        setError(t('settings.taxInfo.fileScreens.shareFailed'));
      }
    } finally {
      setActiveAction('');
    }
  }

  return (
    <section className="taxInfoFilePage pageStack">
      <header className="taxInfoFilePage-header">
        <BackButton to={`/settings/tax-info?month=${monthKey}`} />

        <div className="appTitleBlock">
          <h1>{t(titleKey)}</h1>
          <p>{t(`${detailsKey}.subtitle`, { month: monthLabel })}</p>
        </div>
      </header>

      {isLoading || isFetching ? (
        <RequestLoadingState className="taxInfoFilePage-state" label={t('common.loadingOrders')} />
      ) : null}
      {isError ? <p className="statusNote is-error">{t('common.failedOrder')}</p> : null}

      <section className={`taxInfoFileHero taxInfoFileHero--${reportConfig.tone}`}>
        <span className="taxInfoFileHero-icon" aria-hidden="true">
          <SvgIcon name={reportConfig.icon} />
        </span>
        <div>
          <strong>{t(`${detailsKey}.headline`)}</strong>
          <p>{t(`${detailsKey}.copy`)}</p>
        </div>
      </section>

      <section className="taxInfoFileStats" aria-label={t('settings.taxInfo.fileScreens.summaryTitle')}>
        <div className="taxInfoFileStat taxInfoFileStat--green">
          <span>{t('settings.taxInfo.metrics.earnings.title')}</span>
          <strong>{formatEuro(monthData.totalIncome)}</strong>
        </div>
        <div className="taxInfoFileStat taxInfoFileStat--blue">
          <span>{t('settings.taxInfo.metrics.orders.title')}</span>
          <strong>{monthData.totalOrders}</strong>
        </div>
        <div className="taxInfoFileStat taxInfoFileStat--purple">
          <span>{t('settings.taxInfo.fileScreens.activeDays')}</span>
          <strong>{monthData.activeDays}</strong>
        </div>
      </section>

      <section className="taxInfoFileDetails">
        <h2>{t('settings.taxInfo.fileScreens.detailsTitle')}</h2>
        <ul>
          {reportConfig.items.map(item => (
            <li key={item.id}>
              <span className={`taxInfoFileDetails-icon taxInfoFileDetails-icon--${item.tone}`} aria-hidden="true">
                <SvgIcon name={item.icon} />
              </span>
              <span>
                <strong>{t(`${detailsKey}.items.${item.id}.title`)}</strong>
                <small>{t(`${detailsKey}.items.${item.id}.copy`)}</small>
              </span>
            </li>
          ))}
        </ul>
        <p className="taxInfoFileMeta">
          <SvgIcon name="check-circle" />
          <span>{t(`${detailsKey}.meta`)}</span>
        </p>
      </section>

      <section className="taxInfoFileActions">
        <button
          className="taxInfoFileActions-primary"
          disabled={isBusy}
          type="button"
          onClick={handleDownload}
        >
          <SvgIcon name="download" />
          <span>
            {activeAction === 'download'
              ? t('common.downloading')
              : t(`${detailsKey}.downloadLabel`)}
          </span>
        </button>

        <button
          className="taxInfoFileActions-secondary"
          disabled={isBusy}
          type="button"
          onClick={handleShare}
        >
          <SvgIcon name="send" />
          <span>
            {activeAction === 'share'
              ? t('settings.taxInfo.fileScreens.sending')
              : t(`${detailsKey}.sendLabel`)}
          </span>
        </button>

        {error ? <p className="taxInfoFileActions-message is-error">{error}</p> : null}
        {notice ? <p className="taxInfoFileActions-message">{notice}</p> : null}
      </section>
    </section>
  );
}
