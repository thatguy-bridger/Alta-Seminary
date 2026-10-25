import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { MakeupWorkScreen } from '../screens/MakeupWorkScreen.jsx';

export function MakeupWorkPage() {
  return (
    <AdminGuard>
      <AdminShell activePath="/admin/makeup-work">
        <MakeupWorkScreen />
      </AdminShell>
    </AdminGuard>
  );
}
