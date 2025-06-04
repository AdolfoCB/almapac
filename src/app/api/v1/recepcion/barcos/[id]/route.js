// File: /app/api/v1/recepcion/barcos/[id]/route.js

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";
import { authorize } from "@/lib/sessionRoleValidator";

// Sólo ADMINISTRADOR
const ALLOWED_ROLES = [1];

export async function GET(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const barcoId = parseInt(id, 10);
  if (isNaN(barcoId)) {
    return Status.badRequest("ID inválido", { id: "Debe ser un entero" })
                 .toNextResponse();
  }

  try {
    const barco = await prisma.barcoRecepcion.findUnique({
      where: { id: barcoId },
    });
    if (!barco) {
      return Status.notFound("Barco de recepción/traslado no encontrado").toNextResponse();
    }
    return Status.ok(barco, "Barco de recepción/traslado obtenido correctamente")
                 .toNextResponse();
  } catch (error) {
    console.error("Error GET /api/v1/recepcion/barcos/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
        if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status
      .internalError("Ocurrió un error al obtener el barco de recepción/traslado")
      .toNextResponse();
  }
}

export async function PUT(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const barcoId = parseInt(id, 10);
  if (isNaN(barcoId)) {
    return Status.badRequest("ID inválido", { id: "Debe ser un entero" })
                 .toNextResponse();
  }

  const body = await request.json();
  const { valid, errors } = validateSchema({
    vaporBarco:      "nullable|string",
    observaciones:   "nullable|string",
    productos:       "nullable|array",
    puntosDescarga:  "nullable|array",
    transportes:     "nullable|array",
    activo:          "nullable|boolean",
    fechaRegistro:   "required|string",
  }, body);

  if (!valid) {
    console.error("Error validando datos:", errors);
    return Status.unprocessableEntity("Datos inválidos", errors)
                 .toNextResponse();
  }

  try {
    // verificar existencia
    const existing = await prisma.barcoRecepcion.findUnique({
      where: { id: barcoId },
    });
    if (!existing) {
      return Status.notFound("Barco de recepción/traslado no encontrado").toNextResponse();
    }

    // preparar arrays: si vienen y están vacíos, los guardamos como null
    const productos = Array.isArray(body.productos)
      ? (body.productos.length ? body.productos : null)
      : undefined;
    const puntosDescarga = Array.isArray(body.puntosDescarga)
      ? (body.puntosDescarga.length ? body.puntosDescarga : null)
      : undefined;
    const transportes = Array.isArray(body.transportes)
      ? (body.transportes.length ? body.transportes : null)
      : undefined;

    const data = {
      ...(body.vaporBarco    !== undefined && { vaporBarco:    body.vaporBarco }),
      ...(body.observaciones !== undefined && { observaciones: body.observaciones }),
      ...(productos           !== undefined && { productos }),
      ...(puntosDescarga      !== undefined && { puntosDescarga }),
      ...(transportes         !== undefined && { transportes }),
      ...(body.activo       !== undefined && { activo: body.activo }),
      ...(body.fechaRegistro!== undefined && { fechaRegistro: body.fechaRegistro }),
    };

    const updated = await prisma.barcoRecepcion.update({
      where: { id: barcoId },
      data,
    });

    return Status.ok(updated, "Barco de recepción/traslado actualizado correctamente")
                 .toNextResponse();
  } catch (error) {
    console.error("Error PUT /api/v1/recepcion/barcos/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
        if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status
      .internalError("Ocurrió un error al actualizar el barco de recepción/traslado")
      .toNextResponse();
  }
}

export async function DELETE(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = params;
  const barcoId = parseInt(id, 10);
  if (isNaN(barcoId)) {
    return Status.badRequest("ID inválido", { id: "Debe ser un entero" }).toNextResponse();
  }

  try {
    // Verificar si existen recepciones asociadas a este barco
    const recepcionesCount = await prisma.recepcionTraslado.count({
      where: { barcoId },
    });

    if (recepcionesCount > 0) {
      return Status.conflict("No se puede eliminar el barco porque tiene recepciones/traslados asociados").toNextResponse();
    }

    // Si no tiene recepciones, eliminar
    const deleted = await prisma.barcoRecepcion.delete({
      where: { id: barcoId },
    });

    return Status.ok(deleted, "Barco de recepción/traslado eliminado correctamente").toNextResponse();

  } catch (error) {
    console.error("Error DELETE /api/v1/recepcion/barcos/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Ocurrió un error al eliminar el barco de recepción/traslado").toNextResponse();
  }
}