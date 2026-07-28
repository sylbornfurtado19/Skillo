'use client';

import AppLayout from '../../src/layouts/AppLayout';
import ProtectedRoute from '../../src/components/common/ProtectedRoute';

export default function ApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <AppLayout>
        {children}
      </AppLayout>
    </ProtectedRoute>
  );
}
