// /app/api/v1/recepcion/[id]/route.js

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";
import { authorize } from "@/lib/sessionRoleValidator";

// =====================================================
// SISTEMA DE ESTADOS PARA RECEPCIONES
// =====================================================

import { EstadoRecepcion, determineStateFromContent, isEditable } from "@/lib/estadoRecepcion";

// Roles permitidos: ADMINISTRADOR (1), CHEQUERO (3), AUDITOR_PROCESOS (4), MUELLERO_CHEQUERO (7)
const ALLOWED_ROLES = [1, 3, 4, 7];

export async function GET(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const recepcionId = parseInt(id, 10);
  if (isNaN(recepcionId)) {
    return Status.badRequest("ID inválido", { id: "Debe ser un entero" }).toNextResponse();
  }

  try {
    // Construir whereClause con filtro de propiedad
    let whereClause = { id: recepcionId };

    // Filtro por propiedad: solo ADMINISTRADOR y AUDITOR_PROCESOS pueden ver todas
    if (![1, 4].includes(session.roleId)) {
      whereClause.userId = parseInt(session.id, 10);
    }

    const recibo = await prisma.recepcionTraslado.findFirst({
      where: whereClause,
      include: {
        barcoRecepcion: true, // incluir info del barco relacionado
        user: {
          select: {
            id: true,
            username: true,
            nombreCompleto: true
          }
        }
      },
    });

    if (!recibo) {
      return Status.notFound("Recepción/traslado no encontrada").toNextResponse();
    }

    // Procesar y asegurar campos
    const recepcionProcessed = {
      ...recibo,
      bitacoras: Array.isArray(recibo.bitacoras) ? recibo.bitacoras : [],
      estado: recibo.estado || EstadoRecepcion.CREADA,
      eliminado: recibo.eliminado || false,
      barcoRecepcion: recibo.barcoRecepcion ?? null,
    };

    return Status.ok(recepcionProcessed, "Recepción/traslado obtenida correctamente").toNextResponse();

  } catch (error) {
    console.error("Error GET /api/v1/recepcion/[id]:", error);
    const prismaError = handlePrismaError(error);
    if (prismaError) return prismaError.toNextResponse();
    return Status.internalError("Ocurrió un error al obtener la recepción/traslado").toNextResponse();
  }
}

export async function PUT(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const recepcionId = parseInt(id, 10);
  if (isNaN(recepcionId)) {
    return Status.badRequest("ID inválido", { id: "Debe ser un entero" }).toNextResponse();
  }

  const body = await request.json();

  // Validar schema incluyendo estado y eliminado
  const { valid, errors } = validateSchema({
    fechaInicio: "nullable|string|max:50",
    fecha: "nullable|string|max:50",
    fechaCierre: "nullable|string|max:50",
    producto: "nullable|string|max:255",
    nombreBarco: "nullable|string|max:255",
    chequero: "nullable|string|max:255",
    turnoInicio: "nullable|string|max:50",
    turnoFin: "nullable|string|max:50",
    puntoCarga: "nullable|string|max:255",
    puntoDescarga: "nullable|string|max:255",
    bitacoras: "required|array",
    estado: "nullable|string|max:50",
    eliminado: "nullable|boolean",
  }, body);

  if (!valid) {
    return Status.unprocessableEntity("Datos de entrada inválidos", errors).toNextResponse();
  }

  try {
    // Construir whereClause con filtro de propiedad
    let whereClause = { id: recepcionId };

    // Filtro por propiedad: solo ADMINISTRADOR y AUDITOR_PROCESOS pueden editar todas
    if (![1, 4].includes(session.roleId)) {
      whereClause.userId = parseInt(session.id, 10);
    }

    // Verificar que existe y obtener estado actual
    const recepcion = await prisma.recepcionTraslado.findFirst({
      where: whereClause,
    });

    if (!recepcion) {
      return Status.notFound("Recepción/traslado no encontrada").toNextResponse();
    }

    // Verificar si la recepción es editable (solo si no es forzado por ADMINISTRADOR)
    const estadoActual = recepcion.estado || EstadoRecepcion.CREADA;
    if (!isEditable(estadoActual) && session.roleId !== 1) {
      return Status.forbidden(
        `No se puede editar una recepción en estado ${estadoActual}`,
        { estado: estadoActual }
      ).toNextResponse();
    }

    // Determinar nuevo estado automáticamente
    const estadoNuevo = body.estado || determineStateFromContent({
      bitacoras: body.bitacoras,
      eliminado: body.eliminado ?? recepcion.eliminado,
      estado: body.estado
    });

    // Construir datos para actualizar
    const data = {
      ...(body.fechaInicio !== undefined && { fechaInicio: body.fechaInicio }),
      ...(body.fecha !== undefined && { fecha: body.fecha }),
      ...(body.fechaCierre !== undefined && { fechaCierre: body.fechaCierre }),
      ...(body.producto !== undefined && { producto: body.producto }),
      ...(body.nombreBarco !== undefined && { nombreBarco: body.nombreBarco }),
      ...(body.chequero !== undefined && { chequero: body.chequero }),
      ...(body.turnoInicio !== undefined && { turnoInicio: body.turnoInicio }),
      ...(body.turnoFin !== undefined && { turnoFin: body.turnoFin }),
      ...(body.puntoCarga !== undefined && { puntoCarga: body.puntoCarga }),
      ...(body.puntoDescarga !== undefined && { puntoDescarga: body.puntoDescarga }),
      ...(body.bitacoras !== undefined && { bitacoras: body.bitacoras }),
      estado: estadoNuevo,
      eliminado: body.eliminado ?? recepcion.eliminado,
    };

    const updated = await prisma.recepcionTraslado.update({
      where: { id: recepcionId },
      data,
    });

    // Procesar respuesta
    const updatedProcessed = {
      ...updated,
      bitacoras: Array.isArray(updated.bitacoras) ? updated.bitacoras : [],
      estado: updated.estado || EstadoRecepcion.CREADA,
      eliminado: updated.eliminado || false,
    };

    console.log(`Recepción ${recepcionId} actualizada con estado: ${estadoNuevo}`);
    return Status.ok(updatedProcessed, "Recepción/traslado actualizada correctamente").toNextResponse();

  } catch (error) {
    console.error("Error PUT /api/v1/recepcion/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Ocurrió un error al actualizar la recepción/traslado").toNextResponse();
  }
}

