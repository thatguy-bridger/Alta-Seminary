import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { SiteChromeScreen } from '../screens/SiteChromeScreen.jsx';

export function SiteChromePage() {
  return (
    <AdminGuard>
      <AdminShell activePath="/admin/pages">
        <SiteChromeScreen />
      </AdminShell>
    </AdminGuard>
  );
}
