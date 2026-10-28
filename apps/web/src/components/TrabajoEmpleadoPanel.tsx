'use client';

import { FormEvent, useState } from 'react';
import { EstadoIntervencion, IntervencionDto, TipoMarcaCalendario } from '@retimax/shared-types';
import { AvancesList } from '@/components/AvancesList';
import { ImagePicker } from '@/components/ImagePicker';
import { apiFetch } from '@/lib/api';
import { fechaHoy, formatFecha, formatDateTime } from '@/lib/dates';
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

const hoy = fechaHoy;

export function TrabajoEmpleadoPanel({
  trabajo,
  onChanged,
}: {
  trabajo: IntervencionDto;
  onChanged: () => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [inicio, setInicio] = useState(hoy());
  const [finEstimado, setFinEstimado] = useState('');
  const [precio, setPrecio] = useState(trabajo.precioMantenimientoEstimado ?? '');
  const [diario, setDiario] = useState({ descripcion: '', observaciones: '' });
  const [video, setVideo] = useState<File | null>(null);
  const [pausa, setPausa] = useState({ fecha: hoy(), motivo: '' });
  const [retoma, setRetoma] = useState({ fecha: hoy(), motivo: '' });
  const [cierre, setCierre] = useState({
    detalle: '',
    observaciones: '',
    fecha: hoy(),
  });
  const [fotos, setFotos] = useState<File[]>([]);

  const abierto =
    trabajo.estadoIntervencion === EstadoIntervencion.EN_PROCESO ||
    trabajo.estadoIntervencion === EstadoIntervencion.RECHAZADO;
  const puedeFotos =
    trabajo.estadoIntervencion === EstadoIntervencion.ASIGNADO || abierto;

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  }

  async function iniciar(e: FormEvent) {
    e.preventDefault();
    if (!finEstimado) {
      setError('Elija la fecha en que estima terminar');
      return;
    }
    await run(async () => {
      await apiFetch(`/intervenciones/${trabajo.id}/iniciar`, {
        method: 'PATCH',
        body: JSON.stringify({
          fechaInicio: inicio,
          fechaFinEstimada: finEstimado,
          precioMantenimientoEstimado: precio.trim() || undefined,
        }),
      });
    });
  }

  async function registrarDia(e: FormEvent) {
    e.preventDefault();
    if (!diario.descripcion.trim()) {
      setError('Describa lo que realizó en el día');
      return;
    }
    await run(async () => {
      const updated = await apiFetch<IntervencionDto>(`/intervenciones/${trabajo.id}/avances`, {
        method: 'POST',
        body: JSON.stringify({
          descripcion: diario.descripcion.trim(),
          observaciones: diario.observaciones.trim() || undefined,
        }),
      });
      const avance = updated.avances?.[updated.avances.length - 1];
      if (video && avance) {
        const form = new FormData();
        form.append('file', video);
        await apiFetch(`/intervenciones/${trabajo.id}/avances/${avance.id}/video`, {
          method: 'POST',
          body: form,
        });
        setVideo(null);
      }
      setDiario({ descripcion: '', observaciones: '' });
    });
  }

  async function marcar(e: FormEvent, tipo: TipoMarcaCalendario) {
    e.preventDefault();
    const actual = tipo === TipoMarcaCalendario.PAUSA ? pausa : retoma;
    await run(async () => {
      await apiFetch(`/intervenciones/${trabajo.id}/calendario`, {
        method: 'POST',
        body: JSON.stringify({ tipo, fecha: actual.fecha, motivo: actual.motivo.trim() }),
      });
      if (tipo === TipoMarcaCalendario.PAUSA) setPausa({ fecha: hoy(), motivo: '' });
      else setRetoma({ fecha: hoy(), motivo: '' });
    });
  }

  async function finalizar(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      await apiFetch(`/intervenciones/${trabajo.id}/finalizar`, {
        method: 'PATCH',
        body: JSON.stringify({
          detalleTrabajo: cierre.detalle.trim(),
          observaciones: cierre.observaciones.trim() || undefined,
          fechaFinalizacion: cierre.fecha,
        }),
      });
      if (fotos.length) {
        const form = new FormData();
        fotos.forEach((f) => form.append('files', f));
        await apiFetch(`/intervenciones/${trabajo.id}/imagenes/lote`, { method: 'POST', body: form });
        setFotos([]);
      }
      setCierre({ detalle: '', observaciones: '', fecha: hoy() });
    });
  }

  return (
    <div className="rounded-xl bg-white border p-5 space-y-3">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h3 className="font-semibold text-lg">
            {trabajo.maquina?.nombre
              ? maquinaNombrePrincipal({ nombre: trabajo.maquina.nombre })
              : 'Máquina'}
          </h3>
          {trabajo.maquina && (
            <p className="text-[#6c757d]">
              {maquinaDetalleLinea({
                tipo: trabajo.maquina.tipo ?? '',
                marca: trabajo.maquina.marca ?? '',
                modelo: trabajo.maquina.modelo ?? '',
                anio: null,
              })}
            </p>
          )}
          <p className="text-sm text-[#6c757d]">
            {TIPO_INTERVENCION_LABELS[trabajo.tipo]} / {AREA_LABELS[trabajo.area]}
          </p>
        </div>
        <span className="text-xs bg-[#f5c842]/30 text-[#1a1a1a] px-2 py-1 rounded-full font-medium h-fit">
          {trabajo.estadoIntervencion
            ? ESTADO_INTERVENCION_LABELS[trabajo.estadoIntervencion]
            : 'Asignado'}
        </span>
      </div>

      <p className="text-sm">{trabajo.descripcion}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[#6c757d] bg-gray-50 rounded-lg p-3">
        <p>
          <span className="font-medium text-[#1a1a1a]">Inicio:</span> {formatFecha(trabajo.fechaInicio)}
        </p>
        <p>
          <span className="font-medium text-[#1a1a1a]">Fin estimado:</span>{' '}
          {formatFecha(trabajo.fechaFinEstimada)}
        </p>
        <p>
          <span className="font-medium text-[#1a1a1a]">Finalización:</span>{' '}
          {formatFecha(trabajo.fechaFinalizacion)}
        </p>
      </div>

      {trabajo.precioMantenimientoEstimado && (
        <p className="text-sm">
          <span className="text-[#6c757d]">Precio estimado del mantenimiento:</span>{' '}
          <strong>${trabajo.precioMantenimientoEstimado} USD</strong>
        </p>
      )}

      {trabajo.detalleTrabajo && (
        <p className="text-sm bg-gray-50 p-3 rounded-lg">
          <span className="font-medium">Plan de trabajo:</span> {trabajo.detalleTrabajo}
        </p>
      )}

      {!!trabajo.marcasCalendario?.length && (
        <div className="space-y-1">
          <p className="text-xs font-semibold">Calendario</p>
          {trabajo.marcasCalendario.map((marca) => (
            <p key={marca.id} className="text-sm text-[#6c757d]">
              <span className="font-medium text-[#1a1a1a]">
                {formatFecha(marca.fecha)} · {marca.tipo === TipoMarcaCalendario.PAUSA ? 'Pausa' : 'Retoma'}:
              </span>{' '}
              {marca.motivo}
            </p>
          ))}
        </div>
      )}

      <AvancesList avances={trabajo.avances} />

      {trabajo.maquina?.estado && (
        <p className="text-xs text-[#6c757d]">
          Estado máquina: {ESTADO_LABELS[trabajo.maquina.estado as keyof typeof ESTADO_LABELS]}
        </p>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {puedeFotos && (
        <ImagePicker
          label="Fotos del trabajo (opcional)"
          disabled={busy}
          files={fotos}
          onChange={setFotos}
          onUpload={async (files) => {
            setFotos(files);
            setBusy(true);
            try {
              const form = new FormData();
              files.forEach((f) => form.append('files', f));
              await apiFetch(`/intervenciones/${trabajo.id}/imagenes/lote`, { method: 'POST', body: form });
              setFotos([]);
              await onChanged();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Error al subir fotos');
            } finally {
              setBusy(false);
            }
          }}
          uploading={busy}
        />
      )}

      {trabajo.estadoIntervencion === EstadoIntervencion.ASIGNADO && (
        <form onSubmit={iniciar} className="border-t pt-3 space-y-2">
          <p className="text-sm font-medium">Elija las fechas de este trabajo</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-xs text-[#6c757d]">
              Inicio
              <input
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-[#1a1a1a]"
                required
              />
            </label>
            <label className="text-xs text-[#6c757d]">
              Fin estimado
              <input
                type="date"
                value={finEstimado}
                onChange={(e) => setFinEstimado(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-[#1a1a1a]"
                required
              />
            </label>
          </div>
          <label className="block text-xs text-[#6c757d]">
            Precio estimado del mantenimiento (USD, opcional)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="Lo que estima cobrar"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-[#1a1a1a]"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[#1a1a1a] text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Empezar trabajo
          </button>
        </form>
      )}

      {abierto && (
        <div className="border-t pt-3 space-y-4">
          <form onSubmit={registrarDia} className="space-y-2">
            <p className="text-sm font-medium">Registrar trabajo del día</p>
            <textarea
              value={diario.descripcion}
              onChange={(e) => setDiario((p) => ({ ...p, descripcion: e.target.value }))}
              placeholder="Qué realizó hoy en esta máquina *"
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              required
            />
            <textarea
              value={diario.observaciones}
              onChange={(e) => setDiario((p) => ({ ...p, observaciones: e.target.value }))}
              placeholder="Observaciones del día (opcional)"
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <label className="block text-xs text-[#6c757d]">
              Video corto, unos 10 segundos (opcional). Sirve cuando la prueba se oye.
              <input
                type="file"
                accept="video/*"
                capture="environment"
                onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-[#1a1a1a]"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg border border-[#1a1a1a] px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Guardar avance del día
            </button>
          </form>

          <form onSubmit={(e) => marcar(e, TipoMarcaCalendario.PAUSA)} className="space-y-2">
            <p className="text-sm font-medium">Pausar esta máquina</p>
            <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-2">
              <input
                type="date"
                value={pausa.fecha}
                onChange={(e) => setPausa((p) => ({ ...p, fecha: e.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
                required
              />
              <input
                value={pausa.motivo}
                onChange={(e) => setPausa((p) => ({ ...p, motivo: e.target.value }))}
                placeholder="Por qué se detuvo. Ejemplo: otra máquina más urgente"
                className="rounded-lg border px-3 py-2 text-sm"
                required
              />
            </div>
            <button type="submit" disabled={busy} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">
              Guardar pausa
            </button>
          </form>

          <form onSubmit={(e) => marcar(e, TipoMarcaCalendario.RETOMA)} className="space-y-2">
            <p className="text-sm font-medium">Retomar esta máquina</p>
            <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-2">
              <input
                type="date"
                value={retoma.fecha}
                onChange={(e) => setRetoma((p) => ({ ...p, fecha: e.target.value }))}
                className="rounded-lg border px-3 py-2 text-sm"
                required
              />
              <input
                value={retoma.motivo}
                onChange={(e) => setRetoma((p) => ({ ...p, motivo: e.target.value }))}
                placeholder="Ejemplo: retomo el trabajo de esta máquina"
                className="rounded-lg border px-3 py-2 text-sm"
                required
              />
            </div>
            <button type="submit" disabled={busy} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">
              Guardar retoma
            </button>
          </form>

          <form onSubmit={finalizar} className="space-y-2">
            <p className="text-sm font-medium">Trabajo terminado</p>
            <label className="block text-xs text-[#6c757d]">
              Fecha de finalización
              <input
                type="date"
                value={cierre.fecha}
                onChange={(e) => setCierre((p) => ({ ...p, fecha: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-[#1a1a1a]"
                required
              />
            </label>
            <textarea
              value={cierre.detalle}
              onChange={(e) => setCierre((p) => ({ ...p, detalle: e.target.value }))}
              placeholder="Detalle completo del trabajo realizado *"
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              required
            />
            <textarea
              value={cierre.observaciones}
              onChange={(e) => setCierre((p) => ({ ...p, observaciones: e.target.value }))}
              placeholder="Observaciones al cerrar (opcional)"
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-green-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Enviar a aprobación
            </button>
          </form>
        </div>
      )}

      {trabajo.estadoIntervencion === EstadoIntervencion.FINALIZADO && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Trabajo enviado. Esperando aprobación del administrador.
        </p>
      )}

      {trabajo.estadoIntervencion === EstadoIntervencion.APROBADO && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
          Trabajo aprobado y registrado en el historial de la máquina.
        </p>
      )}

      {trabajo.fechaAsignacion && (
        <p className="text-xs text-[#6c757d]">Asignado: {formatDateTime(trabajo.fechaAsignacion)}</p>
      )}
    </div>
  );
}
