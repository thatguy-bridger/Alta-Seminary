import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { GalleryScreen } from '../screens/GalleryScreen.jsx';

export function GalleryPage() {
  return (
    <AdminGuard>
      <AdminShell activePath="/admin/gallery">
        <GalleryScreen />
      </AdminShell>
    </AdminGuard>
  );
}
