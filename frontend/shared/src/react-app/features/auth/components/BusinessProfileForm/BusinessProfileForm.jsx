import { RequestLoader } from '../../../../app/components/RequestLoader/RequestLoader.jsx';
import { useBusinessProfileForm } from './useBusinessProfileForm.js';
import { PhoneNumberCard } from './PhoneNumberCard.jsx';
import './BusinessProfileForm.css';

export function BusinessProfileForm() {
  const {
    error,
    form,
    handleSubmit,
    isLoading,
    message,
    t,
    updateField,
  } = useBusinessProfileForm();

  return (
    <form className="businessProfileForm" onSubmit={handleSubmit}>
      <div className="businessProfileForm-sections">
        <PhoneNumberCard t={t} />

        <section className="businessProfileForm-card businessProfileForm-card--driver">
          <h3 className="businessProfileForm-subtitle">{t('auth.driverLabel')}</h3>

          <label className="businessProfileForm-field">
            <span>{t('auth.name')}</span>
            <input
              type="text"
              placeholder={`Введіть ${t('auth.name').toLowerCase()} *`}
              value={form.driverName}
              onChange={event => updateField('driverName', event.target.value)}
            />
          </label>

          <label className="businessProfileForm-field">
            <span>{t('auth.address')}</span>
            <input
              type="text"
              placeholder={`Введіть ${t('auth.address').toLowerCase()} *`}
              value={form.driverAddress}
              onChange={event => updateField('driverAddress', event.target.value)}
            />
          </label>

          <label className="businessProfileForm-field">
            <span>{t('auth.spz')}</span>
            <input
              type="text"
              placeholder={`Введіть ${t('auth.spz').toLowerCase()} *`}
              value={form.driverSpz}
              onChange={event => updateField('driverSpz', event.target.value)}
            />
          </label>

          <label className="businessProfileForm-field">
            <span>{t('auth.ico')}</span>
            <input
              type="text"
              placeholder={`Введіть ${t('auth.ico').toLowerCase()} *`}
              value={form.driverIco}
              onChange={event => updateField('driverIco', event.target.value)}
            />
          </label>
        </section>

      </div>

      {message ? <p className="businessProfileForm-message">{message}</p> : null}
      {error ? <p className="businessProfileForm-error">{error}</p> : null}

      <button className="businessProfileForm-button" type="submit" disabled={isLoading}>
        {isLoading ? (
          <RequestLoader inline size="sm" label={t('auth.savingProfile')} />
        ) : (
          t('auth.saveBusinessProfile')
        )}
      </button>
    </form>
  );
}
