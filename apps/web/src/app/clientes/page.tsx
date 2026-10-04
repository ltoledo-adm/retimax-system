'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ClienteDto } from '@retimax/shared-types';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import { apiFetch } from '@/lib/api';

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteDto[]>([]);
  const [nombre, setNombre] = useState('');
  const [nitCi, setNitCi] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editNitCi, setEditNitCi] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editNotas, setEditNotas] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setClientes(await apiFetch<ClienteDto[]>('/clientes'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/clientes', {
        method: 'POST',
        body: JSON.stringify({
          nombre,
          nitCi: nitCi || undefined,
          telefono: telefono || undefined,
          notas: notas || undefined,
        }),
      });
      setNombre('');
      setNitCi('');
      setTelefono('');
      setNotas('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    }
  }

  function startEdit(c: ClienteDto) {
    setEditId(c.id);
    setEditNombre(c.nombre);
    setEditNitCi(c.nitCi ?? '');
    setEditTelefono(c.telefono ?? '');
    setEditNotas(c.notas ?? '');
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setError('');
    try {
      await apiFetch(`/clientes/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: editNombre,
          nitCi: editNitCi || undefined,
          telefono: editTelefono || undefined,
          notas: editNotas || undefined,
        }),
      });
      setEditId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Eliminar el cliente "${nombre}"?`)) return;
    setError('');
    try {
      await apiFetch(`/clientes/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  }

  return (
    <AuthGuard adminOnly>
      <AppShell>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Clientes</h2>
          <form onSubmit={handleSubmit} className="rounded-xl bg-white border p-4 sm:p-6 mb-6 space-y-3">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre *"
              className="w-full rounded-lg border px-3 py-2.5"
              required
            />
            <input
              value={nitCi}
              onChange={(e) => setNitCi(e.target.value)}
              placeholder="NIT / CI"
              className="w-full rounded-lg border px-3 py-2.5"
            />
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Teléfono"
              className="w-full rounded-lg border px-3 py-2.5"
            />
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas"
              className="w-full rounded-lg border px-3 py-2.5"
            />
            <button type="submit" className="rounded-lg bg-[#f5c842] px-4 py-2.5 font-semibold text-sm w-full sm:w-auto">
              Agregar cliente
            </button>
          </form>
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          {loading ? (
            <p className="text-[#6c757d] text-sm">Cargando...</p>
          ) : (
            <div className="space-y-2">
              {clientes.map((c) => (
                <div key={c.id} className="rounded-lg bg-white border p-4">
                  {editId === c.id ? (
                    <form onSubmit={saveEdit} className="space-y-2">
                      <input
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2.5"
                        required
                      />
                      <input
                        value={editNitCi}
                        onChange={(e) => setEditNitCi(e.target.value)}
                        placeholder="NIT / CI"
                        className="w-full rounded-lg border px-3 py-2.5"
                      />
                      <input
                        value={editTelefono}
                        onChange={(e) => setEditTelefono(e.target.value)}
                        placeholder="Teléfono"
                        className="w-full rounded-lg border px-3 py-2.5"
                      />
                      <textarea
                        value={editNotas}
                        onChange={(e) => setEditNotas(e.target.value)}
                        placeholder="Notas"
                        className="w-full rounded-lg border px-3 py-2.5"
                      />
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button type="submit" className="rounded-lg bg-[#1a1a1a] text-white px-3 py-2 text-sm">
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditId(null)}
                          className="rounded-lg border px-3 py-2 text-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="font-semibold">{c.nombre}</p>
                        {c.nitCi && <p className="text-sm text-[#6c757d]">NIT/CI: {c.nitCi}</p>}
                        {c.telefono && <p className="text-sm text-[#6c757d]">{c.telefono}</p>}
                        {c.notas && <p className="text-sm mt-1">{c.notas}</p>}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="text-sm text-[#6c757d] hover:text-[#1a1a1a]"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id, c.nombre)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
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
