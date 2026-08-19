import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { DirectoryScreen } from '../screens/DirectoryScreen.jsx';

export function DirectoryPage() {
  return (
    <AdminGuard>
      <AdminShell activePath="/admin/directory">
        <DirectoryScreen />
      </AdminShell>
    </AdminGuard>
  );
}
