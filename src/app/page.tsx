'use client';
import { useStore } from '@/store/useStore';
import LoginScreen from '@/components/login/LoginScreen';
import ChangePasswordScreen from '@/components/login/ChangePasswordScreen';
import Dashboard from '@/components/Dashboard';
import AdminPanel from '@/components/admin/AdminPanel';

export default function Home() {
  const isLoggedIn = useStore(s => s.isLoggedIn);
  const isAdmin = useStore(s => s.currentUser?.isAdmin ?? false);
  const forcePasswordChange = useStore(s => s.forcePasswordChange);

  if (!isLoggedIn) return <LoginScreen />;
  if (isAdmin) return <AdminPanel />;
  if (forcePasswordChange) return <ChangePasswordScreen />;
  return <Dashboard />;
}
