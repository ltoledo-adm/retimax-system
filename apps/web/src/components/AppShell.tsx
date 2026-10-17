'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Rol } from '@retimax/shared-types';
import { getUser, logout } from '@/lib/api';

const adminNav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/maquinas', label: 'Máquinas' },
  { href: '/herramientas', label: 'Herramientas' },
  { href: '/empleados', label: 'Empleados' },
  { href: '/pedidos', label: 'Pedidos' },
  { href: '/ventas', label: 'Ventas' },
  { href: '/reportes', label: 'Reportería' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/proveedores', label: 'Proveedores' },
];

const empleadoNav = [{ href: '/mis-trabajos', label: 'Mis trabajos' }];

type AppUser = { nombre: string; email: string; rol: Rol };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    setUser(getUser<AppUser>());
  }, []);

  const navItems = user?.rol === Rol.EMPLEADO ? empleadoNav : adminNav;

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <div className="min-h-screen flex bg-[#f8f9fa]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#1a1a1a] text-white transform transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:block`}
      >
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold tracking-wide">
            RETI<span className="text-[#f5c842]">MAX</span>
          </h1>
          <p className="text-xs text-[#6c757d] mt-1">
            {user?.rol === Rol.EMPLEADO ? 'Portal de trabajador' : 'Gestión de maquinaria'}
          </p>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-4 py-2.5 text-sm transition ${
                  active
                    ? 'bg-[#f5c842] text-[#1a1a1a] font-semibold'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <p className="text-sm font-medium truncate">{user?.nombre ?? '—'}</p>
          <p className="text-xs text-[#6c757d] truncate">{user?.email ?? ''}</p>
          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-20 bg-[#1a1a1a] text-white px-4 py-3 flex items-center justify-between">
          <button onClick={() => setOpen(true)} aria-label="Menú">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold">
            RETI<span className="text-[#f5c842]">MAX</span>
          </span>
          <div className="w-6" />
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
