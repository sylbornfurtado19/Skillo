import type { Metadata } from 'next';
import Login from '../../src/views/Login';
import MainLayout from '../../src/layouts/MainLayout';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Skillo account to practice realistic AI interviews.',
};

export default function LoginPage() {
  return (
    <MainLayout>
      <Login />
    </MainLayout>
  );
}
