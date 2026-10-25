import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { MakeupTestScreen } from '../screens/MakeupTestScreen.jsx';

export function MakeupTestPage() {
  return (
    <AdminGuard>
      <AdminShell activePath="/admin/makeup-work">
        <MakeupTestScreen />
      </AdminShell>
    </AdminGuard>
  );
}
