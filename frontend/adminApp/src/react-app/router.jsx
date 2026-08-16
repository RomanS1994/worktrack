import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ProtectedRoute } from '@shared/app/components/ProtectedRoute/ProtectedRoute.jsx';
import { RouterError } from '@shared/app/components/RouterError/RouterError.jsx';
import { App } from './app/App.jsx';
import { AdminAccountsPage } from './pages/AdminAccountsPage/AdminAccountsPage.jsx';
import { AdminAccountDetailsPage } from './pages/AdminAccountDetailsPage/AdminAccountDetailsPage.jsx';
import { AdminAuditPage } from './pages/AdminAuditPage/AdminAuditPage.jsx';
import { AdminLanguagePage } from './pages/AdminLanguagePage/AdminLanguagePage.jsx';
import { AdminOrderDetailsPage } from './pages/AdminOrderDetailsPage/AdminOrderDetailsPage.jsx';
import { AdminOrdersPage } from './pages/AdminOrdersPage/AdminOrdersPage.jsx';
import { AdminUserOrdersPage } from './pages/AdminUserOrdersPage/AdminUserOrdersPage.jsx';
import { AdminPage } from './pages/AdminPage/AdminPage.jsx';
import { AdminSettingsPage } from './pages/AdminSettingsPage/AdminSettingsPage.jsx';
import { SignInPage } from './pages/SignInPage/SignInPage.jsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to='/admin' replace />,
  },
  {
    element: <App />,
    errorElement: <RouterError />,
    children: [
      {
        path: '/sign-in',
        element: <SignInPage />,
      },
      {
        path: '/admin',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/accounts',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminAccountsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/accounts/:userId',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminAccountDetailsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/orders',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminOrdersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/orders/users/:userId',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminUserOrdersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/orders/view/:orderId',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminOrderDetailsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/orders/:orderId',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminOrderDetailsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/settings',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminSettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/settings/language',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminLanguagePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/settings/audit',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminAuditPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '*',
        element: <Navigate to='/admin' replace />,
      },
    ],
  },
]);
