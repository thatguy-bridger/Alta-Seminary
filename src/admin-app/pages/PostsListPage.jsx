import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { PostsListScreen } from '../screens/PostsListScreen.jsx';

export function PostsListPage() {
  return (
    <AdminGuard>
      <AdminShell activePath="/admin/posts">
        <PostsListScreen />
      </AdminShell>
    </AdminGuard>
  );
}
