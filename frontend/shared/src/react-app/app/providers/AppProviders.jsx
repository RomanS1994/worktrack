import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";
import React from "react";
import { I18nBootstrap } from "../i18n/I18nBootstrap.jsx";
import { SvgSpriteDefs } from "../components/SvgIcon/SvgSpriteDefs.jsx";
import { useAuthSession } from "../../features/auth/useAuthSession.js";

import "../theme.css";
import "./AppProviders.css";

function AuthSessionBootstrap() {
  useAuthSession();
  return null;
}

export function AppProviders({ router, store }) {
  return (
    <div className="reactAppProviders">
      <Provider store={store}>
        <SvgSpriteDefs />
        <AuthSessionBootstrap />
        <I18nBootstrap />
        <RouterProvider router={router} />
      </Provider>
    </div>
  );
}