// =====================================================
// DELETE - Eliminar/marcar como eliminada
// =====================================================
export async function DELETE(request, { params }) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const recepcionId = parseInt(id, 10);
  if (isNaN(recepcionId)) {
    return Status.badRequest("ID inválido", { id: "Debe ser un entero" }).toNextResponse();
  }

  try {
    const url = new URL(request.url);
    const hardDelete = url.searchParams.get("hard") === "true";

    // Construir whereClause con filtro de propiedad
    let whereClause = { id: recepcionId };

    // Solo ADMINISTRADOR puede eliminar cualquier recepción
    if (session.roleId !== 1) {
      whereClause.userId = parseInt(session.id, 10);
    }

    // Verificar que existe
    const recepcion = await prisma.recepcionTraslado.findFirst({
      where: whereClause,
    });

    if (!recepcion) {
      return Status.notFound("Recepción/traslado no encontrada").toNextResponse();
    }

    // Verificar permisos de eliminación
    const estadoActual = recepcion.estado || EstadoRecepcion.CREADA;
    if (estadoActual === EstadoRecepcion.COMPLETADA && session.roleId !== 1) {
      return Status.forbidden("Solo un administrador puede eliminar recepciones completadas").toNextResponse();
    }

    if (hardDelete && session.roleId === 1) {
      // Eliminación física (solo ADMINISTRADOR)
      await prisma.recepcionTraslado.delete({
        where: { id: recepcionId },
      });
      return Status.ok(null, "Recepción/traslado eliminada permanentemente").toNextResponse();
    } else {
      // Eliminación lógica (marcar como eliminada)
      const eliminada = await prisma.recepcionTraslado.update({
        where: { id: recepcionId },
        data: {
          eliminado: true,
          estado: EstadoRecepcion.ELIMINADA,
        },
      });
      
      const eliminadaProcessed = {
        ...eliminada,
        bitacoras: Array.isArray(eliminada.bitacoras) ? eliminada.bitacoras : [],
        estado: eliminada.estado || EstadoRecepcion.ELIMINADA,
        eliminado: eliminada.eliminado || true,
      };

      return Status.ok(eliminadaProcessed, "Recepción/traslado marcada como eliminada").toNextResponse();
    }
  } catch (error) {
    console.error("Error DELETE /api/v1/recepcion/[id]:", error);
    const prismaError = handlePrismaError(error);
    if (prismaError) return prismaError.toNextResponse();
    return Status.internalError("Ocurrió un error al eliminar la recepción/traslado").toNextResponse();
  }
}