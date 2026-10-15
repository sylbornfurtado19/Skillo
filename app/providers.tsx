'use client';

import React from 'react';
import { MotionConfig } from 'framer-motion';
import { AuthProvider } from '../src/context/AuthContext';
import { InterviewProvider } from '../src/context/InterviewContext';
import { ToastProvider } from '../src/components/ui/Toast';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <InterviewProvider>
          <ToastProvider>{children}</ToastProvider>
        </InterviewProvider>
      </AuthProvider>
    </MotionConfig>
  );
}

