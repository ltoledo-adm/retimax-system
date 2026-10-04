import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function backfillUsernames() {
  await prisma.$executeRawUnsafe(`
    UPDATE usuarios
    SET username = LOWER(SPLIT_PART(email, '@', 1))
    WHERE username IS NULL OR TRIM(username) = '';
  `);
}

async function upsertUsuario(params: {
  email: string;
  username: string;
  nombre: string;
  passwordHash: string | null;
  rol: 'ADMIN' | 'EMPLEADO';
  empleadoId: string | null;
}) {
  const existing = await prisma.usuario.findUnique({ where: { email: params.email } });
  if (existing) {
    return prisma.usuario.update({
      where: { id: existing.id },
      data: {
        username: params.username,
        nombre: params.nombre,
        rol: params.rol,
        empleadoId: params.empleadoId,
        ...(params.passwordHash ? { passwordHash: params.passwordHash } : {}),
      },
    });
  }

  if (!params.passwordHash) {
    throw new Error(`Falta contraseña inicial para crear usuario ${params.email}`);
  }

  return prisma.usuario.create({
    data: {
      email: params.email,
      username: params.username,
      nombre: params.nombre,
      passwordHash: params.passwordHash,
      rol: params.rol,
      empleadoId: params.empleadoId,
    },
  });
}

async function resolvePasswordHash(
  envPassword: string | undefined,
  email: string,
  devFallback: string,
): Promise<string | null> {
  if (envPassword) {
    return bcrypt.hash(envPassword, 12);
  }
  const existing = await prisma.usuario.findUnique({ where: { email } });
  if (existing) {
    return null;
  }
  return bcrypt.hash(devFallback, 12);
}

async function main() {
  await backfillUsernames();

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@retimax.local';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPasswordHash = await resolvePasswordHash(
    process.env.ADMIN_INITIAL_PASSWORD,
    adminEmail,
    'Admin123!',
  );

  const admin = await upsertUsuario({
    email: adminEmail,
    username: adminUsername,
    nombre: 'Administrador RETIMAX',
    passwordHash: adminPasswordHash,
    rol: 'ADMIN',
    empleadoId: null,
  });

  const proveedor = await prisma.proveedor.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      nombre: 'Proveedor Italia Demo',
    },
  });

  await prisma.proveedor.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      nombre: 'Encargo / Reserva',
    },
  });

  const cliente = await prisma.cliente.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      nombre: 'Cliente Demo',
      telefono: '+591 70000000',
      notas: 'Cliente de prueba para desarrollo local',
    },
  });

  const empEmail = 'alex@retimax.local';
  const empPassword = await resolvePasswordHash(
    process.env.EMPLOYEE_DEMO_PASSWORD,
    empEmail,
    'Empleado123!',
  );
  const empleado = await prisma.empleado.upsert({
    where: { email: empEmail },
    update: { carnet: '100001' },
    create: {
      nombre: 'Alex',
      apellido: 'Demo',
      email: 'alex@retimax.local',
      carnet: '100001',
      especialidad: 'ELECTRICO',
    },
  });

  await upsertUsuario({
    email: empEmail,
    username: 'alex',
    nombre: 'Alex Demo',
    passwordHash: empPassword,
    rol: 'EMPLEADO',
    empleadoId: empleado.id,
  });

  console.log('Seed completado:', {
    admin: admin.username,
    empleado: 'alex',
    proveedor: proveedor.nombre,
    cliente: cliente.nombre,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
