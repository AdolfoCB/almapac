import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authorize } from "@/lib/sessionRoleValidator";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";

const ALLOWED_ROLES = [1]; // solo admin

export async function GET(request) {
  // autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  try {
    const users = await prisma.user.findMany({
      where: { eliminado: false },
      include: { role: true },
    });
    const sanitizedUsers = users.map(({ password, ...rest }) => rest);
    return Status.ok(sanitizedUsers, "Usuarios obtenidos correctamente").toNextResponse();
  } catch (error) {
    console.error("Error fetching users:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al obtener usuarios").toNextResponse();
  }
}

export async function POST(request) {
  // autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const body = await request.json();

  // Validación de esquema
  const { valid, errors } = validateSchema({
    username:      "required|string|max:255",
    nombreCompleto: "required|string|max:255",
    codigo:        "required|string|max:100",
    email:         "required|string|email|max:255",
    password:      "required|string|min:4|max:255",
    roleId:        "required|integer",
  }, body);

  if (!valid) {
    return Status.unprocessableEntity("Datos de entrada inválidos", errors).toNextResponse();
  }

  try {
    // Validar que no exista ya un usuario con el mismo username
    const existingUser = await prisma.user.findUnique({
      where: { username: body.username }
    });
    if (existingUser) {
      return Status.conflict("Usuario ya existe. Por favor, comuníquese con el administrador.").toNextResponse();
    }

    // Hash de contraseña
    const hashedPassword = await bcrypt.hash(body.password, 10);

    const newUser = await prisma.user.create({
      data: {
        username: body.username,
        nombreCompleto: body.nombreCompleto,
        codigo: body.codigo,
        email: body.email,
        password: hashedPassword,
        roleId: body.roleId,
      },
      include: { role: true },
    });

    const { password, ...userWithoutPassword } = newUser;
    return Status.created(userWithoutPassword, "Usuario creado correctamente").toNextResponse();
  } catch (error) {
    console.error("Error creating user:", error);

    if (error.code === "P2002") {
      return Status.conflict("Usuario ya existe. Por favor, comuníquese con el administrador.").toNextResponse();
    }

    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();

    return Status.internalError("Error al crear usuario").toNextResponse();
  }
}