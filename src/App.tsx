import React from 'react';
import { AppProvider, useApp } from './context/AppContext.js';
import { ToastProvider } from './components/Toast.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar } from './components/Sidebar.js';
import { CookieBanner } from './components/CookieBanner.js';
import { GlobalSearchModal } from './components/GlobalSearchModal.js';
import { LandingPage } from './pages/LandingPage.js';
import { DashboardOverview } from './pages/DashboardOverview.js';
import { CommandCenter } from './pages/CommandCenter.js';
import { AgentsPage } from './pages/AgentsPage.js';
import { WorkflowsPage } from './pages/WorkflowsPage.js';
import { ApprovalsPage } from './pages/ApprovalsPage.js';
import { EmployeesPage } from './pages/EmployeesPage.js';
import { ItPage } from './pages/ItPage.js';
import { FinancePage } from './pages/FinancePage.js';
import { CommunicationsPage } from './pages/CommunicationsPage.js';
import { AuditLogsPage } from './pages/AuditLogsPage.js';
import { AnalyticsPage } from './pages/AnalyticsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { SignInPage, SignUpPage } from './pages/AuthPages.js';

function MainContent() {
  const { currentPage } = useApp();

  if (currentPage === 'landing') {
    return <LandingPage />;
  }

  if (currentPage === 'signin') {
    return <SignInPage />;
  }

  if (currentPage === 'signup') {
    return <SignUpPage />;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
        {currentPage === 'dashboard' && <DashboardOverview />}
        {currentPage === 'command-center' && <CommandCenter />}
        {currentPage === 'agents' && <AgentsPage />}
        {currentPage === 'workflows' && <WorkflowsPage />}
        {currentPage === 'approvals' && <ApprovalsPage />}
        {currentPage === 'employees' && <EmployeesPage />}
        {currentPage === 'it' && <ItPage />}
        {currentPage === 'finance' && <FinancePage />}
        {currentPage === 'communications' && <CommunicationsPage />}
        {currentPage === 'audit' && <AuditLogsPage />}
        {currentPage === 'analytics' && <AnalyticsPage />}
        {currentPage === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
          <Navbar />
          <MainContent />
          <CookieBanner />
          <GlobalSearchModal />
        </div>
      </AppProvider>
    </ToastProvider>
  );
}
