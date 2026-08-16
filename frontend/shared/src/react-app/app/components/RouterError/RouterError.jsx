import React from "react";

import { Link, useRouteError } from "react-router-dom";
import { useI18n } from "../../i18n/useI18n.js";

import "./RouterError.css";

export function RouterError() {
  const error = useRouteError();
  const { t } = useI18n();
  const message =
    error instanceof Error ? error.message : t('common.failed');

  return (
    <section className="routerError">
      <h1 className="routerError-title">{t('common.failed')}</h1>
      <p className="routerError-message">{message}</p>
      <Link className="routerError-link" to="/">
        {t('common.backToHome')}
      </Link>
    </section>
  );
}
