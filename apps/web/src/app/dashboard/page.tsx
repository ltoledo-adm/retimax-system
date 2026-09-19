'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardResumen, EstadoMaquina, IntervencionDto } from '@retimax/shared-types';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import { apiFetch } from '@/lib/api';
import { ESTADO_COLORS, ESTADO_LABELS } from '@/lib/labels';

export default function DashboardPage() {
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [pendientes, setPendientes] = useState<IntervencionDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<DashboardResumen>('/maquinas/dashboard/resumen'),
      apiFetch<IntervencionDto[]>('/intervenciones/pendientes-aprobacion'),
    ])
      .then(([r, p]) => {
        setResumen(r);
        setPendientes(p);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthGuard adminOnly>
      <AppShell>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-[#1a1a1a]">Dashboard</h2>
              <p className="text-[#6c757d]">Resumen del inventario por estado</p>
            </div>
            <Link
              href="/maquinas/nueva"
              className="inline-flex items-center justify-center rounded-lg bg-[#f5c842] px-5 py-2.5 font-semibold text-[#1a1a1a]"
            >
              + Nueva máquina
            </Link>
          </div>

          {loading ? (
            <p className="text-[#6c757d]">Cargando...</p>
          ) : resumen ? (
            <>
              {pendientes.length > 0 && (
                <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5 mb-6" role="alert">
                  <p className="font-bold text-amber-900 text-lg">
                    Trabajos por aprobar: {pendientes.length}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {pendientes.slice(0, 5).map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/maquinas/${p.maquinaId}`}
                          className="text-amber-900 underline font-medium"
                        >
                          {p.maquina?.nombre ?? 'Máquina'} — {p.responsableNombre ?? 'Técnico'}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {pendientes.length > 5 && (
                    <p className="text-xs text-amber-800 mt-2">Y {pendientes.length - 5} más…</p>
                  )}
                </div>
              )}
              <div className="rounded-2xl bg-[#1a1a1a] text-white p-6 mb-6">
                <p className="text-[#6c757d] text-sm">Total de máquinas</p>
                <p className="text-4xl font-bold text-[#f5c842]">{resumen.total}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(Object.keys(ESTADO_LABELS) as EstadoMaquina[]).map((estado) => (
                  <Link
                    key={estado}
                    href={`/maquinas?estado=${estado}`}
                    className="rounded-xl bg-white border border-gray-200 p-5 hover:shadow-md transition"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`w-3 h-3 rounded-full ${ESTADO_COLORS[estado]}`} />
                      <span className="text-sm font-medium text-[#6c757d]">
                        {ESTADO_LABELS[estado]}
                      </span>
                    </div>
                    <p className="text-3xl font-bold">{resumen.porEstado[estado] ?? 0}</p>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
