'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  EmpleadoDto,
  EstadoIntervencion,
  EstadoMaquina,
  EtapaImagen,
  MaquinaDto,
  ProveedorDto,
  TipoIntervencion,
} from '@retimax/shared-types';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import { AudioNoteRecorder } from '@/components/AudioNoteRecorder';
import { DiagnosticoPanel } from '@/components/DiagnosticoPanel';
import { EstadoPipeline, getPipelineForMaquina } from '@/components/EstadoPipeline';
import { MantenimientoPanel } from '@/components/MantenimientoPanel';
import { PreciosListaVentaPanel } from '@/components/PreciosListaVentaPanel';
import { PhotoGallery } from '@/components/PhotoGallery';
import { ImagePicker } from '@/components/ImagePicker';
import { apiFetch } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { maquinaDetalleLinea, maquinaNombrePrincipal } from '@/lib/maquina-display';
import {
  AREA_LABELS,
  ESTADO_COLORS,
  ESTADO_LABELS,
  TIPO_INTERVENCION_LABELS,
} from '@/lib/labels';

function estadoAnteriorDe(estado: EstadoMaquina, esReserva?: boolean): EstadoMaquina | null {
  const pipeline = getPipelineForMaquina(estado, esReserva);
  const i = pipeline.indexOf(estado);
  return i > 0 ? pipeline[i - 1] : null;
}

