'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  CreateEmpleadoRequest,
  EmpleadoDto,
  Especialidad,
} from '@retimax/shared-types';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import { apiFetch } from '@/lib/api';
import {
  passwordMeetsPolicy,
  suggestEmpleadoEmail,
  suggestEmpleadoUsername,
  SUGGESTED_EMPLEADO_PASSWORD,
} from '@/lib/empleado-suggestions';

const ESPECIALIDADES: { value: Especialidad; label: string }[] = [
  { value: Especialidad.MECANICO, label: 'Mecánico' },
  { value: Especialidad.ELECTRICO, label: 'Eléctrico' },
  { value: Especialidad.PINTOR, label: 'Pintor' },
  { value: Especialidad.MANTENIMIENTO_GENERAL, label: 'Mantenimiento general' },
  { value: Especialidad.OTRO, label: 'Otro' },
];

export default function EmpleadosPage() {
  const [empleados, setEmpleados] = useState<EmpleadoDto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EmpleadoDto | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [emailManual, setEmailManual] = useState(false);
  const [usernameManual, setUsernameManual] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otraEspecialidad, setOtraEspecialidad] = useState('');
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    carnet: '',
    username: '',
    email: '',
    telefono: '',
    password: SUGGESTED_EMPLEADO_PASSWORD,
    especialidad: Especialidad.MECANICO as Especialidad,
  });

  async function load() {
    setListLoading(true);
    try {
      const data = await apiFetch<EmpleadoDto[]>('/empleados');
      setEmpleados(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar empleados');
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (editing || emailManual) return;
    const suggested = suggestEmpleadoEmail(form.nombre, form.apellido);
    if (suggested) {
      setForm((prev) => ({ ...prev, email: suggested }));
    }
  }, [form.nombre, form.apellido, editing, emailManual]);

  useEffect(() => {
    if (editing || usernameManual) return;
    const suggested = suggestEmpleadoUsername(form.carnet, form.nombre, form.apellido);
    if (suggested) {
      setForm((prev) => ({ ...prev, username: suggested }));
    }
  }, [form.carnet, form.nombre, form.apellido, editing, usernameManual]);

  function resetForm() {
    setForm({
      nombre: '',
      apellido: '',
      carnet: '',
      username: '',
      email: '',
      telefono: '',
      password: SUGGESTED_EMPLEADO_PASSWORD,
      especialidad: Especialidad.MECANICO,
    });
    setEmailManual(false);
    setUsernameManual(false);
    setShowPassword(false);
    setOtraEspecialidad('');
    setEditing(null);
    setShowForm(false);
  }

  function startEdit(emp: EmpleadoDto) {
    setEditing(emp);
    setEmailManual(true);
    setUsernameManual(true);
    setForm({
      nombre: emp.nombre,
      apellido: emp.apellido,
      carnet: emp.carnet ?? '',
      username: emp.username ?? '',
      email: emp.email,
      telefono: emp.telefono ?? '',
      password: '',
      especialidad: emp.especialidad,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!editing && !passwordMeetsPolicy(form.password)) {
      setError('La contraseña debe tener al menos 8 caracteres, mayúsculas, minúsculas, números y un símbolo.');
      return;
    }
    if (editing && form.password && !passwordMeetsPolicy(form.password)) {
      setError('La nueva contraseña no cumple la política de seguridad.');
      return;
    }

    setLoading(true);
    try {
      if (editing) {
        await apiFetch(`/empleados/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            nombre: form.nombre,
            apellido: form.apellido,
            carnet: form.carnet || undefined,
            email: form.email,
            telefono: form.telefono || undefined,
            especialidad: form.especialidad,
            ...(form.password ? { password: form.password } : {}),
          }),
        });
      } else {
        const payload: CreateEmpleadoRequest = {
          nombre: form.nombre,
          apellido: form.apellido,
          carnet: form.carnet || undefined,
          username: form.username || undefined,
          email: form.email,
          password: form.password,
          especialidad: form.especialidad,
          telefono: form.telefono || undefined,
        };
        await apiFetch('/empleados', { method: 'POST', body: JSON.stringify(payload) });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar empleado');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Eliminar a ${nombre}? Ya no podrá entrar al sistema.`)) return;
    try {
      await apiFetch(`/empleados/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el empleado');
    }
  }

  return (
    <AuthGuard adminOnly>
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <h2 className="text-2xl font-bold">Empleados</h2>
              <p className="text-sm text-[#6c757d]">Trabajadores del taller con acceso al sistema</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="rounded-lg bg-[#f5c842] px-4 py-2.5 font-semibold text-sm w-full sm:w-auto"
            >
              + Nuevo empleado
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="rounded-xl bg-white border p-4 sm:p-6 space-y-4">
              <h3 className="font-semibold">{editing ? 'Editar empleado' : 'Registrar empleado'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Nombre *"
                  className="rounded-lg border px-3 py-2.5"
                  required
                />
                <input
                  value={form.apellido}
                  onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                  placeholder="Apellido *"
                  className="rounded-lg border px-3 py-2.5"
                  required
                />
                <input
                  value={form.carnet}
                  onChange={(e) => setForm({ ...form, carnet: e.target.value })}
                  placeholder="Carnet (usuario sugerido)"
                  className="rounded-lg border px-3 py-2.5"
                />
                <input
                  value={form.username}
                  onChange={(e) => {
                    setUsernameManual(true);
                    setForm({ ...form, username: e.target.value });
                  }}
                  placeholder="Usuario de acceso *"
                  className="rounded-lg border px-3 py-2.5"
                  required={!editing}
                  disabled={!!editing}
                />
                <div className="sm:col-span-2">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => {
                      setEmailManual(true);
                      setForm({ ...form, email: e.target.value });
                    }}
                    placeholder="Email de contacto *"
                    className="w-full rounded-lg border px-3 py-2.5"
                    required
                  />
                  {!editing && form.nombre && form.apellido && (
                    <p className="text-xs text-[#6c757d] mt-1">
                      Email sugerido: {suggestEmpleadoEmail(form.nombre, form.apellido)}
                      {form.carnet && (
                        <> · Usuario sugerido: {suggestEmpleadoUsername(form.carnet, form.nombre, form.apellido)}</>
                      )}
                    </p>
                  )}
                </div>
                <input
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="Teléfono"
                  className="rounded-lg border px-3 py-2.5"
                />
                <div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder={editing ? 'Nueva contraseña (opcional)' : 'Contraseña *'}
                      className="w-full rounded-lg border px-3 py-2.5 pr-10"
                      required={!editing}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6c757d] hover:text-[#1a1a1a] p-1"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? '🙈' : '👁'}
                    </button>
                  </div>
                  {!editing && (
                    <p className="text-xs text-[#6c757d] mt-1">
                      Sugerida: {SUGGESTED_EMPLEADO_PASSWORD} (8+ chars, mayús, minús, número y símbolo)
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2 flex flex-col sm:flex-row flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-0 w-full sm:min-w-[200px]">
                    <label className="block text-sm mb-1">Especialidad *</label>
                    <select
                      value={form.especialidad}
                      onChange={(e) => setForm({ ...form, especialidad: e.target.value as Especialidad })}
                      className="w-full rounded-lg border px-3 py-2.5"
                      required
                    >
                      {ESPECIALIDADES.map((e) => (
                        <option key={e.value} value={e.value}>
                          {e.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {form.especialidad === Especialidad.OTRO && (
                    <input
                      value={otraEspecialidad}
                      onChange={(e) => setOtraEspecialidad(e.target.value)}
                      placeholder="Describir especialidad"
                      className="rounded-lg border px-3 py-2.5 flex-1 min-w-0 w-full sm:min-w-[200px]"
                    />
                  )}
                </div>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-[#1a1a1a] text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : editing ? 'Actualizar' : 'Crear empleado y usuario'}
                </button>
                <button type="button" onClick={resetForm} className="rounded-lg border px-4 py-2.5 text-sm">
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {listLoading ? (
            <p className="text-[#6c757d] text-sm">Cargando...</p>
          ) : (
            <>
              <div className="hidden md:block rounded-xl bg-white border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-3">Nombre</th>
                      <th className="text-left p-3">Usuario</th>
                      <th className="text-left p-3">Carnet</th>
                      <th className="text-left p-3">Especialidad</th>
                      <th className="text-left p-3">Estado</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {empleados.map((e) => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="p-3 font-medium">{e.nombreCompleto}</td>
                        <td className="p-3">{e.username ?? '—'}</td>
                        <td className="p-3">{e.carnet ?? '—'}</td>
                        <td className="p-3">{e.especialidad.replace(/_/g, ' ')}</td>
                        <td className="p-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              e.activo ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {e.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button onClick={() => startEdit(e)} className="text-[#1a1a1a] underline text-xs">
                            Editar
                          </button>
                          <button onClick={() => handleDelete(e.id, e.nombreCompleto)} className="text-red-600 underline text-xs">
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3">
                {empleados.map((e) => (
                  <div key={e.id} className="rounded-xl bg-white border p-4 space-y-2">
                    <div className="flex justify-between gap-2">
                      <p className="font-semibold">{e.nombreCompleto}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                          e.activo ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {e.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <p className="text-sm text-[#6c757d]">
                      Usuario: {e.username ?? '—'}
                      {e.carnet ? ` · Carnet: ${e.carnet}` : ''}
                    </p>
                    <p className="text-sm">{e.especialidad.replace(/_/g, ' ')}</p>
                    <div className="flex gap-3 pt-1">
                      <button onClick={() => startEdit(e)} className="text-sm underline">
                        Editar
                      </button>
                      <button onClick={() => handleDelete(e.id, e.nombreCompleto)} className="text-sm text-red-600 underline">
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
