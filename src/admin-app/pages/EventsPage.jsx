import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { EventsScreen } from '../screens/EventsScreen.jsx';

export function EventsPage() {
  return (
    <AdminGuard>
      <AdminShell activePath="/admin/events">
        <EventsScreen />
      </AdminShell>
    </AdminGuard>
  );
}
