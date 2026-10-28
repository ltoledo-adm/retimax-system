'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IntervencionDto } from '@retimax/shared-types';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import { TrabajoEmpleadoPanel } from '@/components/TrabajoEmpleadoPanel';
import { apiFetch } from '@/lib/api';

export default function MisTrabajosPage() {
  const [trabajos, setTrabajos] = useState<IntervencionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setTrabajos(await apiFetch<IntervencionDto[]>('/mis-trabajos'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AuthGuard empleadoOnly>
      <AppShell>
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Mis trabajos</h2>
            <p className="text-sm text-[#6c757d]">
              Lo que usted está haciendo. Para tomar una máquina que no le asignaron, entre a{' '}
              <Link href="/mis-maquinas" className="underline">
                Máquinas
              </Link>
              .
            </p>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {loading ? (
            <p className="text-[#6c757d]">Cargando...</p>
          ) : trabajos.length === 0 ? (
            <div className="rounded-xl bg-white border p-8 text-center text-[#6c757d]">
              Todavía no tiene trabajos. Puede buscar una máquina y empezar.
            </div>
          ) : (
            <div className="space-y-4">
              {trabajos.map((trabajo) => (
                <TrabajoEmpleadoPanel key={trabajo.id} trabajo={trabajo} onChanged={load} />
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
