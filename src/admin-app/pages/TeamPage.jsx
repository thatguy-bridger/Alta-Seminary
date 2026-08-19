import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { TeamScreen } from '../screens/TeamScreen.jsx';

// One composed component per admin route, mounted with a single client:only
// island in its .astro page — avoids relying on Astro's cross-island slotting
// for what's really just one React tree (Guard > Shell > Screen).
export function TeamPage() {
  return (
    <AdminGuard>
      <AdminShell activePath="/admin/team">
        <TeamScreen />
      </AdminShell>
    </AdminGuard>
  );
}
