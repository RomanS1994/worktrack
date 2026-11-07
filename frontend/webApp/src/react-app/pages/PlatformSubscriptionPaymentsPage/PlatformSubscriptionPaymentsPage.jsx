import { useState } from 'react';
import { useSelector } from 'react-redux';

import { getApiErrorMessage } from '@shared/app/api/getApiErrorMessage.js';
import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { selectUser } from '@shared/features/auth/authSlice.js';
import {
  useConfirmPlatformSubscriptionPaymentMutation,
  useGetPlatformSubscriptionPaymentsQuery,
  useRejectPlatformSubscriptionPaymentMutation,
} from '../../features/worktrack/platformSubscriptionApi.js';
import './PlatformSubscriptionPaymentsPage.css';

const COPY = {
  uk: { title:'Платежі WorkTrack', intro:'Перевіряй банківські надходження й підтверджуй оплату підписок компаній.', pending:'Очікують перевірки', paid:'Оплачено', empty:'Немає платежів, які очікують перевірки.', company:'Компанія', plan:'Тариф', amount:'Сума', period:'Період', due:'Строк оплати', variable:'Варіабельний символ', contact:'Контакт керівника', confirm:'Підтвердити оплату', reject:'Відхилити', processing:'Збереження…', access:'Ця сторінка доступна лише адміністратору WorkTrack.', error:'Не вдалося завантажити платежі.', unknown:'Невідомий', statusReview:'Очікує перевірки', statusPaid:'Оплачено', statusPending:'Очікує оплати', statusRejected:'Відхилено', statusOverdue:'Прострочено' },
  cs: { title:'Platby WorkTrack', intro:'Ověř příchozí bankovní platby a potvrď předplatné společností.', pending:'Čeká na kontrolu', paid:'Zaplaceno', empty:'Žádné platby nečekají na kontrolu.', company:'Společnost', plan:'Tarif', amount:'Částka', period:'Období', due:'Splatnost', variable:'Variabilní symbol', contact:'Kontakt na manažera', confirm:'Potvrdit platbu', reject:'Odmítnout', processing:'Ukládání…', access:'Tato stránka je dostupná pouze administrátorovi WorkTrack.', error:'Platby se nepodařilo načíst.', unknown:'Neznámý', statusReview:'Čeká na kontrolu', statusPaid:'Zaplaceno', statusPending:'Čeká na platbu', statusRejected:'Odmítnuto', statusOverdue:'Po splatnosti' },
  en: { title:'WorkTrack payments', intro:'Review bank transfers and confirm company subscription payments.', pending:'Awaiting review', paid:'Paid', empty:'No payments are waiting for review.', company:'Company', plan:'Plan', amount:'Amount', period:'Period', due:'Due date', variable:'Variable symbol', contact:'Manager contact', confirm:'Confirm payment', reject:'Reject', processing:'Saving…', access:'This page is available to WorkTrack administrators only.', error:'Could not load payments.', unknown:'Unknown', statusReview:'Awaiting review', statusPaid:'Paid', statusPending:'Awaiting payment', statusRejected:'Rejected', statusOverdue:'Overdue' },
};

function date(value, language) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat(language === 'cs' ? 'cs-CZ' : language === 'en' ? 'en-GB' : 'uk-UA', { day:'numeric', month:'short', year:'numeric' }).format(parsed);
}

function amount(value) {
  return `${new Intl.NumberFormat('cs-CZ').format(Number(value || 0))} Kč`;
}

function statusLabel(status, copy) {
  const map = { REVIEW_REQUESTED:copy.statusReview, PAID:copy.statusPaid, PENDING:copy.statusPending, REJECTED:copy.statusRejected, OVERDUE:copy.statusOverdue };
  return map[status] || status || copy.unknown;
}

