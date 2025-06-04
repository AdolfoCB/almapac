import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Status, handlePrismaError } from "@/lib/status";
import { authorize } from "@/lib/sessionRoleValidator";

const ALLOWED_ROLES = [1, 2, 4, 7];

// GET - Obtener un barco específico y todas las operaciones de sus bitácoras filtradas por fecha
export async function GET(request, { params }) {
  // const session = await authorize(request, ALLOWED_ROLES);
  // if (session instanceof NextResponse) return session;

  const { id } = await params;
  const parsedId = parseInt(id, 10);

  if (isNaN(parsedId) || parsedId < 1) {
    return Status.badRequest("ID de barco inválido", {
      id: "Debe ser un entero válido ≥ 1"
    }).toNextResponse();
  }

  const { searchParams } = new URL(request.url);
  const fechaInicio = searchParams.get("fechaInicio"); // Formato: YYYY-MM-DD
  const fechaFin = searchParams.get("fechaFinal"); // Formato: YYYY-MM-DD

  // Construir filtros para la fecha de bitácoras
  let bitacorasWhere = {};
  if (fechaInicio || fechaFin) {
    if (fechaInicio && fechaFin) {
      bitacorasWhere.fecha = {
        gte: fechaInicio,
        lte: fechaFin
      };
    } else if (fechaInicio) {
      bitacorasWhere.fecha = { gte: fechaInicio };
    } else if (fechaFin) {
      bitacorasWhere.fecha = { lte: fechaFin };
    }
  }

  try {
    // Obtener barco y bitácoras filtradas con solo operaciones
    const barco = await prisma.barco.findUnique({
      where: { id: parsedId },
      include: {
        bitacoras: {
          where: Object.keys(bitacorasWhere).length > 0 ? bitacorasWhere : undefined,
          select: {
            operaciones: true,
          }
        }
      }
    });

    if (!barco) {
      return Status.notFound("Barco no encontrado").toNextResponse();
    }

    // Aplanar todas las operaciones
    const todasOperaciones = barco.bitacoras?.flatMap(b =>
      Array.isArray(b.operaciones) ? b.operaciones : []
    ) || [];

    // Respuesta con datos del barco y operaciones + total
    const response = {
      id: barco.id,
      muelle: barco.muelle,
      vaporBarco: barco.vaporBarco,
      fechaArribo: barco.fechaArribo,
      horaArribo: barco.horaArribo,
      fechaAtraque: barco.fechaAtraque,
      horaAtraque: barco.horaAtraque,
      fechaRecibido: barco.fechaRecibido,
      horaRecibido: barco.horaRecibido,
      fechaInicioOperaciones: barco.fechaInicioOperaciones,
      horaInicioOperaciones: barco.horaInicioOperaciones,
      fechaFinOperaciones: barco.fechaFinOperaciones,
      horaFinOperaciones: barco.horaFinOperaciones,
      tipoCarga: barco.tipoCarga,
      sistemaUtilizado: barco.sistemaUtilizado,
      fechaRegistro: barco.fechaRegistro,
      activo: barco.activo,
      createdAt: barco.createdAt,
      updatedAt: barco.updatedAt,
      operaciones: todasOperaciones,
      totalOperaciones: todasOperaciones.length
    };

    return Status.ok(response, "Barco y operaciones obtenidos correctamente").toNextResponse();

  } catch (error) {
    console.error(`Error GET /api/v1/barcos/${id}:`, error);
    const prismaError = handlePrismaError(error);
    if (prismaError) return prismaError.toNextResponse();
    return Status.internalError("Ocurrió un error al obtener el barco").toNextResponse();
  }
}