export default function MaquinaDetailPage() {
  const params = useParams<{ id: string }>();
  const [maquina, setMaquina] = useState<MaquinaDto | null>(null);
  const [empleados, setEmpleados] = useState<EmpleadoDto[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorDto[]>([]);
  const [editing, setEditing] = useState(false);
  const [volverAtras, setVolverAtras] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [editNombre, setEditNombre] = useState('');
  const [editTipo, setEditTipo] = useState('');
  const [editMarca, setEditMarca] = useState('');
  const [editModelo, setEditModelo] = useState('');
  const [editAnio, setEditAnio] = useState('');
  const [editProveedorId, setEditProveedorId] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');

  const [fechaDespacho, setFechaDespacho] = useState('');
  const [fechaLlegadaEst, setFechaLlegadaEst] = useState('');
  const [fechaRecibida, setFechaRecibida] = useState('');
  const [recepcionDesc, setRecepcionDesc] = useState('');
  const [fotosLlegada, setFotosLlegada] = useState<File[]>([]);

  const [precioCompraUsd, setPrecioCompraUsd] = useState('');
  const [precioVentaUsd, setPrecioVentaUsd] = useState('');

  function syncForm(data: MaquinaDto) {
    setEditNombre(data.nombre);
    setEditTipo(data.tipo);
    setEditMarca(data.marca);
    setEditModelo(data.modelo);
    setEditAnio(data.anio != null ? String(data.anio) : '');
    setEditProveedorId(data.proveedorId);
    setEditDescripcion(data.descripcionAcordada ?? data.descripcionLlegada ?? '');
    setRecepcionDesc(data.descripcionLlegada ?? '');
    setFechaDespacho(data.fechaDespacho?.slice(0, 10) ?? '');
    setFechaLlegadaEst(data.fechaLlegadaEstimada?.slice(0, 10) ?? '');
    setFechaRecibida(
      data.fechaLlegadaReal?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    );
    setPrecioCompraUsd(data.precioCompraUsd ?? '');
    setPrecioVentaUsd(data.precioVentaUsd ?? '');
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [data, emps, provs] = await Promise.all([
        apiFetch<MaquinaDto>(`/maquinas/${params.id}`),
        apiFetch<EmpleadoDto[]>('/empleados'),
        apiFetch<ProveedorDto[]>('/proveedores'),
      ]);
      setMaquina(data);
      setEmpleados(emps.filter((e) => e.activo));
      setProveedores(provs);
      syncForm(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar máquina');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  const estado = maquina?.estado;
  const acordada = maquina?.descripcionAcordada ?? maquina?.descripcionLlegada;
  const esReserva = maquina?.esReserva ?? maquina?.estado === EstadoMaquina.RESERVADA;
  const estadoPrevio = estado ? estadoAnteriorDe(estado, esReserva) : null;

  const asignacionesDiagnostico = useMemo(
    () =>
      maquina?.intervenciones?.filter(
        (i) =>
          i.tipo === TipoIntervencion.DIAGNOSTICO_INICIAL &&
          i.estadoIntervencion !== EstadoIntervencion.CANCELADO,
      ) ?? [],
    [maquina?.intervenciones],
  );

  const intervencionesMantenimiento = useMemo(
    () =>
      maquina?.intervenciones?.filter(
        (i) =>
          i.tipo === TipoIntervencion.TRABAJO_REALIZADO &&
          i.estadoIntervencion !== EstadoIntervencion.CANCELADO,
      ) ?? [],
    [maquina?.intervenciones],
  );

  const hayPendientesAprobacion = intervencionesMantenimiento.some(
    (i) => i.estadoIntervencion === EstadoIntervencion.FINALIZADO,
  );
  const hayTrabajoAprobado = intervencionesMantenimiento.some(
    (i) => i.estadoIntervencion === EstadoIntervencion.APROBADO,
  );

  async function uploadPhotos(etapa: EtapaImagen, files: File[]) {
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));
      form.append('etapa', etapa);
      await apiFetch(`/maquinas/${params.id}/imagenes/lote`, { method: 'POST', body: form });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir fotos');
    } finally {
      setUploading(false);
    }
  }

  async function handleTransito(e: FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      await apiFetch(`/maquinas/${params.id}/transito`, {
        method: 'POST',
        body: JSON.stringify({
          fechaDespacho,
          fechaLlegadaEstimada: fechaLlegadaEst || undefined,
        }),
      });
      setVolverAtras(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar tránsito');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmarRecibida() {
    setActionLoading(true);
    setError('');
    try {
      await apiFetch(`/maquinas/${params.id}/recibida`, {
        method: 'POST',
        body: JSON.stringify({ fechaLlegadaReal: fechaRecibida || undefined }),
      });
      setVolverAtras(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al marcar recibida');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRecepcion(e: FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('descripcionLlegada', recepcionDesc);
      if (fechaRecibida) form.append('fechaLlegadaReal', fechaRecibida);
      fotosLlegada.forEach((f) => form.append('files', f));
      await apiFetch(`/maquinas/${params.id}/recepcion`, { method: 'POST', body: form });
      setFotosLlegada([]);
      setVolverAtras(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar recepción');
    } finally {
      setActionLoading(false);
    }
  }

  async function savePrecio(compra: string, venta: string) {
    setError('');
    await apiFetch(`/maquinas/${params.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        precioCompraUsd: compra || undefined,
        precioVentaUsd: venta || undefined,
      }),
    });
    await load();
  }

  async function pasarListaParaVenta() {
    await cambiarEstado(EstadoMaquina.LISTA_PARA_VENTA, 'Trabajo validado');
    if (maquina) notifyListaParaVenta(maquina.nombre);
  }

  function notifyListaParaVenta(nombre: string) {
    window.alert(
      `La máquina "${nombre}" está lista para la venta. Puede pasar al módulo de Ventas para realizar la operación.`,
    );
  }

  async function cambiarEstado(nuevoEstado: EstadoMaquina, motivo?: string) {
    setActionLoading(true);
    setError('');
    try {
      await apiFetch(`/maquinas/${params.id}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado, motivo }),
      });
      setVolverAtras(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleVolverAtras() {
    if (!estadoPrevio) return;
    await cambiarEstado(estadoPrevio, 'Retroceso al estado anterior');
  }

  async function saveEdicion(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch(`/maquinas/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: editNombre,
          tipo: editTipo,
          marca: editMarca,
          modelo: editModelo,
          anio: editAnio ? Number(editAnio) : undefined,
          proveedorId: editProveedorId,
          descripcionLlegada: editDescripcion,
        }),
      });
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar cambios');
    }
  }

  async function aprobarIntervencion(id: string) {
    await apiFetch(`/intervenciones/${id}/aprobar`, { method: 'PATCH' });
    await load();
  }

  async function rechazarIntervencion(id: string) {
    const obs = prompt('Motivo del rechazo (opcional):');
    await apiFetch(`/intervenciones/${id}/rechazar`, {
      method: 'PATCH',
      body: JSON.stringify({ observaciones: obs || undefined }),
    });
    await load();
  }

  if (loading) {
    return (
      <AuthGuard adminOnly>
        <AppShell>
          <p className="text-[#6c757d]">Cargando...</p>
        </AppShell>
      </AuthGuard>
    );
  }

  if (!maquina || !estado) return null;

  return (
    <AuthGuard adminOnly>
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-6">
          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          {/* CUADRO 1 — Datos principales + fotos + despacho */}
          <div className="rounded-xl bg-white border p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">{maquinaNombrePrincipal(maquina)}</h2>
                <p className="text-lg text-[#6c757d]">{maquinaDetalleLinea(maquina)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-sm text-white px-3 py-1 rounded-full ${ESTADO_COLORS[estado]}`}
                >
                  {ESTADO_LABELS[estado]}
                </span>
                {estado !== EstadoMaquina.VENDIDA && (
                  <button
                    type="button"
                    onClick={() => setEditing(!editing)}
                    className="text-sm rounded-lg border px-3 py-1 hover:bg-gray-50"
                  >
                    {editing ? 'Cancelar' : 'Editar'}
                  </button>
                )}
              </div>
            </div>

            {editing ? (
              <form onSubmit={saveEdicion} className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-4">
                <input
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  placeholder="Nombre interno"
                  className="rounded-lg border px-3 py-2"
                  required
                />
                <input
                  value={editTipo}
                  onChange={(e) => setEditTipo(e.target.value)}
                  placeholder="Tipo (ej. Fresadora)"
                  className="rounded-lg border px-3 py-2"
                  required
                />
                <input
                  value={editMarca}
                  onChange={(e) => setEditMarca(e.target.value)}
                  placeholder="Marca *"
                  className="rounded-lg border px-3 py-2"
                  required
                />
                <input
                  value={editModelo}
                  onChange={(e) => setEditModelo(e.target.value)}
                  placeholder="Modelo *"
                  className="rounded-lg border px-3 py-2"
                  required
                />
                <input
                  type="number"
                  min={1950}
                  max={2100}
                  value={editAnio}
                  onChange={(e) => setEditAnio(e.target.value)}
                  placeholder="Año *"
                  className="rounded-lg border px-3 py-2"
                  required
                />
                <select
                  value={editProveedorId}
                  onChange={(e) => setEditProveedorId(e.target.value)}
                  className="rounded-lg border px-3 py-2 md:col-span-2"
                  required
                >
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <textarea
                  value={editDescripcion}
                  onChange={(e) => setEditDescripcion(e.target.value)}
                  placeholder="Descripción acordada / qué debería traer"
                  rows={3}
                  className="rounded-lg border px-3 py-2 md:col-span-2"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#f5c842] px-4 py-2 font-semibold text-sm w-fit"
                >
                  Guardar cambios
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <p>
                  <span className="text-[#6c757d]">Proveedor:</span> {maquina.proveedor?.nombre}
                </p>
                <p>
                  <span className="text-[#6c757d]">Registrada por:</span> {maquina.creadoPor?.nombre}
                </p>
                {acordada && (
                  <p className="md:col-span-2 whitespace-pre-wrap">
                    <span className="text-[#6c757d]">Descripción:</span> {acordada}
                  </p>
                )}
                {maquina.fechaDespacho && (
                  <p>
                    <span className="text-[#6c757d]">Despacho:</span>{' '}
                    {new Date(maquina.fechaDespacho).toLocaleDateString('es-BO')}
                  </p>
                )}
                {maquina.fechaLlegadaReal && (
                  <p>
                    <span className="text-[#6c757d]">Llegada:</span>{' '}
                    {new Date(maquina.fechaLlegadaReal).toLocaleDateString('es-BO')}
                  </p>
                )}
              </div>
            )}

            <PhotoGallery imagenes={maquina.imagenes ?? []} title="Fotos de la máquina" />

            {maquina.pedidoReserva && (
              <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-sm">
                <p className="font-medium">Reservada para: {maquina.pedidoReserva.clienteNombre}</p>
                <p className="text-[#6c757d] mt-1">
                  Total ${maquina.pedidoReserva.totalUsd} — Anticipo ${maquina.pedidoReserva.anticipoUsd} — Saldo ${maquina.pedidoReserva.saldoUsd}
                </p>
              </div>
            )}

            {(estado === EstadoMaquina.COMPRADA_ITALIA || estado === EstadoMaquina.RESERVADA) && (
              <>
                <AudioNoteRecorder
                  maquinaId={maquina.id}
                  audioUrl={maquina.notaAudioUrl}
                  onUploaded={() => load()}
                />
                <ImagePicker
                  label="Agregar fotos de embarque"
                  disabled={uploading}
                  onUpload={(files) => uploadPhotos(EtapaImagen.EMBARQUE, files)}
                  uploading={uploading}
                />
                <form
                  onSubmit={handleTransito}
                  className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-3"
                >
                  <p className="text-sm font-medium">Confirmar despacho → En tránsito</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1">Fecha de salida / despacho *</label>
                      <input
                        type="date"
                        value={fechaDespacho}
                        onChange={(e) => setFechaDespacho(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Llegada estimada (opcional)</label>
                      <input
                        type="date"
                        value={fechaLlegadaEst}
                        onChange={(e) => setFechaLlegadaEst(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded-lg bg-[#1a1a1a] text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {actionLoading ? 'Guardando...' : 'Confirmar despacho — pasar a En tránsito'}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* CUADRO 2 — Estado + acción del paso actual */}
          <div className="rounded-xl bg-white border p-5 space-y-4">
            <EstadoPipeline estadoActual={estado} esReserva={esReserva} />

            {estadoPrevio && estado !== EstadoMaquina.VENDIDA && (
              <div className="rounded-lg border border-dashed border-gray-300 p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={volverAtras}
                    onChange={(e) => setVolverAtras(e.target.checked)}
                  />
                  Deseo volver al estado anterior ({ESTADO_LABELS[estadoPrevio]})
                </label>
                {volverAtras && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleVolverAtras}
                    className="rounded-lg border border-amber-400 bg-amber-50 text-amber-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Confirmar retroceso a {ESTADO_LABELS[estadoPrevio]}
                  </button>
                )}
              </div>
            )}

            {estado === EstadoMaquina.EN_TRANSITO && (
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm text-[#6c757d]">
                  La máquina va en camino. Cuando llegue al taller, marca como recibida.
                </p>
                {maquina.fechaDespacho && (
                  <p className="text-sm">
                    Despachada el {new Date(maquina.fechaDespacho).toLocaleDateString('es-BO')}
                  </p>
                )}
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-sm mb-1">Fecha de llegada al taller</label>
                    <input
                      type="date"
                      value={fechaRecibida}
                      onChange={(e) => setFechaRecibida(e.target.value)}
                      className="rounded-lg border px-3 py-2"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleConfirmarRecibida}
                    className="rounded-lg bg-cyan-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {actionLoading ? '...' : 'Marcar recibida en taller'}
                  </button>
                </div>
              </div>
            )}

            {estado === EstadoMaquina.RECIBIDA && (
              <form onSubmit={handleRecepcion} className="space-y-4 border-t pt-4">
                <p className="text-sm font-medium">Verificar cómo llegó la máquina (descargo del contenedor)</p>
                <textarea
                  value={recepcionDesc}
                  onChange={(e) => setRecepcionDesc(e.target.value)}
                  rows={3}
                  placeholder="Ej: Llegó con plato, sin garras. Bomba dañada..."
                  className="w-full rounded-lg border px-3 py-2"
                  required
                />
                <ImagePicker
                  label="Fotos de llegada (máx. 10)"
                  files={fotosLlegada}
                  onChange={setFotosLlegada}
                  disabled={actionLoading}
                />
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-[#1a1a1a] text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {actionLoading ? 'Guardando...' : 'Confirmar recepción → Diagnóstico'}
                </button>
              </form>
            )}

            {estado === EstadoMaquina.EN_DIAGNOSTICO && (
              <DiagnosticoPanel
                maquinaId={params.id}
                empleados={empleados}
                asignaciones={asignacionesDiagnostico}
                onUpdated={load}
                onListaParaVenta={notifyListaParaVenta}
                maquinaNombre={maquina.nombre}
              />
            )}

            {estado === EstadoMaquina.EN_MANTENIMIENTO && (
              <MantenimientoPanel
                maquinaId={params.id}
                trabajos={intervencionesMantenimiento}
                uploading={uploading}
                onUpload={async (files) => uploadPhotos(EtapaImagen.OTRA, files)}
                onUpdated={load}
                onListaParaVenta={pasarListaParaVenta}
                actionLoading={actionLoading}
                hayPendientesAprobacion={hayPendientesAprobacion}
                hayTrabajoAprobado={hayTrabajoAprobado}
                onAprobar={aprobarIntervencion}
                onRechazar={rechazarIntervencion}
              />
            )}

            {estado === EstadoMaquina.LISTA_PARA_VENTA && (
              <PreciosListaVentaPanel
                precioCompraUsd={maquina.precioCompraUsd}
                precioVentaUsd={maquina.precioVentaUsd}
                maquinaNombre={maquina.nombre}
                onSave={savePrecio}
              />
            )}
          </div>

          {/* CUADRO 3 — Historial */}
          <div className="rounded-xl bg-white border p-6 space-y-6">
            <h3 className="font-semibold text-lg">Historial</h3>

            {maquina.historialEstados && maquina.historialEstados.length > 0 && (
              <div>
                <p className="text-sm font-medium text-[#6c757d] mb-3">Cambios de estado</p>
                <div className="space-y-2">
                  {maquina.historialEstados.map((h) => (
                    <div key={h.id} className="text-sm border-l-4 border-gray-300 pl-3">
                      <p className="font-medium">
                        {h.anterior ? `${ESTADO_LABELS[h.anterior]} → ` : ''}
                        {ESTADO_LABELS[h.estado]}
                      </p>
                      <p className="text-[#6c757d] text-xs">
                        {new Date(h.createdAt).toLocaleString('es-BO')} — {h.creadoPor.nombre}
                        {h.motivo ? ` — ${h.motivo}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {maquina.intervenciones && maquina.intervenciones.length > 0 && (
              <div>
                <p className="text-sm font-medium text-[#6c757d] mb-3">Auditoría de trabajos</p>
                <div className="space-y-3">
                  {maquina.intervenciones.map((i) => (
                    <div key={i.id} className="border-l-4 border-[#f5c842] pl-4 py-1 text-sm">
                      <div className="flex flex-wrap gap-2 text-xs text-[#6c757d]">
                        <span>{new Date(i.createdAt).toLocaleString('es-BO')}</span>
                        <span>•</span>
                        <span>{TIPO_INTERVENCION_LABELS[i.tipo]}</span>
                        <span>•</span>
                        <span>{AREA_LABELS[i.area]}</span>
                      </div>
                      <p className="mt-1">{i.descripcion}</p>
                      <p className="text-[#6c757d] mt-1">
                        {i.responsableNombre ?? i.responsable?.nombreCompleto ?? '—'}
                        {i.estadoIntervencion && (
                          <> — {(i.estadoIntervencion as string).replace(/_/g, ' ')}</>
                        )}
                      </p>
                      {(i.fechaAsignacion || i.fechaInicio || i.fechaFinalizacion) && (
                        <p className="text-xs text-[#6c757d] mt-1">
                          {i.fechaAsignacion && <>Asignado: {formatDateTime(i.fechaAsignacion)}</>}
                          {i.fechaInicio && <> · Inicio: {formatDateTime(i.fechaInicio)}</>}
                          {i.fechaFinalizacion && (
                            <> · Fin: {formatDateTime(i.fechaFinalizacion)}</>
                          )}
                        </p>
                      )}
                      {i.detalleTrabajo && (
                        <p className="mt-1 bg-gray-50 p-2 rounded text-xs">{i.detalleTrabajo}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!maquina.historialEstados?.length && !maquina.intervenciones?.length) && (
              <p className="text-sm text-[#6c757d]">Sin registros aún.</p>
            )}
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
