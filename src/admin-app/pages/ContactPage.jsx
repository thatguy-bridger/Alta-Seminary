import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { ContactInboxScreen } from '../screens/ContactInboxScreen.jsx';

export function ContactPage() {
  return (
    <AdminGuard>
      <AdminShell activePath="/admin/contact">
        <ContactInboxScreen />
      </AdminShell>
    </AdminGuard>
  );
}
