import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { HistoryScreen } from '../screens/HistoryScreen.jsx';

export function HistoryPage() {
  return (
    <AdminGuard>
      <AdminShell activePath="/admin/history">
        <HistoryScreen />
      </AdminShell>
    </AdminGuard>
  );
}
