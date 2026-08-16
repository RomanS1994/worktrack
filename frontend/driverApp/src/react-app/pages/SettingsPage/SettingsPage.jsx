import { useSelector } from "react-redux";

import { hasAdminAccess, hasPlatinumTeamAccess } from "@shared/features/auth/authAccess.js";
import { selectUser } from "@shared/features/auth/authSlice.js";
import { ProfileDanger } from "../AccountPage/components/ProfileDanger/ProfileDanger.jsx";
import { SettingsAccountSummary } from "./components/SettingsAccountSummary/SettingsAccountSummary.jsx";
import { SettingsAdminAccess } from "./components/SettingsAdminAccess/SettingsAdminAccess.jsx";
import { SettingsBusinessProfileLink } from "./components/SettingsBusinessProfileLink/SettingsBusinessProfileLink.jsx";
import { SettingsLanguageLink } from "./components/SettingsLanguageLink/SettingsLanguageLink.jsx";
import { SettingsPlanUpgradeLink } from "./components/SettingsPlanUpgradeLink/SettingsPlanUpgradeLink.jsx";
import { SettingsProvidersLink } from "./components/SettingsProvidersLink/SettingsProvidersLink.jsx";
import { SettingsTaxInfoLink } from "./components/SettingsTaxInfoLink/SettingsTaxInfoLink.jsx";
import { SettingsTeamLink } from "./components/SettingsTeamLink/SettingsTeamLink.jsx";
import { useI18n } from "@shared/app/i18n/useI18n.js";
import "./SettingsPage.css";

export function SettingsPage() {
  const user = useSelector(selectUser);
  const canAdmin = hasAdminAccess(user);
  const canManageTeam = hasPlatinumTeamAccess(user);
  const { t } = useI18n();

  return (
    <section className="settingsPage pageStack">
      <SettingsAccountSummary user={user} />

      {canAdmin ? <SettingsAdminAccess /> : null}

      <SettingsLanguageLink />
      {canManageTeam ? <SettingsTeamLink /> : null}
      <SettingsBusinessProfileLink />
      <SettingsProvidersLink />
      <SettingsTaxInfoLink />
      <SettingsPlanUpgradeLink />

      <section className="screenCard settingsPage-card">
        <div className="compactHeader">
          <h2>{t('settings.session.title')}</h2>
          <p>{t('settings.session.subtitle')}</p>
        </div>

        <ProfileDanger showHeader={false} bare />
      </section>
    </section>
  );
}
