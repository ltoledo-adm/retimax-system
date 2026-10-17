'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, getUser } from '@/lib/api';
import { Rol } from '@retimax/shared-types';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, password);
      const user = getUser<{ rol: Rol }>();
      router.push(user?.rol === Rol.EMPLEADO ? '/mis-trabajos' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a1a] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#1a1a1a]">
            RETI<span className="text-[#f5c842]">MAX</span>
          </h1>
          <p className="text-[#6c757d] mt-2">Ingresa a tu cuenta</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div>
            <label className="block text-sm font-medium mb-1">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej. número de carnet o usuario"
              autoComplete="off"
              name="retimax-user"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#f5c842]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                name="retimax-pass"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-11 focus:outline-none focus:ring-2 focus:ring-[#f5c842]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-[#6c757d]"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M3 3l18 18" strokeLinecap="round" />
                    <path d="M10.6 10.6a2 2 0 002.8 2.8" strokeLinecap="round" />
                    <path d="M9.9 5.1A10.8 10.8 0 0112 5c5.5 0 9.5 4.2 11 7-0.6 1.1-1.5 2.3-2.6 3.4M6.1 6.1C4.2 7.4 2.7 9.1 1 12c1.5 2.8 5.5 7 11 7 1.3 0 2.5-.2 3.6-.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#f5c842] text-[#1a1a1a] font-semibold py-3 hover:brightness-95 disabled:opacity-60"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
