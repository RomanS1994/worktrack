import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { App } from '@shared/app/App.jsx';
import { ProtectedRoute } from '@shared/app/components/ProtectedRoute/ProtectedRoute.jsx';
import { RouterError } from '@shared/app/components/RouterError/RouterError.jsx';
import { ApprovalsPage } from './pages/ApprovalsPage/ApprovalsPage.jsx';
import { DashboardPage } from './pages/DashboardPage/DashboardPage.jsx';
import { EmployeesPage } from './pages/EmployeesPage/EmployeesPage.jsx';
import { HomePage } from './pages/HomePage/HomePage.jsx';
import { HoursPage } from './pages/HoursPage/HoursPage.jsx';
import { ProfilePage } from './pages/ProfilePage/ProfilePage.jsx';
import { SignInPage } from './pages/SignInPage/SignInPage.jsx';

export const router = createBrowserRouter([
  {
    element: <App />,
    errorElement: <RouterError />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'sign-in',
        element: <SignInPage />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'hours',
        element: (
          <ProtectedRoute>
            <HoursPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'employees',
        element: (
          <ProtectedRoute requireManager>
            <EmployeesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'approvals',
        element: (
          <ProtectedRoute requireManager>
            <ApprovalsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '*',
        element: <Navigate to='/' replace />,
      },
    ],
  },
]);
