'use client';

import { FormEvent, useEffect, useState } from 'react';
import { EstadoIntervencion, IntervencionDto } from '@retimax/shared-types';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import { ImagePicker } from '@/components/ImagePicker';
import { apiFetch } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { maquinaDetalleLinea, maquinaNombrePrincipal } from '@/lib/maquina-display';
import { AREA_LABELS, ESTADO_LABELS, TIPO_INTERVENCION_LABELS } from '@/lib/labels';

const ESTADO_INTERVENCION_LABELS: Record<EstadoIntervencion, string> = {
  ASIGNADO: 'Asignado',
  EN_PROCESO: 'En proceso',
  FINALIZADO: 'Finalizado (pendiente aprobación)',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  CANCELADO: 'Cancelado',
};

export default function MisTrabajosPage() {
  const [trabajos, setTrabajos] = useState<IntervencionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [fotosPorTrabajo, setFotosPorTrabajo] = useState<Record<string, File[]>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<IntervencionDto[]>('/mis-trabajos');
      setTrabajos(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function subirFotos(trabajoId: string) {
    const files = fotosPorTrabajo[trabajoId] ?? [];
    if (!files.length) return;
    setUploadingId(trabajoId);
    setError('');
    try {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));
      await apiFetch(`/intervenciones/${trabajoId}/imagenes/lote`, { method: 'POST', body: form });
      setFotosPorTrabajo((p) => ({ ...p, [trabajoId]: [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir fotos');
    } finally {
      setUploadingId(null);
    }
  }

  async function iniciar(id: string) {
    setError('');
    setActionId(id);
    try {
      await apiFetch(`/intervenciones/${id}/iniciar`, {
        method: 'PATCH',
        body: JSON.stringify({ detalleTrabajo: detalle || undefined }),
      });
      setDetalle('');
      await load();
      await subirFotos(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar');
    } finally {
      setActionId(null);
    }
  }

  async function finalizar(e: FormEvent, id: string) {
    e.preventDefault();
    setError('');
    setActionId(id);
    try {
      await apiFetch(`/intervenciones/${id}/finalizar`, {
        method: 'PATCH',
        body: JSON.stringify({ detalleTrabajo: detalle, observaciones: observaciones || undefined }),
      });
      await subirFotos(id);
      setDetalle('');
      setObservaciones('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al finalizar');
    } finally {
      setActionId(null);
    }
  }

  function puedeSubirFotos(estado?: EstadoIntervencion) {
    return (
      estado === EstadoIntervencion.ASIGNADO ||
      estado === EstadoIntervencion.EN_PROCESO ||
      estado === EstadoIntervencion.RECHAZADO
    );
  }

  return (
    <AuthGuard empleadoOnly>
      <AppShell>
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Mis trabajos</h2>
            <p className="text-sm text-[#6c757d]">Solo ves las asignaciones que te corresponden</p>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          {loading ? (
            <p className="text-[#6c757d]">Cargando...</p>
          ) : trabajos.length === 0 ? (
            <div className="rounded-xl bg-white border p-8 text-center text-[#6c757d]">
              No tienes trabajos asignados por el momento.
            </div>
          ) : (
            <div className="space-y-4">
              {trabajos.map((t) => (
                <div key={t.id} className="rounded-xl bg-white border p-6 space-y-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {t.maquina?.nombre
                          ? maquinaNombrePrincipal({ nombre: t.maquina.nombre })
                          : 'Máquina'}
                      </h3>
                      {t.maquina && (
                        <p className="text-base text-[#6c757d]">
                          {maquinaDetalleLinea({
                            tipo: t.maquina.tipo ?? '',
                            marca: t.maquina.marca ?? '',
                            modelo: t.maquina.modelo ?? '',
                            anio: null,
                          })}
                        </p>
                      )}
                      <p className="text-sm text-[#6c757d]">
                        {TIPO_INTERVENCION_LABELS[t.tipo]} / {AREA_LABELS[t.area]}
                      </p>
                    </div>
                    <span className="text-xs bg-[#f5c842]/30 text-[#1a1a1a] px-2 py-1 rounded-full font-medium">
                      {t.estadoIntervencion
                        ? ESTADO_INTERVENCION_LABELS[t.estadoIntervencion]
                        : 'Asignado'}
                    </span>
                  </div>
                  <p className="text-sm">{t.descripcion}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[#6c757d] bg-gray-50 rounded-lg p-3">
                    <p>
                      <span className="font-medium text-[#1a1a1a]">Asignado:</span>{' '}
                      {formatDateTime(t.fechaAsignacion ?? t.createdAt)}
                    </p>
                    <p>
                      <span className="font-medium text-[#1a1a1a]">Inicio:</span>{' '}
                      {formatDateTime(t.fechaInicio)}
                    </p>
                    <p>
                      <span className="font-medium text-[#1a1a1a]">Finalización:</span>{' '}
                      {formatDateTime(t.fechaFinalizacion)}
                    </p>
                  </div>
                  {t.detalleTrabajo && (
                    <p className="text-sm bg-gray-50 p-3 rounded-lg">
                      <span className="font-medium">Plan de trabajo:</span> {t.detalleTrabajo}
                    </p>
                  )}
                  {t.observaciones && (
                    <p className="text-sm text-[#6c757d]">Observaciones: {t.observaciones}</p>
                  )}
                  {t.maquina?.estado && (
                    <p className="text-xs text-[#6c757d]">
                      Estado máquina: {ESTADO_LABELS[t.maquina.estado as keyof typeof ESTADO_LABELS]}
                    </p>
                  )}

                  {puedeSubirFotos(t.estadoIntervencion) && (
                    <div className="border-t pt-3">
                      <ImagePicker
                        label="Fotos de respaldo del trabajo (opcional)"
                        disabled={actionId === t.id}
                        files={fotosPorTrabajo[t.id] ?? []}
                        onChange={(files) =>
                          setFotosPorTrabajo((p) => ({ ...p, [t.id]: files }))
                        }
                        onUpload={async (files) => {
                          setFotosPorTrabajo((p) => ({ ...p, [t.id]: files }));
                          setUploadingId(t.id);
                          try {
                            const form = new FormData();
                            files.forEach((f) => form.append('files', f));
                            await apiFetch(`/intervenciones/${t.id}/imagenes/lote`, {
                              method: 'POST',
                              body: form,
                            });
                            setFotosPorTrabajo((p) => ({ ...p, [t.id]: [] }));
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Error al subir fotos');
                          } finally {
                            setUploadingId(null);
                          }
                        }}
                        uploading={uploadingId === t.id}
                      />
                    </div>
                  )}

                  {t.estadoIntervencion === EstadoIntervencion.ASIGNADO && (
                    <div className="border-t pt-3 space-y-2">
                      <textarea
                        value={detalle}
                        onChange={(e) => setDetalle(e.target.value)}
                        placeholder="Detalla qué vas a hacer..."
                        rows={3}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => iniciar(t.id)}
                        disabled={actionId === t.id}
                        className="rounded-lg bg-[#1a1a1a] text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        {actionId === t.id ? '...' : 'Iniciar trabajo'}
                      </button>
                    </div>
                  )}

                  {(t.estadoIntervencion === EstadoIntervencion.EN_PROCESO ||
                    t.estadoIntervencion === EstadoIntervencion.RECHAZADO) && (
                    <form onSubmit={(e) => finalizar(e, t.id)} className="border-t pt-3 space-y-2">
                      <textarea
                        value={detalle}
                        onChange={(e) => setDetalle(e.target.value)}
                        placeholder="Detalle completo del trabajo realizado *"
                        rows={4}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        required
                      />
                      <textarea
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder="Observaciones adicionales"
                        rows={2}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={actionId === t.id}
                        className="rounded-lg bg-green-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        {actionId === t.id ? '...' : 'Finalizar y enviar a aprobación'}
                      </button>
                    </form>
                  )}

                  {t.estadoIntervencion === EstadoIntervencion.FINALIZADO && (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      Trabajo enviado. Esperando aprobación del administrador.
                    </p>
                  )}

                  {t.estadoIntervencion === EstadoIntervencion.APROBADO && (
                    <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                      Trabajo aprobado y registrado en el historial de la máquina.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
