// File: /app/api/recepcion/transportes/[id]/route.js

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorize } from "@/lib/sessionRoleValidator";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";
import { Prisma } from "@prisma/client";

// Solo ADMINISTRADOR (roleId === 1)
const ALLOWED_ROLES = [1];

export async function GET(request, { params }) {
  
  const { id } = await params;
  const empresaId = parseInt(id, 10);

  if (isNaN(empresaId)) {
    return Status.badRequest("ID inválido", { id: "Debe ser un entero" })
                 .toNextResponse();
  }
  // autorización (puedes quitar si quieres que GET sea público)
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  try {
    const empresa = await prisma.empresaTransporte.findUnique({
      where: { id: empresaId },
    });

    if (!empresa) {
      return Status.notFound("Empresa de transporte no encontrada").toNextResponse();
    }

    return Status.ok(empresa, "Empresa de transporte obtenida correctamente").toNextResponse();
  } catch (error) {
    console.error("Error GET /api/recepcion/transportes/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al obtener la empresa de transporte").toNextResponse();
  }
}

export async function PUT(request, { params }) {
  // autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const empresaId = parseInt(id, 10);

  if (isNaN(empresaId)) {
    return Status.badRequest("ID inválido", { id: "Debe ser un entero" })
                 .toNextResponse();
  }

  try {
    const body = await request.json();

    // validación esquema
    const { valid, errors } = validateSchema({
      nombre: "required|string|max:255",
      motoristas: "nullable|array",
      activo: "nullable|boolean",
      fechaRegistro: "required|string",
    }, body);

    if (!valid) {
      return Status.unprocessableEntity("Datos de entrada inválidos", errors).toNextResponse();
    }

    const nombreTrimmed = body.nombre.trim();
    const motoristasData = Array.isArray(body.motoristas) ? body.motoristas : [];

    // verificar existencia
   const existing = await prisma.empresaTransporte.findUnique({
      where: { id: empresaId },
    });
    if (!existing) {
      return Status.notFound("Empresa de transporte no encontrada").toNextResponse();
    }

    const activo = typeof body.activo === "boolean" ? body.activo : existing.activo;

    const fechaRegistro = body.fechaRegistro || existing.fechaRegistro;

    const updated = await prisma.empresaTransporte.update({
      where: { id: empresaId },
      data: {
        nombre: nombreTrimmed,
        motoristas: motoristasData,
        activo: activo,
        fechaRegistro: fechaRegistro,
      },
    });


    return Status.ok(updated, "Empresa de transporte actualizada correctamente").toNextResponse();
  } catch (error) {
    console.error("Error PUT /api/recepcion/transportes/[id]:", error);

    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();

    return Status.internalError("Error al actualizar la empresa de transporte").toNextResponse();
  }
}

export async function DELETE(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const empresaId = parseInt(id, 10);

  if (isNaN(empresaId)) {
    return Status.badRequest("ID inválido", { id: "Debe ser un entero" }).toNextResponse();
  }

  try {
    const existing = await prisma.empresaTransporte.findUnique({ where: { id: empresaId } });
    if (!existing) {
      return Status.notFound("Empresa de transporte no encontrada").toNextResponse();
    }

    // Construimos el JSON array [empresaId] como string JSON
    const jsonArrayString = JSON.stringify([empresaId]);

    const barcosConTransporte = await prisma.$queryRaw(
      Prisma.sql`
        SELECT id
        FROM barcos_recepcion
        WHERE JSON_OVERLAPS(JSON_EXTRACT(transportes, '$[*].id'), CAST(${jsonArrayString} AS JSON))
        LIMIT 1
      `
    );

    if (barcosConTransporte.length > 0) {
      return Status.conflict("No se puede eliminar. La empresa está en uso en barcos de recepción o traslado.").toNextResponse();
    }

    const deleted = await prisma.empresaTransporte.delete({ where: { id: empresaId } });

    return Status.ok(deleted, "Empresa de transporte eliminada correctamente").toNextResponse();

  } catch (error) {
    console.error("Error DELETE /api/recepcion/transportes/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();

    return Status.internalError("Error al eliminar la empresa de transporte").toNextResponse();
  }
}