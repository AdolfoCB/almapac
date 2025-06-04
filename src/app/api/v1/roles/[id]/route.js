import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorize } from "@/lib/sessionRoleValidator";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";

const ALLOWED_ROLES = [1]; // solo administradores

export async function GET(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  try {
    const role = await prisma.role.findUnique({
      where: { id: parseInt(id, 10) },
    });
    if (!role) {
      return Status.notFound("Rol no encontrado").toNextResponse();
    }
    return Status.ok(role, "Rol obtenido correctamente").toNextResponse();
  } catch (error) {
    console.error("Error fetching role:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al obtener rol").toNextResponse();
  }
}

export async function PUT(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  try {
    const body = await request.json();

    const { valid, errors } = validateSchema(
      { name: "required|string|max:255" },
      body
    );

    if (!valid) {
      return Status.unprocessableEntity("Datos inválidos", errors).toNextResponse();
    }

    const updatedRole = await prisma.role.update({
      where: { id: parseInt(id, 10) },
      data: { name: body.name },
    });

    return Status.ok(updatedRole, "Rol actualizado correctamente").toNextResponse();
  } catch (error) {
    console.error("Error updating role:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al actualizar rol").toNextResponse();
  }
}

export async function DELETE(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  try {
    const roleId = parseInt(id, 10);

    const assignedUsers = await prisma.user.count({
      where: { roleId, eliminado: false },
    });

    if (assignedUsers > 0) {
      return Status.badRequest(
        "No se puede eliminar el rol porque tiene usuarios asignados"
      ).toNextResponse();
    }

    const deletedRole = await prisma.role.delete({
      where: { id: roleId },
    });

    return Status.ok(deletedRole, "Rol eliminado correctamente").toNextResponse();
  } catch (error) {
    console.error("Error deleting role:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al eliminar rol").toNextResponse();
  }
}