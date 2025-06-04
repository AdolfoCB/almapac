const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  // 1) Crear o actualizar los roles con IDs específicos
  const roles = [
    { id: 1, name: "Administrador" },
    { id: 2, name: "Muellero" },
    { id: 3, name: "Chequero" },
    { id: 4, name: "Auditor de Procesos" },
    { id: 5, name: "Operador" },
    { id: 6, name: "Supervisor de Mantenimiento" },
    { id: 7, name: "Muellero Chequero" }
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: { name: role.name },
      create: { id: role.id, name: role.name },
    });
  }
  console.log("Roles creados o actualizados correctamente ✅");

  // 2) Solo un usuario administrador, upsert usando username (único)
  const admin = {
    username: "Almapac",
    email: "almapac@sistemademoras.com",
    password: "Almapac2025",
    nombreCompleto: "Almapac",
    codigo: "ALMAPAC",
    roleId: 1,
  };

  const hashedPassword = await bcrypt.hash(admin.password, 10);

  await prisma.user.upsert({
    where: { username: admin.username },
    update: {},
    create: {
      username: admin.username,
      nombreCompleto: admin.nombreCompleto,
      codigo: admin.codigo,
      email: admin.email,
      password: hashedPassword,
      eliminado: false,
      activo: true,
      roleId: admin.roleId,
    },
  });
  console.log("Usuario administrador creado o actualizado correctamente ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
});
