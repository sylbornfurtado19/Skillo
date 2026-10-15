'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LogoIcon } from '@/components/common/Logo';

export default function SessionGradingOverlay() {
  return (
    <div className="bg-bg-surface rounded-2xl p-10 border border-border shadow-soft flex flex-col items-center justify-center min-h-[420px] text-center max-w-xl mx-auto mt-16">
      <div className="relative mb-8">
        <motion.div
          animate={{
            scale: [0.95, 1.05, 0.95],
            filter: [
              'drop-shadow(0 0 10px rgba(155, 34, 24, 0.15))',
              'drop-shadow(0 0 25px rgba(155, 34, 24, 0.35))',
              'drop-shadow(0 0 10px rgba(155, 34, 24, 0.15))',
            ],
          }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        >
          <LogoIcon size={72} />
        </motion.div>
      </div>
      <h3 className="text-xl font-heading font-bold text-text-primary mb-2">Grading Live Assessment</h3>
      <p className="text-xs text-text-secondary font-mono mb-6">Evaluating communication parameters and accuracy standards...</p>
      <div className="w-full h-1.5 bg-bg-surface-alt rounded-full max-w-xs overflow-hidden border border-border">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 2.8 }}
          className="h-full bg-secondary"
        />
      </div>
    </div>
  );
}
