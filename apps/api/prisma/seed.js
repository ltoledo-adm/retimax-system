const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function backfillUsernames() {
  await prisma.$executeRawUnsafe(`
    UPDATE usuarios
    SET username = LOWER(SPLIT_PART(email, '@', 1))
    WHERE username IS NULL OR TRIM(username) = '';
  `);
}

async function upsertUsuario({ email, username, nombre, passwordHash, rol, empleadoId }) {
  const existing = await prisma.usuario.findUnique({ where: { email } });
  if (existing) {
    return prisma.usuario.update({
      where: { id: existing.id },
      data: {
        username,
        nombre,
        rol,
        empleadoId,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
  }

  return prisma.usuario.create({
    data: {
      email,
      username,
      nombre,
      passwordHash,
      rol,
      empleadoId,
    },
  });
}

async function main() {
  await backfillUsernames();

  const passwordHash = await bcrypt.hash('Admin123!', 12);

  const admin = await upsertUsuario({
    email: 'admin@retimax.local',
    username: 'admin',
    nombre: 'Administrador RETIMAX',
    passwordHash,
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

  const empPassword = await bcrypt.hash('Empleado123!', 12);
  const empleado = await prisma.empleado.upsert({
    where: { email: 'alex@retimax.local' },
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
    email: 'alex@retimax.local',
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
  .finally(() => prisma.$disconnect());
