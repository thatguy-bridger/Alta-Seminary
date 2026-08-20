import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { DiagnosticsScreen } from '../screens/DiagnosticsScreen.jsx';

export function DiagnosticsPage() {
  return (
    <AdminGuard>
      <AdminShell activePath="/admin/diagnostics">
        <DiagnosticsScreen />
      </AdminShell>
    </AdminGuard>
  );
}
