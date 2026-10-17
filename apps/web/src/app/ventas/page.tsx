'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  ClienteDto,
  EstadoMaquina,
  HerramientaDto,
  MaquinaDto,
  PedidoDto,
  ReciboVentaDto,
  VentaDto,
  VentaHerramientaDto,
} from '@retimax/shared-types';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import { ClienteModal } from '@/components/ClienteModal';
import { ReciboPrint } from '@/components/ReciboPrint';
import { apiFetch } from '@/lib/api';
import { ESTADO_LABELS } from '@/lib/labels';
import { formatDecimal, multiplyDecimals, normalizeDecimal } from '@/lib/numbers';

type ReservaInfo = {
  anticipoUsd: string;
  totalUsd: string;
  saldoUsd: string;
  clienteNombre: string;
};

export default function VentasPage() {
  const [ventas, setVentas] = useState<VentaDto[]>([]);
  const [ventasHerramientas, setVentasHerramientas] = useState<VentaHerramientaDto[]>([]);
  const [herramientas, setHerramientas] = useState<HerramientaDto[]>([]);
  const [tipoVenta, setTipoVenta] = useState<'MAQUINARIA' | 'HERRAMIENTA'>('MAQUINARIA');
  const [clientes, setClientes] = useState<ClienteDto[]>([]);
  const [maquinas, setMaquinas] = useState<MaquinaDto[]>([]);
  const [pedidos, setPedidos] = useState<PedidoDto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [editVentaId, setEditVentaId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recibo, setRecibo] = useState<ReciboVentaDto | null>(null);
  const [reservaInfo, setReservaInfo] = useState<ReservaInfo | null>(null);
  const [form, setForm] = useState({
    maquinaId: '',
    clienteId: '',
    precioFinalUsd: '',
    precioFinalBob: '',
    tipoCambio: '',
    fechaEntrega: '',
  });
  const [formH, setFormH] = useState({
    herramientaId: '',
    clienteId: '',
    cantidad: '1',
    precioUnitarioUsd: '',
    tipoCambio: '',
    fechaEntrega: '',
  });

  function updateForm(patch: Partial<typeof form>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if ('precioFinalUsd' in patch || 'tipoCambio' in patch) {
        const bob = multiplyDecimals(next.precioFinalUsd, next.tipoCambio);
        if (bob) next.precioFinalBob = bob;
      }
      return next;
    });
  }

  function onMaquinaChange(maquinaId: string) {
    updateForm({ maquinaId });
    setReservaInfo(null);
    const m = maquinas.find((x) => x.id === maquinaId);
    if (!m) return;

    const patch: Partial<typeof form> = {};
    if (m.estado === EstadoMaquina.RESERVADA) {
      const pedido = pedidos.find(
        (p) => p.maquinaId === maquinaId && p.estado !== 'CANCELADO',
      );
      if (pedido) {
        patch.clienteId = pedido.clienteId;
        patch.precioFinalUsd = pedido.saldoUsd;
        setReservaInfo({
          anticipoUsd: pedido.anticipoUsd,
          totalUsd: pedido.totalUsd,
          saldoUsd: pedido.saldoUsd,
          clienteNombre: pedido.cliente?.nombre ?? '',
        });
      } else if (m.precioVentaUsd) {
        patch.precioFinalUsd = m.precioVentaUsd;
      }
    } else if (m.precioVentaUsd) {
      patch.precioFinalUsd = m.precioVentaUsd;
    }
    if (Object.keys(patch).length) updateForm(patch);
  }

  async function load() {
    const [v, c, m, p, h, vh] = await Promise.all([
      apiFetch<VentaDto[]>('/ventas'),
      apiFetch<ClienteDto[]>('/clientes'),
      apiFetch<MaquinaDto[]>('/maquinas'),
      apiFetch<PedidoDto[]>('/pedidos'),
      apiFetch<HerramientaDto[]>('/herramientas'),
      apiFetch<VentaHerramientaDto[]>('/ventas-herramientas'),
    ]);
    setVentas(v);
    setHerramientas(h);
    setVentasHerramientas(vh);
    setClientes(c);
    setPedidos(p);
    setMaquinas(
      m.filter(
        (x) => x.estado === EstadoMaquina.LISTA_PARA_VENTA || x.estado === EstadoMaquina.RESERVADA,
      ),
    );
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(venta: VentaDto) {
    setEditVentaId(venta.id);
    setForm({
      maquinaId: venta.maquinaId,
      clienteId: venta.clienteId,
      precioFinalUsd: venta.precioFinalUsd,
      precioFinalBob: venta.precioFinalBob,
      tipoCambio: venta.tipoCambio,
      fechaEntrega: venta.fechaEntrega.slice(0, 10),
    });
    setTipoVenta('MAQUINARIA');
    setShowForm(true);
    setReservaInfo(null);
  }

  function onHerramientaChange(herramientaId: string) {
    const herramienta = herramientas.find((h) => h.id === herramientaId);
    setFormH((prev) => ({
      ...prev,
      herramientaId,
      precioUnitarioUsd: herramienta?.precioCompraUsd ?? prev.precioUnitarioUsd,
    }));
  }

  async function handleSubmitHerramienta(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cantidad = Number(formH.cantidad);
      const precioUnitarioUsd = formatDecimal(formH.precioUnitarioUsd);
      const tipoCambio = formatDecimal(formH.tipoCambio, 4);
      if (!formH.herramientaId) throw new Error('Selecciona la herramienta');
      if (!Number.isInteger(cantidad) || cantidad < 1) throw new Error('La cantidad debe ser un entero mayor a 0');
      if (!precioUnitarioUsd || !tipoCambio) {
        throw new Error('Precio y tipo de cambio deben ser números válidos');
      }
      if (!formH.fechaEntrega) throw new Error('Selecciona la fecha de entrega');
      if (!formH.clienteId) throw new Error('Selecciona el cliente');

      await apiFetch('/ventas-herramientas', {
        method: 'POST',
        body: JSON.stringify({
          herramientaId: formH.herramientaId,
          clienteId: formH.clienteId,
          cantidad,
          precioUnitarioUsd,
          tipoCambio,
          fechaEntrega: formH.fechaEntrega,
        }),
      });
      setShowForm(false);
      setFormH({
        herramientaId: '',
        clienteId: '',
        cantidad: '1',
        precioUnitarioUsd: '',
        tipoCambio: '',
        fechaEntrega: '',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar la venta');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const precioFinalUsd = formatDecimal(form.precioFinalUsd);
      const tipoCambio = formatDecimal(form.tipoCambio, 4);
      const precioFinalBob =
        formatDecimal(form.precioFinalBob) ?? multiplyDecimals(form.precioFinalUsd, form.tipoCambio);

      if (!precioFinalUsd || !tipoCambio || !precioFinalBob) {
        throw new Error('Precio USD, tipo de cambio y precio BOB deben ser números válidos');
      }
      if (!form.fechaEntrega) throw new Error('Selecciona la fecha de entrega');

      if (editVentaId) {
        await apiFetch(`/ventas/${editVentaId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            clienteId: form.clienteId,
            precioFinalUsd,
            precioFinalBob,
            tipoCambio,
            fechaEntrega: form.fechaEntrega,
          }),
        });
        setEditVentaId(null);
        setShowForm(false);
        resetForm();
        await load();
        return;
      }

      const venta = await apiFetch<VentaDto>('/ventas', {
        method: 'POST',
        body: JSON.stringify({
          maquinaId: form.maquinaId,
          clienteId: form.clienteId,
          precioFinalUsd,
          precioFinalBob,
          tipoCambio,
          fechaEntrega: form.fechaEntrega,
        }),
      });
      if (venta.id) {
        const r = await apiFetch<ReciboVentaDto>(`/ventas/${venta.id}/recibo`);
        setRecibo(r);
      }
      setShowForm(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar venta');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      maquinaId: '',
      clienteId: '',
      precioFinalUsd: '',
      precioFinalBob: '',
      tipoCambio: '',
      fechaEntrega: '',
    });
    setReservaInfo(null);
  }

  const totalUsd = ventas.reduce((s, v) => s + parseFloat(v.precioFinalUsd), 0);
  const totalHerramientasUsd = ventasHerramientas.reduce((s, v) => s + parseFloat(v.precioFinalUsd), 0);
  const maquinaSel = maquinas.find((m) => m.id === form.maquinaId);
  const herramientasEnStock = herramientas.filter((h) => h.cantidad > 0);
  const totalHerramientaUsd = multiplyDecimals(formH.precioUnitarioUsd, formH.cantidad);
  const totalHerramientaBob = multiplyDecimals(totalHerramientaUsd, formH.tipoCambio);

  return (
    <AuthGuard adminOnly>
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Ventas</h2>
              <p className="text-sm text-[#6c757d]">{ventas.length} máquina(s) vendida(s)</p>
            </div>
            <button
              onClick={() => {
                setEditVentaId(null);
                resetForm();
                setShowForm(!showForm);
              }}
              className="rounded-lg bg-[#f5c842] px-4 py-2 font-semibold text-sm"
            >
              + Registrar venta
            </button>
          </div>

          {showForm && (
            <form
              onSubmit={tipoVenta === 'HERRAMIENTA' && !editVentaId ? handleSubmitHerramienta : handleSubmit}
              className="rounded-xl bg-white border p-6 space-y-3"
            >
              <h3 className="font-semibold">{editVentaId ? 'Editar venta' : 'Nueva venta'}</h3>
              {!editVentaId && (
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="tipoVenta"
                      checked={tipoVenta === 'MAQUINARIA'}
                      onChange={() => {
                        setTipoVenta('MAQUINARIA');
                        setError('');
                      }}
                    />
                    Venta de maquinaria
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="tipoVenta"
                      checked={tipoVenta === 'HERRAMIENTA'}
                      onChange={() => {
                        setTipoVenta('HERRAMIENTA');
                        setError('');
                      }}
                    />
                    Venta de herramientas
                  </label>
                </div>
              )}
              {tipoVenta === 'HERRAMIENTA' && !editVentaId ? (
                <>
                  <select
                    value={formH.herramientaId}
                    onChange={(e) => onHerramientaChange(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                    required
                  >
                    <option value="">Herramienta en stock</option>
                    {herramientasEnStock.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.nombre} — stock {h.cantidad}
                        {h.medida ? ` — ${h.medida}` : ''} (${h.precioCompraUsd})
                      </option>
                    ))}
                  </select>
                  {herramientasEnStock.length === 0 && (
                    <p className="text-amber-700 text-sm">No hay herramientas con stock. Regístrelas en Herramientas.</p>
                  )}
                  <div className="flex gap-2 items-end">
                    <select
                      value={formH.clienteId}
                      onChange={(e) => setFormH((p) => ({ ...p, clienteId: e.target.value }))}
                      className="flex-1 rounded-lg border px-3 py-2"
                      required
                    >
                      <option value="">Cliente</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowClienteModal(true)}
                      className="rounded-lg border px-3 py-2 text-sm whitespace-nowrap hover:bg-gray-50"
                    >
                      + Cliente
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-[#6c757d] mb-1">Cantidad</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={formH.cantidad}
                        onChange={(e) => setFormH((p) => ({ ...p, cantidad: e.target.value }))}
                        className="w-full rounded-lg border px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#6c757d] mb-1">Precio unitario USD</label>
                      <input
                        value={formH.precioUnitarioUsd}
                        onChange={(e) => setFormH((p) => ({ ...p, precioUnitarioUsd: e.target.value }))}
                        className="w-full rounded-lg border px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#6c757d] mb-1">Tipo de cambio</label>
                      <input
                        value={formH.tipoCambio}
                        onChange={(e) => setFormH((p) => ({ ...p, tipoCambio: e.target.value }))}
                        className="w-full rounded-lg border px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#6c757d] mb-1">Fecha de entrega</label>
                      <input
                        type="date"
                        value={formH.fechaEntrega}
                        onChange={(e) => setFormH((p) => ({ ...p, fechaEntrega: e.target.value }))}
                        className="w-full rounded-lg border px-3 py-2"
                        required
                      />
                    </div>
                  </div>
                  {totalHerramientaUsd && (
                    <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      Total: <strong>${totalHerramientaUsd} USD</strong>
                      {totalHerramientaBob ? ` / Bs ${totalHerramientaBob}` : ''}
                    </p>
                  )}
                  {error && <p className="text-red-600 text-sm">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading || herramientasEnStock.length === 0}
                      className="rounded-lg bg-[#1a1a1a] text-white px-4 py-2 text-sm disabled:opacity-50"
                    >
                      {loading ? 'Guardando...' : 'Confirmar venta'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setError('');
                      }}
                      className="rounded-lg border px-4 py-2 text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
              <>
              <select
                value={form.maquinaId}
                onChange={(e) => onMaquinaChange(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
                required
                disabled={!!editVentaId}
              >
                <option value="">Máquina (lista para venta o reservada)</option>
                {maquinas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} — {ESTADO_LABELS[m.estado]}
                    {m.precioVentaUsd ? ` ($${m.precioVentaUsd})` : ''}
                  </option>
                ))}
              </select>
              {maquinas.length === 0 && (
                <p className="text-amber-700 text-sm">
                  No hay máquinas en lista para venta o reservadas.
                </p>
              )}
              {reservaInfo && (
                <div className="text-sm bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="font-medium">Máquina reservada — {reservaInfo.clienteNombre}</p>
                  <p>
                    Anticipo pagado: <strong>${reservaInfo.anticipoUsd}</strong> — Total reserva:{' '}
                    <strong>${reservaInfo.totalUsd}</strong>
                  </p>
                  <p className="text-purple-800 mt-1">
                    Saldo pendiente por cobrar: <strong>${reservaInfo.saldoUsd} USD</strong>
                  </p>
                </div>
              )}
              {maquinaSel?.precioVentaUsd && !reservaInfo && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  Precio registrado: <strong>${maquinaSel.precioVentaUsd} USD</strong>
                </p>
              )}
              <div className="flex gap-2 items-end">
                <select
                  value={form.clienteId}
                  onChange={(e) => updateForm({ clienteId: e.target.value })}
                  className="flex-1 rounded-lg border px-3 py-2"
                  required
                >
                  <option value="">Cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowClienteModal(true)}
                  className="rounded-lg border px-3 py-2 text-sm whitespace-nowrap hover:bg-gray-50"
                >
                  + Cliente
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-[#6c757d] mb-1">Precio USD</label>
                  <input
                    value={form.precioFinalUsd}
                    onChange={(e) => updateForm({ precioFinalUsd: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6c757d] mb-1">Tipo de cambio</label>
                  <input
                    value={form.tipoCambio}
                    onChange={(e) => updateForm({ tipoCambio: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6c757d] mb-1">Precio BOB (auto)</label>
                  <input
                    value={form.precioFinalBob}
                    readOnly
                    className="w-full rounded-lg border px-3 py-2 bg-gray-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6c757d] mb-1">Fecha de entrega</label>
                  <input
                    type="date"
                    value={form.fechaEntrega}
                    onChange={(e) => updateForm({ fechaEntrega: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                    required
                  />
                </div>
              </div>
              {form.precioFinalUsd && form.tipoCambio && normalizeDecimal(form.precioFinalUsd) && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  {form.precioFinalUsd} USD × {form.tipoCambio} = <strong>Bs {form.precioFinalBob}</strong>
                </p>
              )}
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading || (!editVentaId && maquinas.length === 0)}
                  className="rounded-lg bg-[#1a1a1a] text-white px-4 py-2 text-sm disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : editVentaId ? 'Guardar cambios' : 'Confirmar venta'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditVentaId(null);
                    resetForm();
                  }}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
              </div>
              </>
              )}
            </form>
          )}

          <div className="rounded-xl bg-green-50 border border-green-200 p-5">
            <h3 className="font-semibold text-lg mb-3">Máquinas vendidas</h3>
            {ventas.length === 0 ? (
              <p className="text-sm text-[#6c757d]">Aún no hay ventas registradas.</p>
            ) : (
              <>
                <p className="text-sm mb-4">
                  Total facturado: <strong>${totalUsd.toFixed(2)} USD</strong>
                </p>
                <div className="space-y-2">
                  {ventas.map((v) => (
                    <div
                      key={v.id}
                      className="rounded-lg bg-white border p-4 flex flex-wrap justify-between gap-3"
                    >
                      <div>
                        <Link
                          href={`/maquinas/${v.maquinaId}`}
                          className="font-semibold hover:text-[#f5c842]"
                        >
                          {v.maquina?.nombre ?? 'Máquina'}
                        </Link>
                        <p className="text-sm text-[#6c757d]">Cliente: {v.cliente?.nombre}</p>
                        <p className="text-sm mt-1">
                          ${v.precioFinalUsd} USD / Bs {v.precioFinalBob} (TC {v.tipoCambio})
                        </p>
                        <div className="flex flex-wrap gap-3 mt-2">
                          {v.reciboVenta && (
                            <button
                              type="button"
                              onClick={async () => {
                                const r = await apiFetch<ReciboVentaDto>(`/ventas/${v.id}/recibo`);
                                setRecibo(r);
                              }}
                              className="text-xs underline"
                            >
                              Ver / imprimir recibo {v.reciboVenta.numero}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startEdit(v)}
                            className="text-xs underline text-[#6c757d]"
                          >
                            Editar
                          </button>
                        </div>
                      </div>
                      <span className="text-xs bg-neutral-500 text-white px-2 py-1 rounded-full h-fit">
                        Vendida
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl bg-white border p-5">
            <h3 className="font-semibold text-lg mb-3">Herramientas vendidas</h3>
            {ventasHerramientas.length === 0 ? (
              <p className="text-sm text-[#6c757d]">Aún no hay ventas de herramientas.</p>
            ) : (
              <>
                <p className="text-sm mb-4">
                  Total facturado: <strong>${totalHerramientasUsd.toFixed(2)} USD</strong>
                </p>
                <div className="space-y-2">
                  {ventasHerramientas.map((v) => (
                    <div key={v.id} className="rounded-lg border p-4">
                      <p className="font-semibold">
                        {v.herramienta?.nombre ?? 'Herramienta'} × {v.cantidad}
                      </p>
                      <p className="text-sm text-[#6c757d]">Cliente: {v.cliente?.nombre}</p>
                      <p className="text-sm mt-1">
                        ${v.precioFinalUsd} USD / Bs {v.precioFinalBob} (TC {v.tipoCambio})
                      </p>
                      <p className="text-xs text-[#6c757d] mt-1">
                        {new Date(v.createdAt).toLocaleString('es-BO')}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <ClienteModal
          open={showClienteModal}
          onClose={() => setShowClienteModal(false)}
          onCreated={(c) => {
            setClientes((prev) => [...prev, c]);
            if (tipoVenta === 'HERRAMIENTA') setFormH((p) => ({ ...p, clienteId: c.id }));
            else updateForm({ clienteId: c.id });
          }}
        />

        {recibo && (
          <ReciboPrint
            title="Recibo de venta"
            numero={recibo.numero}
            fechaEmision={recibo.fechaEmision}
            onClose={() => setRecibo(null)}
          >
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-[#6c757d]">Cliente:</span> {recibo.venta?.cliente.nombre}
              </p>
              {recibo.venta?.cliente.telefono && (
                <p>
                  <span className="text-[#6c757d]">Tel:</span> {recibo.venta.cliente.telefono}
                </p>
              )}
              <p>
                <span className="text-[#6c757d]">Máquina:</span> {recibo.venta?.maquina.nombre} (
                {recibo.venta?.maquina.tipo})
              </p>
              <hr className="my-3" />
              <p>
                <span className="text-[#6c757d]">Precio USD:</span>{' '}
                <strong>${recibo.venta?.precioFinalUsd}</strong>
              </p>
              <p>
                <span className="text-[#6c757d]">Tipo cambio:</span> {recibo.venta?.tipoCambio}
              </p>
              <p>
                <span className="text-[#6c757d]">Precio BOB:</span>{' '}
                <strong>Bs {recibo.venta?.precioFinalBob}</strong>
              </p>
              <p>
                <span className="text-[#6c757d]">Fecha entrega:</span>{' '}
                {recibo.venta?.fechaEntrega &&
                  new Date(recibo.venta.fechaEntrega).toLocaleDateString('es-BO')}
              </p>
            </div>
          </ReciboPrint>
        )}
      </AppShell>
    </AuthGuard>
  );
}
