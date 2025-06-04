import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authorize } from "@/lib/sessionRoleValidator";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";

const ALLOWED_ROLES = [1]; // solo administradores

function sanitizeUser(user) {
  const { password, ...rest } = user;
  return rest;
}

export async function GET(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id, 10) },
      include: { role: true },
    });
    if (!user) {
      return Status.notFound("Usuario no encontrado").toNextResponse();
    }
    return Status.ok(sanitizeUser(user), "Usuario obtenido correctamente").toNextResponse();
  } catch (error) {
    console.error("Error GET /api/v1/users/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al obtener usuario").toNextResponse();
  }
}

export async function PUT(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const body = await request.json();

  const { valid, errors } = validateSchema({
    username: "required|string|max:255",
    nombreCompleto: "required|string|max:255",
    codigo: "required|string|max:100",
    email: "required|string|email|max:255",
    password: "nullable|string|min:4|max:255",
    roleId: "required|integer",
    activo: "nullable|boolean",
  }, body);

  if (!valid) {
    return Status.unprocessableEntity("Datos inválidos", errors).toNextResponse();
  }

  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: parseInt(id, 10) },
      include: { role: true },
    });
    if (!currentUser) {
      return Status.notFound("Usuario no encontrado").toNextResponse();
    }

    if (currentUser.roleId === 1 && body.activo === false) {
      const adminCount = await prisma.user.count({
        where: { roleId: 1, activo: true, eliminado: false },
      });
      if (adminCount <= 1) {
        return Status.badRequest("No se puede desactivar porque solo hay un usuario administrador").toNextResponse();
      }
    }

    const dataToUpdate = {
      username: body.username,
      nombreCompleto: body.nombreCompleto,
      codigo: body.codigo,
      email: body.email,
      roleId: body.roleId,
    };

    if (body.password && body.password.trim() !== "") {
      dataToUpdate.password = await bcrypt.hash(body.password, 10);
    }
    if (typeof body.activo !== "undefined") {
      dataToUpdate.activo = body.activo;
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id, 10) },
      data: dataToUpdate,
      include: { role: true },
    });

    return Status.ok(sanitizeUser(updatedUser), "Usuario actualizado correctamente").toNextResponse();
  } catch (error) {
    console.error("Error PUT /api/v1/users/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al actualizar usuario").toNextResponse();
  }
}

export async function DELETE(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: parseInt(id, 10) },
    });
    if (!currentUser) {
      return Status.notFound("Usuario no encontrado").toNextResponse();
    }

    if (currentUser.roleId === 1) {
      const adminCount = await prisma.user.count({
        where: { roleId: 1, activo: true, eliminado: false },
      });
      if (adminCount <= 1) {
        return Status.badRequest("No se puede eliminar porque solo hay un usuario administrador").toNextResponse();
      }
    }

    const deletedUser = await prisma.user.update({
      where: { id: parseInt(id, 10) },
      data: { eliminado: true, activo: false },
    });

    return Status.ok(sanitizeUser(deletedUser), "Usuario eliminado correctamente").toNextResponse();
  } catch (error) {
    console.error("Error DELETE /api/v1/users/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al eliminar usuario").toNextResponse();
  }
}