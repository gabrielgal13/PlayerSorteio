'use client';
import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import LoginScreen from '@/components/login/LoginScreen';
import ChangePasswordScreen from '@/components/login/ChangePasswordScreen';
import Dashboard from '@/components/Dashboard';
import AdminPanel from '@/components/admin/AdminPanel';

export default function Home() {
  const isLoggedIn = useStore(s => s.isLoggedIn);
  const isAdmin = useStore(s => s.currentUser?.isAdmin ?? false);
  const forcePasswordChange = useStore(s => s.forcePasswordChange);
  const restoreSession = useStore(s => s.restoreSession);

  // O "logado" do localStorage é só cache — o cookie `ps_session` é que autoriza
  // a API, e vence antes. Sem conferir no mount, o painel abre normal com uma
  // sessão morta e todo botão que fala com o servidor falha em 401.
  useEffect(() => { restoreSession(); }, [restoreSession]);

  if (!isLoggedIn) return <LoginScreen />;
  if (isAdmin) return <AdminPanel />;
  if (forcePasswordChange) return <ChangePasswordScreen />;
  return <Dashboard />;
}
