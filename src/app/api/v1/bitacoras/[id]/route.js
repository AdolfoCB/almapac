// /api/v1/bitacoras/[id]/route.js

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";
import { authorize } from "@/lib/sessionRoleValidator";

const ALLOWED_ROLES = [1, 2, 7];

export async function PUT(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const bitacoraId = parseInt(id, 10);

  if (isNaN(bitacoraId) || bitacoraId <= 0) {
    return Status.badRequest("ID de bitácora inválido").toNextResponse();
  }

  try {
    const body = await request.json();

    const { valid, errors } = validateSchema({
      fechaInicio: "nullable|string|max:50",
      fecha: "nullable|string|max:50", 
      fechaCierre: "nullable|string|max:50",
      muellero: "required|string|max:255",
      turnoInicio: "nullable|string|max:50",
      turnoFin: "nullable|string|max:50",
      observaciones: "nullable|string|max:255",
      operaciones: "required|array",
    }, body);

    if (!valid) {
      return Status.unprocessableEntity("Datos de entrada inválidos", errors).toNextResponse();
    }

    // Verificar que la bitácora existe
    const bitacora = await prisma.bitacoraBarco.findUnique({
      where: { id: bitacoraId }
    });

    if (!bitacora) {
      return Status.notFound("Bitácora no encontrada").toNextResponse();
    }

    // Si no es ADMINISTRADOR ni AUDITOR_PROCESOS, verificar que sea el propietario
    if (![1, 4].includes(session.roleId)) {
      if (bitacora.userId !== parseInt(session.id, 10)) {
        return Status.forbidden("No tiene permisos para actualizar esta bitácora").toNextResponse();
      }
    }

    // Actualizar la bitácora
    const updatedBitacora = await prisma.bitacoraBarco.update({
      where: { id: bitacoraId },
      data: {
        fechaInicio: body.fechaInicio ?? bitacora.fechaInicio,
        fecha: body.fecha ?? bitacora.fecha,
        fechaCierre: body.fechaCierre ?? bitacora.fechaCierre,
        muellero: body.muellero,
        turnoInicio: body.turnoInicio ?? bitacora.turnoInicio,
        turnoFin: body.turnoFin ?? bitacora.turnoFin,
        observaciones: body.observaciones ?? bitacora.observaciones,
        estado: body.estado ?? bitacora.estado, 
        operaciones: body.operaciones,
      },
    });

    // Asegurar que operaciones sea un array
    updatedBitacora.operaciones = Array.isArray(updatedBitacora.operaciones) ? updatedBitacora.operaciones : [];

    return Status.ok(updatedBitacora, "Bitácora actualizada correctamente").toNextResponse();
  } catch (error) {
    console.error("Error PUT /api/v1/bitacoras/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Ocurrió un error al actualizar la bitácora").toNextResponse();
  }
}

export async function GET(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const bitacoraId = parseInt(id, 10);

  if (isNaN(bitacoraId) || bitacoraId <= 0) {
    return Status.badRequest("ID de bitácora inválido").toNextResponse();
  }

  try {
    const bitacora = await prisma.bitacoraBarco.findUnique({
      where: { id: bitacoraId },
      include: { barco: true }
    });

    if (!bitacora) {
      return Status.notFound("Bitácora no encontrada").toNextResponse();
    }

    // Si no es ADMINISTRADOR ni AUDITOR_PROCESOS, verificar que sea el propietario
    if (![1, 4].includes(session.roleId)) {
      if (bitacora.userId !== parseInt(session.id, 10)) {
        return Status.forbidden("No tiene permisos para ver esta bitácora").toNextResponse();
      }
    }

    // Formatear respuesta
    const formattedBitacora = {
      id: bitacora.id,
      userId: bitacora.userId,
      userName: bitacora.userName,
      barcoId: bitacora.barcoId,
      vaporBarco: bitacora.vaporBarco,
      fechaInicio: bitacora.fechaInicio,
      fecha: bitacora.fecha,
      fechaCierre: bitacora.fechaCierre,
      muellero: bitacora.muellero,
      turnoInicio: bitacora.turnoInicio,
      turnoFin: bitacora.turnoFin,
      observaciones: bitacora.observaciones,
      operaciones: Array.isArray(bitacora.operaciones) ? bitacora.operaciones : [],
      estado: bitacora.estado,
      createdAt: bitacora.createdAt,
      updatedAt: bitacora.updatedAt,
      barco: bitacora.barco,
    };

    return Status.ok(formattedBitacora, "Bitácora obtenida correctamente").toNextResponse();
  } catch (error) {
    console.error("Error GET /api/v1/bitacoras/[id]:", error);
    const prismaError = handlePrismaError(error);
    if (prismaError) return prismaError.toNextResponse();
    return Status.internalError("Ocurrió un error al obtener la bitácora").toNextResponse();
  }
}

export async function DELETE(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const bitacoraId = parseInt(id, 10);

  if (isNaN(bitacoraId) || bitacoraId <= 0) {
    return Status.badRequest("ID de bitácora inválido").toNextResponse();
  }

  try {
    const existingBitacora = await prisma.bitacoraBarco.findUnique({
      where: { id: bitacoraId }
    });

    if (!existingBitacora || existingBitacora.eliminado) {
      return Status.notFound("Bitácora no encontrada o ya eliminada").toNextResponse();
    }

    // Si no es ADMINISTRADOR ni AUDITOR_PROCESOS, verificar que sea el propietario
    if (![1, 4].includes(session.roleId)) {
      if (existingBitacora.userId !== parseInt(session.id, 10)) {
        return Status.forbidden("No tiene permisos para eliminar esta bitácora").toNextResponse();
      }
    }

    const softDeleted = await prisma.bitacoraBarco.update({
      where: { id: bitacoraId },
      data: { eliminado: true,
              estado: "ELIMINADA" },  
    });

    return Status.ok(
      { id: softDeleted.id, vaporBarco: softDeleted.vaporBarco, muellero: softDeleted.muellero },
      "Bitácora eliminada correctamente (soft delete)"
    ).toNextResponse();

  } catch (error) {
    console.error("Error DELETE /api/v1/bitacoras/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Ocurrió un error al eliminar la bitácora").toNextResponse();
  }
}