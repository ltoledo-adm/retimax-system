'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  EstadoMaquina,
  ReporteResumenDto,
  ReporteTrabajoDto,
} from '@retimax/shared-types';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import { HerramientasReporte } from '@/components/HerramientasReporte';
import { PrintReport } from '@/components/PrintReport';
import { apiFetch, imageUrl } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import {
  AREA_LABELS,
  ESTADO_COLORS,
  ESTADO_LABELS,
  TIPO_INTERVENCION_LABELS,
} from '@/lib/labels';

type PrintSection =
  | 'resumen'
  | 'ventas'
  | 'clientes'
  | 'proveedores'
  | 'maquinas'
  | 'trabajos'
  | null;

function PrintButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm rounded-lg border px-3 py-1.5 hover:bg-gray-50 shrink-0"
    >
      Imprimir
    </button>
  );
}

export default function ReportesPage() {
  const [data, setData] = useState<ReporteResumenDto | null>(null);
  const [trabajos, setTrabajos] = useState<ReporteTrabajoDto[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [loading, setLoading] = useState(true);
  const [printSection, setPrintSection] = useState<PrintSection>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<ReporteResumenDto>('/reportes/resumen'),
      apiFetch<ReporteTrabajoDto[]>('/reportes/trabajos'),
    ])
      .then(([resumen, trabajosData]) => {
        setData(resumen);
        setTrabajos(trabajosData);
      })
      .finally(() => setLoading(false));
  }, []);

  const maquinasFiltradas = useMemo(() => {
    if (!data) return [];
    if (filtroEstado === 'TODOS') return data.maquinas;
    return data.maquinas.filter((m) => m.estado === filtroEstado);
  }, [data, filtroEstado]);

  if (loading) {
    return (
      <AuthGuard adminOnly>
        <AppShell>
          <p className="text-[#6c757d]">Cargando reportes...</p>
        </AppShell>
      </AuthGuard>
    );
  }

  if (!data) return null;

  const { resumen, porEstado } = data;

  const resumenCards = [
    { label: 'Total máquinas', value: resumen.totalMaquinas },
    { label: 'Vendidas', value: resumen.maquinasVendidas },
    { label: 'Lista para venta', value: resumen.maquinasDisponibles },
    { label: 'Reservadas', value: resumen.maquinasReservadas },
    { label: 'En tránsito / Italia', value: resumen.maquinasCompradas },
    { label: 'En taller', value: resumen.maquinasEnProceso },
    { label: 'Clientes', value: resumen.totalClientes },
    { label: 'Proveedores', value: resumen.totalProveedores },
  ];

  return (
    <AuthGuard adminOnly>
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Reportería</h2>
            <p className="text-sm text-[#6c757d]">
              Resumen del inventario, ventas, clientes, proveedores, trabajos y herramientas
            </p>
          </div>

          <div className="rounded-xl bg-white border p-5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Resumen general</h3>
              <PrintButton onClick={() => setPrintSection('resumen')} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {resumenCards.map((card) => (
                <div key={card.label} className="rounded-lg bg-gray-50 p-4">
                  <p className="text-xs text-[#6c757d]">{card.label}</p>
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                </div>
              ))}
            </div>
            <p className="text-sm mt-4 font-medium">
              Ventas totales: ${resumen.totalVentasUsd} USD / Bs {resumen.totalVentasBob}
            </p>
          </div>

          <div className="rounded-xl bg-white border p-5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">
                Ventas — ${resumen.totalVentasUsd} USD / Bs {resumen.totalVentasBob}
              </h3>
              <PrintButton onClick={() => setPrintSection('ventas')} />
            </div>
            {data.ventas.length === 0 ? (
              <p className="text-sm text-[#6c757d]">Sin ventas registradas</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#6c757d] border-b">
                      <th className="py-2 pr-3">Máquina</th>
                      <th className="py-2 pr-3">Cliente</th>
                      <th className="py-2 pr-3">Proveedor</th>
                      <th className="py-2 pr-3">USD</th>
                      <th className="py-2 pr-3">BOB</th>
                      <th className="py-2">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ventas.map((v) => (
                      <tr key={v.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <Link href={`/maquinas/${v.maquinaId}`} className="font-medium hover:text-[#f5c842]">
                            {v.maquinaNombre}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">{v.clienteNombre}</td>
                        <td className="py-2 pr-3">{v.proveedor}</td>
                        <td className="py-2 pr-3">${v.precioFinalUsd}</td>
                        <td className="py-2 pr-3">Bs {v.precioFinalBob}</td>
                        <td className="py-2">{new Date(v.createdAt).toLocaleDateString('es-BO')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl bg-white border p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">Clientes ({data.clientes.length})</h3>
                <PrintButton onClick={() => setPrintSection('clientes')} />
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.clientes.map((c) => (
                  <div key={c.id} className="flex justify-between text-sm border-b pb-2">
                    <span>{c.nombre}</span>
                    <span className="text-[#6c757d]">
                      {c.totalVentas} venta(s) · {c.totalPedidos} pedido(s)
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-white border p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">Proveedores ({data.proveedores.length})</h3>
                <PrintButton onClick={() => setPrintSection('proveedores')} />
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.proveedores.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm border-b pb-2">
                    <span>{p.nombre}</span>
                    <span className="text-[#6c757d]">{p.totalMaquinas} máquina(s)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white border p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold">Trabajos de empleados ({trabajos.length})</h3>
              <PrintButton onClick={() => setPrintSection('trabajos')} />
            </div>
            {trabajos.length === 0 ? (
              <p className="text-sm text-[#6c757d]">Sin trabajos registrados</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#6c757d] border-b">
                      <th className="py-2 pr-3">Empleado</th>
                      <th className="py-2 pr-3">Máquina</th>
                      <th className="py-2 pr-3">Área</th>
                      <th className="py-2 pr-3">Estado</th>
                      <th className="py-2 pr-3">Asignado</th>
                      <th className="py-2 pr-3">Inicio</th>
                      <th className="py-2">Finalizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trabajos.map((t) => (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">{t.empleado}</td>
                        <td className="py-2 pr-3">
                          <Link href={`/maquinas/${t.maquinaId}`} className="hover:text-[#f5c842]">
                            {t.maquinaNombre}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">{AREA_LABELS[t.area]}</td>
                        <td className="py-2 pr-3">
                          {(t.estadoIntervencion ?? 'ASIGNADO').replace(/_/g, ' ')}
                        </td>
                        <td className="py-2 pr-3">{formatDateTime(t.fechaAsignacion)}</td>
                        <td className="py-2 pr-3">{formatDateTime(t.fechaInicio)}</td>
                        <td className="py-2">{formatDateTime(t.fechaFinalizacion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white border p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold">Máquinas por estado</h3>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="TODOS">Todos los estados</option>
                  {Object.values(EstadoMaquina).map((e) => (
                    <option key={e} value={e}>
                      {ESTADO_LABELS[e]} ({porEstado[e] ?? 0})
                    </option>
                  ))}
                </select>
                <PrintButton onClick={() => setPrintSection('maquinas')} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(porEstado).map(([estado, count]) => (
                <button
                  key={estado}
                  type="button"
                  onClick={() => setFiltroEstado(estado)}
                  className={`text-xs px-2 py-1 rounded-full text-white ${ESTADO_COLORS[estado as EstadoMaquina]}`}
                >
                  {ESTADO_LABELS[estado as EstadoMaquina]}: {count}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[#6c757d] border-b">
                    <th className="py-2 pr-2">Foto</th>
                    <th className="py-2 pr-3">Máquina</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 pr-3">Proveedor</th>
                    <th className="py-2 pr-3">Registró</th>
                    <th className="py-2 pr-3">Reservada / Vendida</th>
                    <th className="py-2">Diagnóstico</th>
                  </tr>
                </thead>
                <tbody>
                  {maquinasFiltradas.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">
                        {m.thumbnailUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={imageUrl(m.thumbnailUrl)}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <span className="text-xs text-[#6c757d]">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <Link href={`/maquinas/${m.id}`} className="font-medium hover:text-[#f5c842]">
                          {m.nombre}
                        </Link>
                        <p className="text-xs text-[#6c757d]">{m.tipo}</p>
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`text-xs text-white px-2 py-0.5 rounded-full ${ESTADO_COLORS[m.estado]}`}
                        >
                          {ESTADO_LABELS[m.estado]}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{m.proveedor}</td>
                      <td className="py-2 pr-3">{m.registradoPor}</td>
                      <td className="py-2 pr-3">
                        {m.vendidaA ? (
                          <span className="text-green-700">Vendida: {m.vendidaA}</span>
                        ) : m.reservadaPor ? (
                          <span className="text-purple-700">Reservada: {m.reservadaPor}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2">{m.empleadoDiagnostico ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <HerramientasReporte />
        </div>

        {printSection === 'resumen' && (
          <PrintReport title="Resumen general" onClose={() => setPrintSection(null)}>
            <table className="w-full text-sm">
              <tbody>
                {resumenCards.map((c) => (
                  <tr key={c.label} className="border-b">
                    <td className="py-2">{c.label}</td>
                    <td className="py-2 text-right font-semibold">{c.value}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 font-medium">Ventas totales USD</td>
                  <td className="py-2 text-right font-semibold">${resumen.totalVentasUsd}</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium">Ventas totales BOB</td>
                  <td className="py-2 text-right font-semibold">Bs {resumen.totalVentasBob}</td>
                </tr>
              </tbody>
            </table>
          </PrintReport>
        )}

        {printSection === 'ventas' && (
          <PrintReport title="Reporte de ventas" onClose={() => setPrintSection(null)}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-2">Máquina</th>
                  <th className="py-2 pr-2">Cliente</th>
                  <th className="py-2 pr-2">USD</th>
                  <th className="py-2 pr-2">BOB</th>
                  <th className="py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.ventas.map((v) => (
                  <tr key={v.id} className="border-b">
                    <td className="py-2 pr-2">{v.maquinaNombre}</td>
                    <td className="py-2 pr-2">{v.clienteNombre}</td>
                    <td className="py-2 pr-2">${v.precioFinalUsd}</td>
                    <td className="py-2 pr-2">Bs {v.precioFinalBob}</td>
                    <td className="py-2">{new Date(v.createdAt).toLocaleDateString('es-BO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintReport>
        )}

        {printSection === 'clientes' && (
          <PrintReport title="Listado de clientes" onClose={() => setPrintSection(null)}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Cliente</th>
                  <th className="py-2">Ventas</th>
                  <th className="py-2">Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {data.clientes.map((c) => (
                  <tr key={c.id} className="border-b">
                    <td className="py-2">{c.nombre}</td>
                    <td className="py-2">{c.totalVentas}</td>
                    <td className="py-2">{c.totalPedidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintReport>
        )}

        {printSection === 'proveedores' && (
          <PrintReport title="Listado de proveedores" onClose={() => setPrintSection(null)}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Proveedor</th>
                  <th className="py-2">Máquinas</th>
                </tr>
              </thead>
              <tbody>
                {data.proveedores.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2">{p.nombre}</td>
                    <td className="py-2">{p.totalMaquinas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintReport>
        )}

        {printSection === 'trabajos' && (
          <PrintReport title="Reporte de trabajos" onClose={() => setPrintSection(null)}>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-1">Empleado</th>
                  <th className="py-2 pr-1">Máquina</th>
                  <th className="py-2 pr-1">Tipo</th>
                  <th className="py-2 pr-1">Estado</th>
                  <th className="py-2 pr-1">Asignado</th>
                  <th className="py-2 pr-1">Inicio</th>
                  <th className="py-2">Fin</th>
                </tr>
              </thead>
              <tbody>
                {trabajos.map((t) => (
                  <tr key={t.id} className="border-b align-top">
                    <td className="py-2 pr-1">{t.empleado}</td>
                    <td className="py-2 pr-1">{t.maquinaNombre}</td>
                    <td className="py-2 pr-1">{TIPO_INTERVENCION_LABELS[t.tipo]}</td>
                    <td className="py-2 pr-1">
                      {(t.estadoIntervencion ?? 'ASIGNADO').replace(/_/g, ' ')}
                    </td>
                    <td className="py-2 pr-1">{formatDateTime(t.fechaAsignacion)}</td>
                    <td className="py-2 pr-1">{formatDateTime(t.fechaInicio)}</td>
                    <td className="py-2">{formatDateTime(t.fechaFinalizacion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintReport>
        )}

        {printSection === 'maquinas' && (
          <PrintReport
            title={`Máquinas — ${filtroEstado === 'TODOS' ? 'Todos' : ESTADO_LABELS[filtroEstado as EstadoMaquina]}`}
            onClose={() => setPrintSection(null)}
          >
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-1">Máquina</th>
                  <th className="py-2 pr-1">Estado</th>
                  <th className="py-2 pr-1">Proveedor</th>
                  <th className="py-2 pr-1">Reservada/Vendida</th>
                  <th className="py-2">Precio USD</th>
                </tr>
              </thead>
              <tbody>
                {maquinasFiltradas.map((m) => (
                  <tr key={m.id} className="border-b">
                    <td className="py-2 pr-1">{m.nombre}</td>
                    <td className="py-2 pr-1">{ESTADO_LABELS[m.estado]}</td>
                    <td className="py-2 pr-1">{m.proveedor}</td>
                    <td className="py-2 pr-1">{m.vendidaA ?? m.reservadaPor ?? '—'}</td>
                    <td className="py-2">{m.precioVentaUsd ? `$${m.precioVentaUsd}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintReport>
        )}
      </AppShell>
    </AuthGuard>
  );
}
