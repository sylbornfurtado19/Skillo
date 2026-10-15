import type { Metadata } from 'next';
import Dashboard from '../../../src/views/Dashboard';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Track your interview readiness, review analytics, and launch practice sessions.',
};

export default function DashboardPage() {
  return <Dashboard />;
}