export function PlatformSubscriptionPaymentsPage({ embedded = false }) {
  const user = useSelector(selectUser);
  const { language } = useI18n();
  const copy = COPY[language] || COPY.uk;
  const [actionError, setActionError] = useState('');
  const { data, error, isLoading, isFetching, refetch } = useGetPlatformSubscriptionPaymentsQuery();
  const [confirmPayment, confirmState] = useConfirmPlatformSubscriptionPaymentMutation();
  const [rejectPayment, rejectState] = useRejectPlatformSubscriptionPaymentMutation();
  const isAdmin = Boolean(user?.isPlatformSubscriptionAdmin);
  const payments = Array.isArray(data?.payments) ? data.payments : [];
  const reviewPayments = payments.filter(payment => payment.status === 'REVIEW_REQUESTED');

  async function act(payment, action) {
    setActionError('');
    try {
      if (action === 'confirm') await confirmPayment(payment.id).unwrap();
      else await rejectPayment(payment.id).unwrap();
      await refetch();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError));
    }
  }

  return <section className="platformPaymentsPage pageStack">
    {!embedded ? <header className="platformPaymentsHeader appTop"><BackButton to="/platform/admin" /><div className="appTitleBlock"><p className="sectionEyebrow">WorkTrack</p><h1>{copy.title}</h1><p>{copy.intro}</p></div></header> : null}
    {!isAdmin ? <section className="platformPaymentsNotice screenCard" role="alert">{copy.access}</section> : null}
    {isAdmin && (isLoading || isFetching) ? <RequestLoadingState label={copy.pending} /> : null}
    {isAdmin && error ? <section className="platformPaymentsNotice is-error screenCard" role="alert">{getApiErrorMessage(error) || copy.error}</section> : null}
    {isAdmin && actionError ? <section className="platformPaymentsNotice is-error screenCard" role="alert">{actionError}</section> : null}
    {isAdmin && !isLoading && !error ? <>
      <div className="platformPaymentsSummary"><article className="platformPaymentsSummaryCard"><span>{copy.pending}</span><strong>{reviewPayments.length}</strong></article><article className="platformPaymentsSummaryCard"><span>{copy.paid}</span><strong>{payments.filter(payment => payment.status === 'PAID').length}</strong></article></div>
      {payments.length ? <div className="platformPaymentsList">{payments.map(payment => {
        const isBusy = confirmState.isLoading || rejectState.isLoading;
        return <article className="platformPaymentCard screenCard" key={payment.id}>
          <div className="platformPaymentHeading"><div><small>{copy.company}</small><h2>{payment.company?.name || copy.unknown}</h2></div><span className={`platformPaymentStatus status-${String(payment.status || '').toLowerCase()}`}>{statusLabel(payment.status, copy)}</span></div>
          <div className="platformPaymentDetails">
            <div><small>{copy.plan}</small><strong>{payment.planCode || '—'}</strong></div>
            <div><small>{copy.amount}</small><strong>{amount(payment.amountCzk)}</strong></div>
            <div><small>{copy.period}</small><strong>{date(payment.periodStart, language)} – {date(payment.periodEnd, language)}</strong></div>
            <div><small>{copy.due}</small><strong>{date(payment.dueAt, language)}</strong></div>
            <div><small>{copy.variable}</small><strong className="platformPaymentVS">{payment.variableSymbol || '—'}</strong></div>
            <div><small>{copy.contact}</small><strong>{payment.managerName || payment.managerEmail || '—'}{payment.managerName && payment.managerEmail ? <small>{payment.managerEmail}</small> : null}</strong></div>
          </div>
          {payment.status === 'REVIEW_REQUESTED' ? <div className="platformPaymentActions"><button type="button" className="platformPaymentConfirm" disabled={isBusy} onClick={() => act(payment, 'confirm')}>{isBusy ? copy.processing : copy.confirm}</button><button type="button" className="platformPaymentReject" disabled={isBusy} onClick={() => act(payment, 'reject')}>{copy.reject}</button></div> : null}
        </article>;
      })}</div> : <section className="platformPaymentsNotice screenCard">{copy.empty}</section>}
    </> : null}
  </section>;
}
