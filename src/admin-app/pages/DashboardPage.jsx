import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { PagesListScreen } from '../screens/PagesListScreen.jsx';

export function DashboardPage() {
  return (
    <AdminGuard>
      <AdminShell activePath="/admin">
        <PagesListScreen />
      </AdminShell>
    </AdminGuard>
  );
}
