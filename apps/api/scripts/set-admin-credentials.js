/**
 * Uso (una vez en producción, dentro del contenedor api):
 *   NEW_ADMIN_USERNAME=retimax.admin NEW_ADMIN_PASSWORD='***' node scripts/set-admin-credentials.js
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const username = process.env.NEW_ADMIN_USERNAME?.trim();
  const password = process.env.NEW_ADMIN_PASSWORD;
  const email = process.env.ADMIN_EMAIL?.trim() || 'admin@retimax.local';

  if (!username || !password) {
    throw new Error('Defina NEW_ADMIN_USERNAME y NEW_ADMIN_PASSWORD');
  }

  const admin =
    (await prisma.usuario.findFirst({ where: { rol: 'ADMIN' } })) ||
    (await prisma.usuario.findUnique({ where: { email } }));

  if (!admin) {
    throw new Error('No hay usuario administrador en la base de datos');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.usuario.update({
    where: { id: admin.id },
    data: { username, passwordHash, activo: true },
  });

  console.log('Admin actualizado:', { id: admin.id, username, email: admin.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
