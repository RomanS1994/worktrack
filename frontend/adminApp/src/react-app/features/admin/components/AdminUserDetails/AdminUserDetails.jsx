import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { RequestLoader, RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import { formatDateTime } from '@shared/app/utils/dateFormat.js';
import { selectToken, selectUser, setSession } from '@shared/features/auth/authSlice.js';
import { saveSession } from '@shared/features/auth/authStorage.js';
import {
  useGetAdminPlansQuery,
  useGetAdminUserQuery,
  useConfirmUserSubscriptionPaymentMutation,
  useExtendUserSubscriptionMutation,
  useUpdateUserRoleMutation,
  useUpdateUserSubscriptionMutation,
} from '@shared/features/admin/adminApi.js';
import './AdminUserDetails.css';

export function AdminUserDetails({ userId, user: userProp, showSummary = true, showMeta = true }) {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const currentUser = useSelector(selectUser);
  const token = useSelector(selectToken);
  const resolvedUserId = userProp?.id || userId;
  const { data, isLoading, isError } = useGetAdminUserQuery(resolvedUserId, {
    skip: !resolvedUserId || Boolean(userProp),
  });
  const {
    data: plansData,
    isLoading: isPlansLoading,
    isError: isPlansError,
  } = useGetAdminPlansQuery(undefined, {
    skip: !resolvedUserId,
  });
  const [updateUserRole, { isLoading: isSavingRole }] = useUpdateUserRoleMutation();
  const [updateUserSubscription, { isLoading: isSavingSubscription }] =
    useUpdateUserSubscriptionMutation();
  const [extendUserSubscription, { isLoading: isExtendingSubscription }] =
    useExtendUserSubscriptionMutation();
  const [confirmUserSubscriptionPayment, { isLoading: isConfirmingPayment }] =
    useConfirmUserSubscriptionPaymentMutation();
  const [roleValue, setRoleValue] = useState('user');
  const [statusValue, setStatusValue] = useState('active');
  const [planId, setPlanId] = useState('');
  const [extensionMonths, setExtensionMonths] = useState('1');
  const [roleMessage, setRoleMessage] = useState('');
  const [roleError, setRoleError] = useState('');
  const [subscriptionMessage, setSubscriptionMessage] = useState('');
  const [subscriptionError, setSubscriptionError] = useState('');
  const user = userProp || data?.user || data || {};
  const createdAt = formatDateTime(user.createdAt, 'uk');
  const periodStart = formatDateTime(user.subscription?.currentPeriodStart, 'uk');
  const periodEnd = formatDateTime(user.subscription?.currentPeriodEnd, 'uk');
  const plans = plansData?.plans || [];
  const firstPlanId = plans[0]?.id || '';
  const pendingPlanId = user.subscription?.pendingPlanId || '';
  const pendingPlan = plans.find(plan => plan.id === pendingPlanId);
  const canSaveRole = currentUser?.role === 'admin';

  function syncCurrentSession(nextUser) {
    if (!nextUser) {
      return;
    }

    if (!currentUser?.id) {
      return;
    }

    if (nextUser.id !== currentUser.id) {
      return;
    }

    saveSession(token, nextUser);
    dispatch(
      setSession({
        token,
        user: nextUser,
      }),
    );
  }

  useEffect(() => {
    setRoleValue(user.role || 'user');
    setStatusValue(user.subscription?.status || 'active');

    if (user.planId) {
      setPlanId(user.planId);
      return;
    }

    if (firstPlanId) {
      setPlanId(firstPlanId);
      return;
    }

    setPlanId('');
  }, [user.id, user.role, user.planId, user.subscription?.status, firstPlanId]);

  useEffect(() => {
    setRoleMessage('');
    setRoleError('');
    setSubscriptionMessage('');
    setSubscriptionError('');
  }, [resolvedUserId]);

  if (!resolvedUserId) {
    return (
      <section className="adminUserDetails">
        <p className="adminUserDetails-state">{t('admin.selectUser')}</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="adminUserDetails">
        <RequestLoadingState className="adminUserDetails-state" label={t('admin.loadingUser')} />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="adminUserDetails">
        <p className="adminUserDetails-state">{t('admin.failedUser')}</p>
      </section>
    );
  }

  async function handleSaveRole() {
    setRoleMessage('');
    setRoleError('');

    try {
      const response = await updateUserRole({
        userId: resolvedUserId,
        role: roleValue,
      }).unwrap();
      syncCurrentSession(response?.user || response);
      setRoleMessage(t('admin.roleSaved'));
    } catch {
      setRoleError(t('admin.failedToSaveRole'));
    }
  }

  async function handleSaveSubscription() {
    setSubscriptionMessage('');
    setSubscriptionError('');

    try {
      const response = await updateUserSubscription({
        userId: resolvedUserId,
        payload: {
          planId,
          status: statusValue,
        },
      }).unwrap();
      syncCurrentSession(response?.user || response);
      setSubscriptionMessage(t('admin.subscriptionSaved'));
    } catch {
      setSubscriptionError(t('admin.failedToSaveSubscription'));
    }
  }

  async function handleExtendSubscription() {
    setSubscriptionMessage('');
    setSubscriptionError('');

    try {
      const response = await extendUserSubscription({
        userId: resolvedUserId,
        months: extensionMonths,
      }).unwrap();
      syncCurrentSession(response?.user || response);
      setSubscriptionMessage(t('admin.subscriptionExtended'));
    } catch {
      setSubscriptionError(t('admin.failedToExtendSubscription'));
    }
  }

  async function handleConfirmPayment() {
    setSubscriptionMessage('');
    setSubscriptionError('');

    try {
      const response = await confirmUserSubscriptionPayment({
        userId: resolvedUserId,
        payload: pendingPlanId ? { planId: pendingPlanId } : {},
      }).unwrap();
      syncCurrentSession(response?.user || response);
      setSubscriptionMessage(t('admin.subscriptionPaymentConfirmed'));
    } catch {
      setSubscriptionError(t('admin.failedToConfirmSubscriptionPayment'));
    }
  }

  return (
    <section className="adminUserDetails">
      {showSummary ? (
        <div className="adminUserDetails-summary">
          <strong className="adminUserDetails-summaryName">{user.name || '-'}</strong>
          <span className="adminUserDetails-summaryEmail">{user.email || '-'}</span>
          <span
            className={`adminUserDetails-summaryRole adminUserDetails-summaryRole--${user.role || 'unknown'}`}
          >
            {user.role || '-'}
          </span>
        </div>
      ) : null}

      {showMeta ? (
        <div className="adminUserDetails-grid">
          <div className="adminUserDetails-row">
            <span className="adminUserDetails-label">{t('admin.subscription')}</span>
            <span className="adminUserDetails-value">{user.subscription?.status || '-'}</span>
          </div>
          <div className="adminUserDetails-row">
            <span className="adminUserDetails-label">{t('common.plan')}</span>
            <span className="adminUserDetails-value">{user.plan?.name || '-'}</span>
          </div>
          <div className="adminUserDetails-row">
            <span className="adminUserDetails-label">{t('common.created')}</span>
            <span className="adminUserDetails-value">{createdAt}</span>
          </div>
        </div>
      ) : null}

      <details className="adminUserDetails-section">
        <summary className="adminUserDetails-sectionSummary">
          <span className="adminUserDetails-sectionTitle">{t('common.role')}</span>
          <span className="adminUserDetails-sectionChevron" aria-hidden="true" />
        </summary>
        <div className="adminUserDetails-sectionBody">
          <label className="adminUserDetails-field">
            <span className="adminUserDetails-label">{t('common.role')}</span>
            <select
              className="adminUserDetails-select"
              value={roleValue}
              onChange={event => setRoleValue(event.target.value)}
            >
              <option value="user">user</option>
              <option value="manager">manager</option>
              <option value="admin">admin</option>
            </select>
          </label>

          {!canSaveRole ? (
            <p className="adminUserDetails-note">{t('admin.onlyAdmins')}</p>
          ) : null}
          {roleMessage ? <p className="adminUserDetails-message">{roleMessage}</p> : null}
          {roleError ? <p className="adminUserDetails-error">{roleError}</p> : null}

          <button
            className="adminUserDetails-button"
            type="button"
            onClick={handleSaveRole}
            disabled={isSavingRole || !canSaveRole}
          >
            {isSavingRole ? (
              <RequestLoader inline size="sm" label={t('admin.savingRole')} />
            ) : (
              t('admin.saveRole')
            )}
          </button>
        </div>
      </details>

      <details className="adminUserDetails-section">
        <summary className="adminUserDetails-sectionSummary">
          <span className="adminUserDetails-sectionTitle">{t('admin.subscription')}</span>
          <span className="adminUserDetails-sectionChevron" aria-hidden="true" />
        </summary>
        <div className="adminUserDetails-sectionBody">
          <label className="adminUserDetails-field">
            <span className="adminUserDetails-label">{t('common.status')}</span>
            <select
              className="adminUserDetails-select"
              value={statusValue}
              onChange={event => setStatusValue(event.target.value)}
            >
              <option value="active">active</option>
              <option value="pending">pending</option>
              <option value="trial">trial</option>
              <option value="paused">paused</option>
              <option value="canceled">canceled</option>
              <option value="expired">expired</option>
            </select>
          </label>

          <label className="adminUserDetails-field">
            <span className="adminUserDetails-label">{t('common.plan')}</span>
            <select
              className="adminUserDetails-select"
              value={planId}
              onChange={event => setPlanId(event.target.value)}
              disabled={isPlansLoading || !plans.length}
            >
              {!plans.length ? <option value="">{t('common.noPlans')}</option> : null}
              {plans.map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>

          <div className="adminUserDetails-periodGrid">
            <div className="adminUserDetails-row">
              <span className="adminUserDetails-label">{t('admin.validFrom')}</span>
              <span className="adminUserDetails-value">{periodStart}</span>
            </div>
            <div className="adminUserDetails-row">
              <span className="adminUserDetails-label">{t('admin.validUntil')}</span>
              <span className="adminUserDetails-value">{periodEnd}</span>
            </div>
          </div>

          {pendingPlanId ? (
            <div className="adminUserDetails-pending">
              <span className="adminUserDetails-label">{t('admin.pendingUpgrade')}</span>
              <strong>{pendingPlan?.name || pendingPlanId}</strong>
              <p>{t('admin.pendingUpgradeCopy')}</p>
              <button
                className="adminUserDetails-button adminUserDetails-button--success"
                type="button"
                onClick={handleConfirmPayment}
                disabled={isConfirmingPayment}
              >
                {isConfirmingPayment ? (
                  <RequestLoader inline size="sm" label={t('admin.confirmingSubscriptionPayment')} />
                ) : (
                  t('admin.confirmSubscriptionPayment')
                )}
              </button>
            </div>
          ) : null}

          <div className="adminUserDetails-extend">
            <label className="adminUserDetails-field">
              <span className="adminUserDetails-label">{t('admin.extensionMonths')}</span>
              <select
                className="adminUserDetails-select"
                value={extensionMonths}
                onChange={event => setExtensionMonths(event.target.value)}
              >
                <option value="1">1</option>
                <option value="3">3</option>
                <option value="6">6</option>
                <option value="12">12</option>
              </select>
            </label>
            <button
              className="adminUserDetails-button"
              type="button"
              onClick={handleExtendSubscription}
              disabled={isExtendingSubscription}
            >
              {isExtendingSubscription ? (
                <RequestLoader inline size="sm" label={t('admin.extendingSubscription')} />
              ) : (
                t('admin.extendSubscription')
              )}
            </button>
          </div>

          {isPlansLoading ? (
            <RequestLoader className="adminUserDetails-note" inline size="sm" label={t('common.loadingPlans')} />
          ) : null}
          {isPlansError ? <p className="adminUserDetails-error">{t('admin.failedPlans')}</p> : null}
          {subscriptionMessage ? (
            <p className="adminUserDetails-message">{subscriptionMessage}</p>
          ) : null}
          {subscriptionError ? (
            <p className="adminUserDetails-error">{subscriptionError}</p>
          ) : null}

          <button
            className="adminUserDetails-button"
            type="button"
            onClick={handleSaveSubscription}
            disabled={isSavingSubscription || isPlansLoading || !planId}
          >
            {isSavingSubscription ? (
              <RequestLoader inline size="sm" label={t('admin.savingSubscription')} />
            ) : (
              t('admin.saveSubscription')
            )}
          </button>
        </div>
      </details>
    </section>
  );
}
