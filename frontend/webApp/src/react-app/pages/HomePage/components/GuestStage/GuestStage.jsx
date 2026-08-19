import { useEffect, useState } from "react";

import { useI18n } from "@shared/app/i18n/useI18n.js";
import { LoginForm } from "@shared/features/auth/components/LoginForm/LoginForm.jsx";
import { RegisterForm } from "@shared/features/auth/components/RegisterForm/RegisterForm.jsx";
import { AuthModeSwitch } from "../AuthModeSwitch/AuthModeSwitch.jsx";
import "./GuestStage.css";

const LANGUAGE_OPTIONS = [
  { id: "uk", label: "UA", titleKey: "settings.languageCard.uk" },
  { id: "en", label: "EN", titleKey: "settings.languageCard.en" },
  { id: "cs", label: "CS", titleKey: "settings.languageCard.cs" },
];

export function GuestStage({ defaultMode = "login" }) {
  const [mode, setMode] = useState(() => defaultMode);
  const { language, setLanguage, t } = useI18n();

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  return (
    <section className="guestStage pageStack" data-auth-mode={mode}>
      <div className="guestIntro">
        <div className="guestIntroTopbar">
          <p className="sectionEyebrow">WorkTrack</p>
          <div className="guestLanguageSwitch" role="group" aria-label={t('settings.languageCard.label')}>
            {LANGUAGE_OPTIONS.map(option => {
              const isActive = language === option.id;

              return (
                <button
                  key={option.id}
                  className={`guestLanguageButton ${isActive ? 'is-active' : ''}`}
                  type="button"
                  title={t(option.titleKey)}
                  aria-pressed={isActive}
                  onClick={() => setLanguage(option.id)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <h1>{mode === 'register' ? 'Create your company workspace' : t('guest.titleLogin')}</h1>
        <p>
          {mode === 'register'
            ? 'Register as a manager and start with a dedicated company account.'
            : t('guest.textLogin')}
        </p>
      </div>

      <section className="guestAuth screenCard">
        <div className="compactHeader">
          <h2>{mode === 'register' ? 'Company registration' : t('guest.signInHeading')}</h2>
          <p>
            {mode === 'register'
              ? 'The first account becomes the manager for this company.'
              : t('guest.signInCopy')}
          </p>
        </div>

        <AuthModeSwitch value={mode} onChange={setMode} />

        <div className="guestAuthForms">
          {mode === 'register' ? <RegisterForm /> : <LoginForm />}
        </div>
      </section>
    </section>
  );
}
