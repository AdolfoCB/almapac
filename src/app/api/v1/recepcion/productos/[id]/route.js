// File: /app/api/v1/recepcion/productos/[id]/route.js

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorize } from "@/lib/sessionRoleValidator";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";

const ALLOWED_ROLES = [1];

export async function GET(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const productoId = parseInt(id, 10);

  if (isNaN(productoId)) {
    return Status.badRequest("ID inválido", { id: "Debe ser un entero" })
                 .toNextResponse();
  }

  try {
    const producto = await prisma.producto.findUnique({ where: { id: productoId } });
    if (!producto) {
      return Status.notFound("Producto no encontrado").toNextResponse();
    }
    return Status.ok(producto, "Producto obtenido correctamente")
                 .toNextResponse();
  } catch (error) {
    console.error("Error GET /api/v1/productos/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status
      .internalError("Ocurrió un error al obtener el producto")
      .toNextResponse();
  }
}

export async function PUT(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const productoId = parseInt(id, 10);
    if (isNaN(productoId)) {
    return Status.badRequest("ID inválido", { id: "Debe ser un entero" })
                 .toNextResponse();
  }

  const body = await request.json();
  const { valid, errors } = validateSchema({
    nombre:      "required|string|max:255",
    descripcion: "nullable|string|max:255",
  }, body);
  if (!valid) {
    return Status.unprocessableEntity("Datos de entrada inválidos", errors)
                 .toNextResponse();
  }

  try {
    const updated = await prisma.producto.update({
      where: { id: productoId },
      data: {
        nombre:      body.nombre,
        descripcion: body.descripcion ?? null,
      },
    });
    return Status.ok(updated, "Producto actualizado correctamente")
                 .toNextResponse();
  } catch (error) {
    console.error("Error PUT /api/v1/productos/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status
      .internalError("Ocurrió un error al actualizar el producto")
      .toNextResponse();
  }
}

export async function DELETE(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const productoId = parseInt(id, 10);

  if (isNaN(productoId)) {
    return Status.badRequest("ID inválido", { id: "Debe ser un entero" })
                 .toNextResponse();
  }

  try {
    const deleted = await prisma.producto.delete({ where: { id: productoId } });
    return Status.ok(deleted, "Producto eliminado correctamente")
                 .toNextResponse();
  } catch (error) {
    console.error("Error DELETE /api/v1/productos/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status
      .internalError("Ocurrió un error al eliminar el producto")
      .toNextResponse();
  }
}