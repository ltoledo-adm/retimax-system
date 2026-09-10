'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { EstadoMaquina, MaquinaDto } from '@retimax/shared-types';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import { apiFetch, imageUrl } from '@/lib/api';
import { ESTADO_COLORS, ESTADO_LABELS } from '@/lib/labels';
import { maquinaDetalleLinea, maquinaNombrePrincipal } from '@/lib/maquina-display';

type ViewMode = 'grid' | 'list';

export default function MaquinasList() {
  const searchParams = useSearchParams();
  const estadoFilter = searchParams.get('estado') as EstadoMaquina | null;
  const [maquinas, setMaquinas] = useState<MaquinaDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => {
    const query = estadoFilter ? `?estado=${estadoFilter}` : '';
    apiFetch<MaquinaDto[]>(`/maquinas${query}`)
      .then(setMaquinas)
      .finally(() => setLoading(false));
  }, [estadoFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return maquinas;
    return maquinas.filter(
      (m) =>
        m.nombre.toLowerCase().includes(q) ||
        m.tipo.toLowerCase().includes(q) ||
        m.marca.toLowerCase().includes(q) ||
        m.modelo.toLowerCase().includes(q) ||
        m.proveedor?.nombre.toLowerCase().includes(q) ||
        ESTADO_LABELS[m.estado].toLowerCase().includes(q),
    );
  }, [maquinas, search]);

  return (
    <AuthGuard adminOnly>
      <AppShell>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold">Máquinas</h2>
              {estadoFilter && (
                <p className="text-[#6c757d]">Filtrado: {ESTADO_LABELS[estadoFilter]}</p>
              )}
              <p className="text-sm text-[#6c757d]">{filtered.length} resultado(s)</p>
            </div>
            <Link
              href="/maquinas/nueva"
              className="rounded-lg bg-[#f5c842] px-5 py-2.5 font-semibold text-[#1a1a1a] text-center"
            >
              + Registrar máquina
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, tipo, proveedor o estado..."
              className="flex-1 rounded-lg border px-4 py-2.5"
            />
            <div className="flex rounded-lg border overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 text-sm ${viewMode === 'grid' ? 'bg-[#1a1a1a] text-white' : 'bg-white'}`}
              >
                Mosaico
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 text-sm border-l ${viewMode === 'list' ? 'bg-[#1a1a1a] text-white' : 'bg-white'}`}
              >
                Detalle
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-[#6c757d]">Cargando...</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center border">
              <p className="text-[#6c757d]">No se encontraron máquinas</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((m) => {
                const thumb = m.imagenes?.[0]?.thumbnailUrl;
                return (
                  <Link
                    key={m.id}
                    href={`/maquinas/${m.id}`}
                    className="rounded-xl bg-white border overflow-hidden hover:shadow-md transition"
                  >
                    <div className="h-40 bg-gray-100 flex items-center justify-center">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imageUrl(thumb)}
                          alt={m.nombre}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[#6c757d] text-sm">Sin imagen</span>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{maquinaNombrePrincipal(m)}</h3>
                          <p className="text-sm text-[#6c757d] mt-0.5">{maquinaDetalleLinea(m)}</p>
                        </div>
                        <span
                          className={`shrink-0 text-xs text-white px-2 py-1 rounded-full ${ESTADO_COLORS[m.estado]}`}
                        >
                          {ESTADO_LABELS[m.estado]}
                        </span>
                      </div>
                      <p className="text-xs text-[#6c757d] mt-2">{m.proveedor?.nombre ?? '—'}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl bg-white border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b text-left">
                  <tr>
                    <th className="p-3 w-16" />
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Detalle</th>
                    <th className="p-3">Proveedor</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Precio USD</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const thumb = m.imagenes?.[0]?.thumbnailUrl;
                    return (
                      <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="p-3">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageUrl(thumb)}
                              alt=""
                              className="h-10 w-10 rounded object-cover"
                            />
                          ) : (
                            <span className="text-xs text-[#6c757d]">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Link href={`/maquinas/${m.id}`} className="font-medium hover:text-[#f5c842]">
                            {maquinaNombrePrincipal(m)}
                          </Link>
                        </td>
                        <td className="p-3 text-[#6c757d]">{maquinaDetalleLinea(m)}</td>
                        <td className="p-3 text-[#6c757d]">{m.proveedor?.nombre ?? '—'}</td>
                        <td className="p-3">
                          <span
                            className={`text-xs text-white px-2 py-0.5 rounded-full ${ESTADO_COLORS[m.estado]}`}
                          >
                            {ESTADO_LABELS[m.estado]}
                          </span>
                        </td>
                        <td className="p-3">{m.precioVentaUsd ? `$${m.precioVentaUsd}` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
