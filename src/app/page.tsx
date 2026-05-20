'use client';
import { useStore } from '@/store/useStore';
import LoginScreen from '@/components/login/LoginScreen';
import Dashboard from '@/components/Dashboard';
import AdminPanel from '@/components/admin/AdminPanel';

export default function Home() {
  const isLoggedIn = useStore(s => s.isLoggedIn);
  const isAdmin = useStore(s => s.currentUser?.isAdmin ?? false);

  if (!isLoggedIn) return <LoginScreen />;
  if (isAdmin) return <AdminPanel />;
  return <Dashboard />;
}
