'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EtapaImagen, Moneda, ProveedorDto } from '@retimax/shared-types';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import { ImagePicker } from '@/components/ImagePicker';
import { apiFetch } from '@/lib/api';
import { MONEDA_OPCIONES } from '@/lib/moneda';

export default function NuevaMaquinaPage() {
  const router = useRouter();
  const [proveedores, setProveedores] = useState<ProveedorDto[]>([]);
  const [nombre, setNombre] = useState('');
  const [precioCompraUsd, setPrecioCompraUsd] = useState('');
  const [precioVentaUsd, setPrecioVentaUsd] = useState('');
  const [monedaCompra, setMonedaCompra] = useState<Moneda>(Moneda.USD);
  const [tipo, setTipo] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [proveedorId, setProveedorId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [nuevoProveedor, setNuevoProveedor] = useState('');
  const [fotosEmbarque, setFotosEmbarque] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<ProveedorDto[]>('/proveedores').then(setProveedores);
  }, []);

  async function addProveedor() {
    if (!nuevoProveedor.trim()) return;
    const p = await apiFetch<ProveedorDto>('/proveedores', {
      method: 'POST',
      body: JSON.stringify({ nombre: nuevoProveedor.trim() }),
    });
    setProveedores((prev) => [...prev, p]);
    setProveedorId(p.id);
    setNuevoProveedor('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const maquina = await apiFetch<{ id: string }>('/maquinas', {
        method: 'POST',
        body: JSON.stringify({
          nombre: nombre.trim(),
          precioCompraUsd: precioCompraUsd.trim()
            ? Number(precioCompraUsd).toFixed(2)
            : undefined,
          monedaCompra,
          precioVentaUsd: precioVentaUsd.trim() ? Number(precioVentaUsd).toFixed(2) : undefined,
          tipo: tipo.trim() || undefined,
          marca: marca.trim() || undefined,
          modelo: modelo.trim() || undefined,
          anio: anio.trim() ? Number(anio) : undefined,
          proveedorId,
          descripcionAcordada: descripcion || undefined,
        }),
      });

      if (fotosEmbarque.length > 0) {
        const form = new FormData();
        fotosEmbarque.forEach((f) => form.append('files', f));
        form.append('etapa', EtapaImagen.EMBARQUE);
        await apiFetch(`/maquinas/${maquina.id}/imagenes/lote`, { method: 'POST', body: form });
      }

      router.push(`/maquinas/${maquina.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGuard adminOnly>
      <AppShell>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-2">Compra de máquina</h2>
          <p className="text-[#6c757d] text-sm mb-6">Registra la compra con los datos de la máquina.</p>
          <form onSubmit={handleSubmit} className="rounded-xl bg-white border p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre *</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Escribe el nombre de la maquinaria"
                className="w-full rounded-lg border px-4 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Precio de compra</label>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_11rem] gap-2">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={precioCompraUsd}
                  onChange={(e) => setPrecioCompraUsd(e.target.value)}
                  placeholder="Opcional, se puede agregar después"
                  className="w-full rounded-lg border px-4 py-2"
                />
                <select
                  value={monedaCompra}
                  onChange={(e) => setMonedaCompra(e.target.value as Moneda)}
                  className="rounded-lg border px-3 py-2"
                  aria-label="Moneda del precio de compra"
                >
                  {MONEDA_OPCIONES.map((opcion) => (
                    <option key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-[#6c757d] mt-1">
                Puede dejarlo vacío y completarlo al editar la máquina.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Precio de venta USD</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={precioVentaUsd}
                onChange={(e) => setPrecioVentaUsd(e.target.value)}
                placeholder="Opcional. Puede ser estimado"
                className="w-full rounded-lg border px-4 py-2"
              />
              <p className="text-xs text-[#6c757d] mt-1">
                Si ya sabe a cuánto se venderá, cárguelo ahora. No hace falta esperar a que esté lista para la venta.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <input
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  placeholder="Escribe el tipo de la maquinaria"
                  className="w-full rounded-lg border px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Marca</label>
                <input
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Escribe la marca"
                  className="w-full rounded-lg border px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Modelo</label>
                <input
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="Escribe el modelo"
                  className="w-full rounded-lg border px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Año</label>
                <input
                  type="number"
                  min={1950}
                  max={2100}
                  value={anio}
                  onChange={(e) => setAnio(e.target.value)}
                  placeholder="Escribe el año"
                  className="w-full rounded-lg border px-4 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Proveedor *</label>
              <select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                className="w-full rounded-lg border px-4 py-2"
                required
              >
                <option value="">Seleccionar...</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 mt-2">
                <input
                  value={nuevoProveedor}
                  onChange={(e) => setNuevoProveedor(e.target.value)}
                  placeholder="Agregar proveedor"
                  className="flex-1 rounded-lg border px-3 py-2 text-sm"
                />
                <button type="button" onClick={addProveedor} className="rounded-lg border px-3 py-2 text-sm">
                  Agregar
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Descripción acordada</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={4}
                className="w-full rounded-lg border px-4 py-2"
                placeholder="Qué debería traer la máquina"
              />
            </div>
            <div className="border-t pt-4">
              <ImagePicker
                label="Fotos de la máquina (opcional, se pueden agregar después)"
                disabled={loading}
                files={fotosEmbarque}
                onChange={setFotosEmbarque}
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#f5c842] px-6 py-2.5 font-semibold text-[#1a1a1a] disabled:opacity-60"
            >
              {loading ? 'Guardando...' : 'Registrar compra'}
            </button>
          </form>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
