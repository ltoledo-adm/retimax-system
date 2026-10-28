'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Rol } from '@retimax/shared-types';
import { getTokens, getUser } from '@/lib/api';

function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
      <p className="text-[#6c757d] text-sm">Cargando...</p>
    </div>
  );
}

export function AuthGuard({
  children,
  adminOnly,
  empleadoOnly,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  empleadoOnly?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'authorized' | 'denied'>('loading');

  useEffect(() => {
    const tokens = getTokens();
    if (!tokens) {
      setStatus('denied');
      router.replace('/login');
      return;
    }

    const user = getUser<{ rol: Rol }>();
    if (adminOnly && user?.rol !== Rol.ADMIN) {
      setStatus('denied');
      router.replace('/mis-maquinas');
      return;
    }
    if (empleadoOnly && user?.rol !== Rol.EMPLEADO) {
      setStatus('denied');
      router.replace('/dashboard');
      return;
    }

    setStatus('authorized');
  }, [router, adminOnly, empleadoOnly]);

  if (status === 'loading' || status === 'denied') {
    return <AuthLoading />;
  }

  return <>{children}</>;
}
