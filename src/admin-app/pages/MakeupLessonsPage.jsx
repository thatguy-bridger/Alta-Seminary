import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { LessonsScreen } from '../screens/lessons/LessonsScreen.jsx';

export function MakeupLessonsPage() {
  return (
    <AdminGuard>
      <AdminShell activePath="/admin/makeup-work">
        <LessonsScreen />
      </AdminShell>
    </AdminGuard>
  );
}
