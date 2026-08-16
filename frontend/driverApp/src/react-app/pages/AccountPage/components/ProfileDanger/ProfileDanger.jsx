import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { RequestLoader } from "@shared/app/components/RequestLoader/RequestLoader.jsx";
import { SvgIcon } from "@shared/app/components/SvgIcon/SvgIcon.jsx";
import { useI18n } from "@shared/app/i18n/useI18n.js";
import {
  useDeleteMeMutation,
  useLogoutMutation,
} from "@shared/features/auth/authApi.js";
import { clearSession } from "@shared/features/auth/authSlice.js";
import { clearSession as clearStoredSession } from "@shared/features/auth/authStorage.js";
import { clearContractDraft } from "../../../../features/contract/contractStorage.js";
import { clearGenerationSession } from "../../../../features/contract/generationSessionStorage.js";
import "./ProfileDanger.css";

export function ProfileDanger({ showHeader = true, bare = false }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const [deleteMe, { isLoading: isDeleting }] = useDeleteMeMutation();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isDeleteModalOpen) {
      return undefined;
    }

    const body = document.body;
    body.classList.add('no-scroll');

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isDeleting) {
        setIsDeleteModalOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      body.classList.remove('no-scroll');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDeleteModalOpen, isDeleting]);

  async function handleLogout() {
    // Спочатку намагаємося вийти, а потім чистимо локальну сесію.
    try {
      await logout().unwrap();
    } catch {
      // Помилку виходу не показуємо.
    }

    clearStoredSession();
    clearContractDraft();
    clearGenerationSession();
    dispatch(clearSession());
    navigate('/', { replace: true });
    setMessage(t('common.backToHome'));
  }

  async function confirmDelete() {
    setMessage("");
    setError("");

    try {
      await deleteMe().unwrap();
      setIsDeleteModalOpen(false);
      clearStoredSession();
      clearContractDraft();
      clearGenerationSession();
      dispatch(clearSession());
      navigate('/', { replace: true });
      setMessage(t('account.notLoggedIn'));
    } catch {
      setError(t('common.failed'));
    }
  }

  function openDeleteModal() {
    setMessage("");
    setError("");
    setIsDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    if (!isDeleting) {
      setIsDeleteModalOpen(false);
    }
  }

  return (
    <section className={` profileDanger${bare ? " profileDanger--bare" : ""}`}>
      {showHeader ? (
        <div className="compactHeader">
          <h2>{t('account.session')}</h2>
          <p>{t('account.sessionCopy')}</p>
        </div>
      ) : null}

      <div className="profileDanger-actions">
        <button
          className="profileDanger-button"
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? <RequestLoader inline size="sm" label={t('common.loading')} /> : t('account.logout')}
        </button>

        <button
          className="profileDanger-button profileDanger-button--danger"
          type="button"
          onClick={openDeleteModal}
          disabled={isDeleting}
        >
          {isDeleting ? <RequestLoader inline size="sm" label={t('common.deleting')} /> : t('account.deleteAccount')}
        </button>
      </div>

      {message ? <p className="profileDanger-message">{message}</p> : null}
      {error ? <p className="profileDanger-error">{error}</p> : null}

      {isDeleteModalOpen ? (
        <div className="profileDangerModal" role="presentation" onClick={closeDeleteModal}>
          <div className="profileDangerModal-backdrop" aria-hidden="true" />
          <div
            className="profileDangerModal-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profileDangerDeleteTitle"
            aria-describedby="profileDangerDeleteCopy"
            onClick={event => event.stopPropagation()}
          >
            <button
              className="profileDangerModal-close"
              type="button"
              onClick={closeDeleteModal}
              disabled={isDeleting}
              aria-label={t('account.cancelDeleteAccount')}
            >
              x
            </button>

            <div className="profileDangerModal-iconWrap" aria-hidden="true">
              <div className="profileDangerModal-icon">
                <SvgIcon name="trash" />
              </div>
              <span className="profileDangerModal-iconMark">x</span>
            </div>

            <div className="profileDangerModal-copy">
              <p className="profileDangerModal-eyebrow">{t('account.deleteWarningEyebrow')}</p>
              <h3 id="profileDangerDeleteTitle">{t('account.deleteWarningTitle')}</h3>
              <p id="profileDangerDeleteCopy">{t('account.deleteWarningCopy')}</p>
              <p>{t('account.deleteWarningFraudCopy')}</p>
            </div>

            <div className="profileDangerModal-actions">
              <button
                className="profileDangerModal-button profileDangerModal-button--danger"
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <RequestLoader inline size="sm" label={t('common.deleting')} />
                ) : (
                  t('account.confirmDeleteAccount')
                )}
              </button>
              <button
                className="profileDangerModal-button"
                type="button"
                onClick={closeDeleteModal}
                disabled={isDeleting}
              >
                {t('account.cancelDeleteAccount')}
              </button>
            </div>

            {error ? <p className="profileDangerModal-error">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
