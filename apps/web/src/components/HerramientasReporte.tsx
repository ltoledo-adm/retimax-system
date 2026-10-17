'use client';

import { useState } from 'react';
import { ReporteHerramientasDto } from '@retimax/shared-types';
import { apiFetch, imageUrl } from '@/lib/api';

export function HerramientasReporte() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [data, setData] = useState<ReporteHerramientasDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function consultar(e?: { preventDefault(): void }) {
    e?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      const query = params.toString();
      const reporte = await apiFetch<ReporteHerramientasDto>(
        `/reportes/herramientas${query ? `?${query}` : ''}`,
      );
      setData(reporte);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el reporte');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl bg-white border p-5 space-y-4">
      <div>
        <h3 className="font-semibold">Inventario de herramientas</h3>
        <p className="text-sm text-[#6c757d]">Stock actual y unidades vendidas por fecha</p>
      </div>
      <form onSubmit={consultar} className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-[#6c757d] mb-1">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-[#6c757d] mb-1">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#1a1a1a] text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? 'Consultando...' : 'Ver reporte'}
        </button>
      </form>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-[#6c757d]">Stock actual</p>
              <p className="text-2xl font-bold mt-1">{data.stockTotal}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-[#6c757d]">Unidades vendidas</p>
              <p className="text-2xl font-bold mt-1">{data.unidadesVendidas}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-[#6c757d]">Vendido USD</p>
              <p className="text-2xl font-bold mt-1">${data.totalVendidoUsd}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-[#6c757d]">Vendido BOB</p>
              <p className="text-2xl font-bold mt-1">Bs {data.totalVendidoBob}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#6c757d] border-b">
                  <th className="py-2 pr-3">Herramienta</th>
                  <th className="py-2 pr-3">Medida</th>
                  <th className="py-2 pr-3">Precio</th>
                  <th className="py-2 pr-3">Stock</th>
                  <th className="py-2">Vendidas</th>
                </tr>
              </thead>
              <tbody>
                {data.herramientas.map((h) => (
                  <tr key={h.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        {h.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageUrl(h.thumbnailUrl)} alt="" className="h-8 w-8 rounded object-cover" />
                        ) : null}
                        <span>{h.nombre}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3">{[h.medida, h.dimensiones].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="py-2 pr-3">${h.precioCompraUsd}</td>
                    <td className="py-2 pr-3">{h.cantidad}</td>
                    <td className="py-2">{h.unidadesVendidas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.ventas.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-sm font-medium mb-2">Ventas del período</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[#6c757d] border-b">
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Herramienta</th>
                    <th className="py-2 pr-3">Cliente</th>
                    <th className="py-2 pr-3">Cant.</th>
                    <th className="py-2">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ventas.map((v) => (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">{new Date(v.createdAt).toLocaleString('es-BO')}</td>
                      <td className="py-2 pr-3">{v.herramienta?.nombre}</td>
                      <td className="py-2 pr-3">{v.cliente?.nombre}</td>
                      <td className="py-2 pr-3">{v.cantidad}</td>
                      <td className="py-2">${v.precioFinalUsd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
