'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ClienteDto, EstadoMaquina, MaquinaDto, PedidoDto, ReciboReservaDto } from '@retimax/shared-types';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import { ClienteModal } from '@/components/ClienteModal';
import { ReciboPrint } from '@/components/ReciboPrint';
import { apiFetch } from '@/lib/api';
import { formatDecimal } from '@/lib/numbers';

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoDto[]>([]);
  const [clientes, setClientes] = useState<ClienteDto[]>([]);
  const [maquinas, setMaquinas] = useState<MaquinaDto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [editPedidoId, setEditPedidoId] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState('');
  const [maquinaId, setMaquinaId] = useState('');
  const [crearMaquina, setCrearMaquina] = useState(false);
  const [mqNombre, setMqNombre] = useState('');
  const [mqTipo, setMqTipo] = useState('');
  const [mqMarca, setMqMarca] = useState('');
  const [mqModelo, setMqModelo] = useState('');
  const [mqAnio, setMqAnio] = useState(String(new Date().getFullYear()));
  const [descripcion, setDescripcion] = useState('');
  const [anticipo, setAnticipo] = useState('');
  const [total, setTotal] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recibo, setRecibo] = useState<ReciboReservaDto | null>(null);

  const saldo = (() => {
    const t = parseFloat(total.replace(',', '.'));
    const a = parseFloat(anticipo.replace(',', '.'));
    if (Number.isNaN(t) || Number.isNaN(a)) return '';
    return Math.max(0, t - a).toFixed(2);
  })();

  async function load() {
    const [p, c, m] = await Promise.all([
      apiFetch<PedidoDto[]>('/pedidos'),
      apiFetch<ClienteDto[]>('/clientes'),
      apiFetch<MaquinaDto[]>('/maquinas'),
    ]);
    setPedidos(p);
    setClientes(c);
    setMaquinas(m.filter((x) => x.estado === EstadoMaquina.LISTA_PARA_VENTA));
  }

  useEffect(() => {
    load();
  }, []);

  function onMaquinaChange(id: string) {
    setMaquinaId(id);
    const m = maquinas.find((x) => x.id === id);
    if (m?.precioVentaUsd && !total) setTotal(m.precioVentaUsd);
  }

  function resetForm() {
    setClienteId('');
    setMaquinaId('');
    setCrearMaquina(false);
    setMqNombre('');
    setMqTipo('');
    setMqMarca('');
    setMqModelo('');
    setMqAnio(String(new Date().getFullYear()));
    setDescripcion('');
    setAnticipo('');
    setTotal('');
    setEditPedidoId(null);
  }

  function startEdit(p: PedidoDto) {
    setEditPedidoId(p.id);
    setClienteId(p.clienteId);
    setMaquinaId(p.maquinaId ?? '');
    setDescripcion(p.descripcionReferencia ?? '');
    setAnticipo(p.anticipoUsd);
    setTotal(p.totalUsd);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const anticipoUsd = formatDecimal(anticipo);
      const totalUsd = formatDecimal(total);
      if (!anticipoUsd || !totalUsd) {
        throw new Error('Anticipo y total deben ser números válidos');
      }
      const saldoUsd = formatDecimal(saldo) ?? '0';

      if (editPedidoId) {
        await apiFetch(`/pedidos/${editPedidoId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            clienteId,
            maquinaId: maquinaId || undefined,
            descripcionReferencia: descripcion || undefined,
            anticipoUsd,
            saldoUsd,
            totalUsd,
          }),
        });
        setShowForm(false);
        resetForm();
        await load();
        return;
      }

      const pedido = await apiFetch<PedidoDto>('/pedidos', {
        method: 'POST',
        body: JSON.stringify({
          clienteId,
          maquinaId: crearMaquina ? undefined : maquinaId || undefined,
          nuevaMaquina: crearMaquina
            ? {
                nombre: mqNombre.trim(),
                tipo: mqTipo.trim() || undefined,
                marca: mqMarca.trim(),
                modelo: mqModelo.trim(),
                anio: Number(mqAnio),
              }
            : undefined,
          descripcionReferencia: descripcion || undefined,
          anticipoUsd,
          saldoUsd,
          totalUsd,
        }),
      });
      if (pedido.id) {
        const r = await apiFetch<ReciboReservaDto>(`/pedidos/${pedido.id}/recibo`);
        setRecibo(r);
      }
      setShowForm(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar pedido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGuard adminOnly>
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Pedidos / Reservas</h2>
            <button
              onClick={() => {
                resetForm();
                setShowForm(!showForm);
              }}
              className="rounded-lg bg-[#f5c842] px-4 py-2 font-semibold text-sm"
            >
              + Nuevo pedido
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="rounded-xl bg-white border p-6 space-y-3">
              <h3 className="font-semibold">{editPedidoId ? 'Editar reserva' : 'Nueva reserva'}</h3>
              <div className="flex gap-2 items-end">
                <select
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
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
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={crearMaquina}
                  onChange={(e) => {
                    setCrearMaquina(e.target.checked);
                    if (e.target.checked) setMaquinaId('');
                  }}
                />
                Registrar nueva máquina (quedará en estado Reservada)
              </label>
              {crearMaquina ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border p-3 bg-gray-50">
                  <input
                    value={mqNombre}
                    onChange={(e) => setMqNombre(e.target.value)}
                    placeholder="Nombre *"
                    className="rounded-lg border px-3 py-2 sm:col-span-2"
                    required
                  />
                  <input
                    value={mqTipo}
                    onChange={(e) => setMqTipo(e.target.value)}
                    placeholder="Tipo"
                    className="rounded-lg border px-3 py-2"
                  />
                  <input
                    value={mqMarca}
                    onChange={(e) => setMqMarca(e.target.value)}
                    placeholder="Marca *"
                    className="rounded-lg border px-3 py-2"
                    required
                  />
                  <input
                    value={mqModelo}
                    onChange={(e) => setMqModelo(e.target.value)}
                    placeholder="Modelo *"
                    className="rounded-lg border px-3 py-2"
                    required
                  />
                  <input
                    type="number"
                    value={mqAnio}
                    onChange={(e) => setMqAnio(e.target.value)}
                    placeholder="Año *"
                    className="rounded-lg border px-3 py-2"
                    required
                  />
                </div>
              ) : (
                <select
                  value={maquinaId}
                  onChange={(e) => onMaquinaChange(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="">Máquina existente (lista para venta)</option>
                  {maquinas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                      {m.precioVentaUsd ? ` — $${m.precioVentaUsd}` : ''}
                    </option>
                  ))}
                </select>
              )}
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Descripción de referencia"
                className="w-full rounded-lg border px-3 py-2"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  value={anticipo}
                  onChange={(e) => setAnticipo(e.target.value)}
                  placeholder="Anticipo USD"
                  className="rounded-lg border px-3 py-2"
                  required
                />
                <input
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  placeholder="Total USD"
                  className="rounded-lg border px-3 py-2"
                  required
                />
                <input
                  value={saldo}
                  readOnly
                  placeholder="Saldo (auto)"
                  className="rounded-lg border px-3 py-2 bg-gray-50"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-[#1a1a1a] text-white px-4 py-2 text-sm disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : editPedidoId ? 'Guardar cambios' : 'Guardar pedido'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {pedidos.map((p) => (
              <div key={p.id} className="rounded-xl bg-white border p-4">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-semibold">{p.cliente?.nombre}</p>
                    <p className="text-sm text-[#6c757d]">
                      {p.maquina?.nombre ?? p.descripcionReferencia ?? 'Sin máquina vinculada'}
                    </p>
                  </div>
                  <span className="text-sm font-medium shrink-0">{p.estado}</span>
                </div>
                <p className="text-sm mt-2">
                  Total: ${p.totalUsd} — Anticipo: ${p.anticipoUsd} — Saldo: ${p.saldoUsd}
                </p>
                <div className="flex flex-wrap gap-3 mt-2">
                  {p.reciboReserva && (
                    <button
                      type="button"
                      onClick={async () => {
                        const r = await apiFetch<ReciboReservaDto>(`/pedidos/${p.id}/recibo`);
                        setRecibo(r);
                      }}
                      className="text-xs underline"
                    >
                      Ver / imprimir recibo {p.reciboReserva.numero}
                    </button>
                  )}
                  <button type="button" onClick={() => startEdit(p)} className="text-xs underline text-[#6c757d]">
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ClienteModal
          open={showClienteModal}
          onClose={() => setShowClienteModal(false)}
          onCreated={(c) => {
            setClientes((prev) => [...prev, c]);
            setClienteId(c.id);
          }}
        />

        {recibo && (
          <ReciboPrint
            title="Recibo de reserva"
            numero={recibo.numero}
            fechaEmision={recibo.fechaEmision}
            onClose={() => setRecibo(null)}
          >
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-[#6c757d]">Cliente:</span> {recibo.pedido?.cliente.nombre}
              </p>
              {recibo.pedido?.maquina && (
                <p>
                  <span className="text-[#6c757d]">Máquina:</span> {recibo.pedido.maquina.nombre}
                </p>
              )}
              <hr className="my-3" />
              <p>
                Total: <strong>${recibo.pedido?.totalUsd}</strong> USD
              </p>
              <p>Anticipo: ${recibo.pedido?.anticipoUsd} USD</p>
              <p>Saldo pendiente: ${recibo.pedido?.saldoUsd} USD</p>
              <p className="text-xs text-[#6c757d] mt-2">
                Vigencia: {recibo.vigenciaDias} días
              </p>
            </div>
          </ReciboPrint>
        )}
      </AppShell>
    </AuthGuard>
  );
}
