import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { App } from '@shared/app/App.jsx';
import { ProtectedRoute } from '@shared/app/components/ProtectedRoute/ProtectedRoute.jsx';
import { RouterError } from '@shared/app/components/RouterError/RouterError.jsx';
import { SectionShell } from './components/SectionTabs/SectionShell.jsx';
import { ApprovalsPage } from './pages/ApprovalsPage/ApprovalsPage.jsx';
import './pages/ApprovalsPage/ApprovalsMobile.css';
import { CalendarPage } from './pages/CalendarPage/CalendarPage.jsx';
import { CompanySettingsPage } from './pages/CompanySettingsPage/CompanySettingsPage.jsx';
import { DashboardPage } from './pages/DashboardPage/DashboardPage.jsx';
import { EmployeesPage } from './pages/EmployeesPage/EmployeesPage.jsx';
import { FastHoursPage } from './pages/FastHoursPage/FastHoursPage.jsx';
import { HomePage } from './pages/HomePage/HomePage.jsx';
import { HoursTablePage } from './pages/HoursTablePage/HoursTablePage.jsx';
import { InvoiceDocumentPage } from './pages/InvoiceDocumentPage/InvoiceDocumentPage.jsx';
import { InvoicesPage } from './pages/InvoicesPage/InvoicesPage.jsx';
import { ManagerAdvancesPage } from './pages/ManagerAdvancesPage/ManagerAdvancesPage.jsx';
import { ManagerInvoicesPage } from './pages/ManagerInvoicesPage/ManagerInvoicesPage.jsx';
import { ManagerTimesheetPage } from './pages/ManagerTimesheetPage/ManagerTimesheetPage.jsx';
import { MoreHubPage } from './pages/MoreHubPage/MoreHubPage.jsx';
import { NotificationsPage } from './pages/NotificationsPage/NotificationsPage.jsx';
import { PayrollReportPage } from './pages/PayrollReportPage/PayrollReportPage.jsx';
import './pages/PayrollReportPage/ManagerPayrollMobile.css';
import { ProfilePage } from './pages/ProfilePage/ProfilePage.jsx';
import { ProjectsPage } from './pages/ProjectsPage/ProjectsPage.jsx';
import { SignInPage } from './pages/SignInPage/SignInPage.jsx';
import { TaxInformationPage } from './pages/TaxInformationPage/TaxInformationPage.jsx';

export const router = createBrowserRouter([
  {
    element: <App />,
    errorElement: <RouterError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'sign-in', element: <SignInPage /> },
      { path: 'register', element: <SignInPage defaultMode="register" /> },
      { path: 'dashboard', element: <ProtectedRoute><DashboardPage /></ProtectedRoute> },
      {
        element: <ProtectedRoute requireEmployee><SectionShell section="time" /></ProtectedRoute>,
        children: [
          { path: 'hours', element: <FastHoursPage /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'hours-table', element: <HoursTablePage /> },
        ],
      },
      { path: 'hours-advanced', element: <ProtectedRoute requireEmployee><Navigate to="/hours" replace /></ProtectedRoute> },
      {
        element: <ProtectedRoute><SectionShell section="finance" /></ProtectedRoute>,
        children: [
          { path: 'payroll-report', element: <PayrollReportPage /> },
          { path: 'finance', element: <Navigate to="/payroll-report" replace /> },
          { path: 'invoices', element: <ProtectedRoute requireEmployee><InvoicesPage /></ProtectedRoute> },
          { path: 'tax-information', element: <ProtectedRoute requireEmployee><TaxInformationPage /></ProtectedRoute> },
          { path: 'manager/advances', element: <ProtectedRoute requireManager><ManagerAdvancesPage /></ProtectedRoute> },
          { path: 'manager/invoices', element: <ProtectedRoute requireManager><ManagerInvoicesPage /></ProtectedRoute> },
        ],
      },
      { path: 'invoices/:invoiceId', element: <ProtectedRoute requireEmployee><InvoiceDocumentPage /></ProtectedRoute> },
      { path: 'manager/invoices/:invoiceId', element: <ProtectedRoute requireManager><InvoiceDocumentPage managerMode /></ProtectedRoute> },
      {
        element: <ProtectedRoute requireManager><SectionShell section="team" /></ProtectedRoute>,
        children: [
          { path: 'employees', element: <EmployeesPage /> },
          { path: 'projects', element: <ProjectsPage /> },
        ],
      },
      {
        element: <ProtectedRoute requireManager><SectionShell section="time" /></ProtectedRoute>,
        children: [
          { path: 'manager/timesheet', element: <ManagerTimesheetPage /> },
          { path: 'approvals', element: <ApprovalsPage /> },
        ],
      },
      { path: 'company-settings', element: <ProtectedRoute requireManager><CompanySettingsPage /></ProtectedRoute> },
      { path: 'more', element: <ProtectedRoute requireManager><MoreHubPage /></ProtectedRoute> },
      { path: 'notifications', element: <ProtectedRoute><NotificationsPage /></ProtectedRoute> },
      { path: 'profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
      { path: '*', element: <Navigate to='/' replace /> },
    ],
  },
]);
