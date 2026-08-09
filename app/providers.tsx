'use client';

import React from 'react';
import { AuthProvider } from '../src/context/AuthContext';
import { InterviewProvider } from '../src/context/InterviewContext';
import { ToastProvider } from '../src/components/ui/Toast';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <InterviewProvider>
        <ToastProvider>{children}</ToastProvider>
      </InterviewProvider>
    </AuthProvider>
  );
}
