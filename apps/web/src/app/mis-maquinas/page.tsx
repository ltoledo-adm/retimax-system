'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EstadoMaquina } from '@retimax/shared-types';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import { apiFetch, imageUrl } from '@/lib/api';
import { ESTADO_COLORS, ESTADO_LABELS } from '@/lib/labels';

type Ficha = {
  id: string;
  nombre: string;
  estado: EstadoMaquina;
  thumbnailUrl?: string | null;
  tomadaPor: { id: string; nombre: string } | null;
  esMia: boolean;
  puedoTomar: boolean;
};

export default function MisMaquinasPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [filas, setFilas] = useState<Ficha[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(texto = q) {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<Ficha[]>(
        `/mis-trabajos/maquinas${texto.trim() ? `?q=${encodeURIComponent(texto.trim())}` : ''}`,
      );
      setFilas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load('');
  }, []);

  return (
    <AuthGuard empleadoOnly>
      <AppShell>
        <div className="max-w-3xl mx-auto space-y-4">
          <div>
            <h2 className="text-2xl font-bold">Máquinas</h2>
            <p className="text-sm text-[#6c757d]">
              Busque la máquina y empiece. Si otro compañero ya la tomó, no podrá abrirla para trabajar.
            </p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void load(q);
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre"
              className="flex-1 rounded-lg border px-3 py-2"
            />
            <button type="submit" className="rounded-lg bg-[#1a1a1a] text-white px-4 py-2 text-sm font-semibold">
              Buscar
            </button>
          </form>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {loading ? (
            <p className="text-[#6c757d]">Cargando...</p>
          ) : filas.length === 0 ? (
            <p className="text-[#6c757d]">No hay máquinas con ese nombre.</p>
          ) : (
            <div className="space-y-2">
              {filas.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => router.push(`/mis-maquinas/${m.id}`)}
                  className="w-full text-left rounded-xl bg-white border p-3 flex items-center gap-3 hover:border-[#f5c842]"
                >
                  {m.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl(m.thumbnailUrl)} alt="" className="h-14 w-14 rounded-lg object-cover bg-gray-100" />
                  ) : (
                    <span className="h-14 w-14 rounded-lg bg-gray-100" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold truncate">{m.nombre}</span>
                    <span className="block text-xs text-[#6c757d] mt-0.5">
                      {m.esMia
                        ? 'La está trabajando usted'
                        : m.tomadaPor
                          ? `En curso: ${m.tomadaPor.nombre}`
                          : 'Disponible'}
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs text-white px-2 py-1 rounded-full ${ESTADO_COLORS[m.estado]}`}>
                    {ESTADO_LABELS[m.estado]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
