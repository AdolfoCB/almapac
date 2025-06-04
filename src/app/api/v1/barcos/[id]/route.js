// File: /app/api/v1/barcos/[id]/route.js

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";
import { authorize } from "@/lib/sessionRoleValidator";

// Roles permitidos: ADMINISTRADOR, MUELLERO, MUELLERO_CHEQUERO, AUDITOR_PROCESOS
const ALLOWED_ROLES = [1, 2, 4, 7];
const LIMITED_ROLES = [1];

export async function GET(request, { params }) {
  const session = await authorize( request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const barcoId = parseInt(id, 10);
    if (isNaN(barcoId)) {
      return Status.badRequest("ID inválido", { id: "Debe ser un entero" }).toNextResponse();
    }
    const barco = await prisma.barco.findUnique({
      where: { id: barcoId },
    });

    if (!barco) {
      return Status.notFound("Barco no encontrado").toNextResponse();
    }

    // Parsear JSON almacenado en tipoCarga y sistemaUtilizado
    // const tipoCarga = barco.tipoCarga ? JSON.parse(barco.tipoCarga) : [];
    // const sistemaUtilizado = barco.sistemaUtilizado ? JSON.parse(barco.sistemaUtilizado) : [];

    return Status.ok(
      { ...barco },
      "Barco obtenido correctamente"
    ).toNextResponse();
  } catch (error) {
    console.error("Error GET /api/v1/barcos/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Ocurrió un error al obtener el barco").toNextResponse();
  }
}

export async function PUT(request, { params }) {
  const session = await authorize( request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const barcoId = parseInt(id, 10);
    if (isNaN(barcoId)) {
      return Status.badRequest("ID inválido", { id: "Debe ser un entero" }).toNextResponse();
    }
    const body = await request.json();

    // valida entrada
    const { valid, errors } = validateSchema({
      muelle:                 "nullable|string|max:255",
      vaporBarco:             "nullable|string|max:255",
      fechaArribo:            "nullable|string",
      horaArribo:             "nullable|string",
      fechaAtraque:           "nullable|string",
      horaAtraque:            "nullable|string",
      fechaRecibido:          "nullable|string",
      horaRecibido:           "nullable|string",
      fechaInicioOperaciones: "nullable|string",
      horaInicioOperaciones:  "nullable|string",
      fechaFinOperaciones:    "nullable|string",
      horaFinOperaciones:     "nullable|string",
      tipoCarga:              "nullable|array",
      sistemaUtilizado:       "nullable|array",
      activo:                 "nullable|boolean",
      fechaRegistro:          "required|string",
    }, body);

    if (!valid) {
      console.log("Errores de validación:", errors);
      return Status.unprocessableEntity("Datos de entrada inválidos", errors).toNextResponse();
    }

    // convierte arrays a JSON-str
    const tipoCargaJSON = body.tipoCarga ? JSON.stringify(body.tipoCarga) : "[]";
    const sistemaUtilizadoJSON = body.sistemaUtilizado ? JSON.stringify(body.sistemaUtilizado) : "[]";

    const barcoActualizado = await prisma.barco.update({
      where: { id: barcoId },
      data: {
        muelle:                 body.muelle,
        vaporBarco:             body.vaporBarco,
        fechaArribo:            body.fechaArribo ?? null,
        horaArribo:             body.horaArribo ?? null,
        fechaAtraque:           body.fechaAtraque ?? null,
        horaAtraque:            body.horaAtraque ?? null,
        fechaRecibido:          body.fechaRecibido ?? null,
        horaRecibido:           body.horaRecibido ?? null,
        fechaInicioOperaciones: body.fechaInicioOperaciones ?? null,
        horaInicioOperaciones:  body.horaInicioOperaciones ?? null,
        fechaFinOperaciones:    body.fechaFinOperaciones ?? null,
        horaFinOperaciones:     body.horaFinOperaciones ?? null,
        tipoCarga:              tipoCargaJSON,
        sistemaUtilizado:       sistemaUtilizadoJSON,
        activo:                 body.activo ?? true,
        fechaRegistro:          body.fechaRegistro?? null,
      },
    });

    return Status.ok(
      {
        ...barcoActualizado,
        tipoCarga: body.tipoCarga ?? [],
        sistemaUtilizado: body.sistemaUtilizado ?? [],
      },
      "Barco actualizado correctamente"
    ).toNextResponse();
  } catch (error) {
    console.error("Error PUT /api/v1/barcos/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Ocurrió un error al actualizar el barco").toNextResponse();
  }
}

export async function DELETE(request, { params }) {
  const session = await authorize( request, LIMITED_ROLES);
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const barcoId = parseInt(id, 10);
    if (isNaN(barcoId)) {
      return Status.badRequest("ID inválido", { id: "Debe ser un entero" }).toNextResponse();
    }

    // Verificar si hay bitacoras asociadas al barco
    const bitacoraCount = await prisma.bitacoraBarco.count({
      where: { barcoId },
    });
    if (bitacoraCount > 0) {
      return Status.conflict("No se puede eliminar el barco porque tiene bitácoras asociadas").toNextResponse();
    }

    await prisma.barco.delete({
      where: { id: barcoId },
    });

    return Status.ok(null, "Barco eliminado correctamente").toNextResponse();
  } catch (error) {
    console.error("Error DELETE /api/v1/barcos/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Ocurrió un error al eliminar el barco").toNextResponse();
  }
}