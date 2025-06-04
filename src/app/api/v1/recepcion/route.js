// File: /app/api/v1/recepcion/route.js

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";
import { authorize } from "@/lib/sessionRoleValidator";

// =====================================================
// SISTEMA DE ESTADOS PARA RECEPCIONES
// =====================================================

// Estados de recepción
export const EstadoRecepcion = {
  CREADA: "CREADA",
  EN_PROCESO: "EN PROCESO", 
  COMPLETADA: "COMPLETADA",
  ELIMINADA: "ELIMINADA"
};

// Determinar estado automáticamente basado en contenido
function determineStateFromContent(recepcion) {
  if (recepcion.eliminado) return EstadoRecepcion.ELIMINADA;
  // Si ya está completada, mantener ese estado
  if (recepcion.estado === EstadoRecepcion.COMPLETADA) return EstadoRecepcion.COMPLETADA;
  if (recepcion.bitacoras && recepcion.bitacoras.length > 0) return EstadoRecepcion.EN_PROCESO;
  return EstadoRecepcion.CREADA;
}

// Roles permitidos: ADMINISTRADOR (1), CHEQUERO (3), AUDITOR_PROCESOS (4), MUELLERO_CHEQUERO (7)
const ALLOWED_ROLES = [1, 3, 4, 7];
const MAX_LIMIT = 200;

export async function GET(request) {
  // autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  try {
    const url = new URL(request.url);
    const pageParam = url.searchParams.get("page") ?? "1";
    const limitParam = url.searchParams.get("limit") ?? "10";
    const search = url.searchParams.get("search")?.trim() ?? "";
    const estado = url.searchParams.get("estado")?.trim();

    const page = parseInt(pageParam, 10);
    const limit = parseInt(limitParam, 10);

    if (isNaN(page) || page < 1) {
      return Status.badRequest("Parámetro inválido", { page: "Debe ser un entero ≥ 1" }).toNextResponse();
    }
    if (isNaN(limit) || limit < 1) {
      return Status.badRequest("Parámetro inválido", { limit: "Debe ser un entero > 0" }).toNextResponse();
    }
    if (limit > MAX_LIMIT) {
      return Status.badRequest(`El límite máximo por página es ${MAX_LIMIT}`, {
        limit: `No puede ser mayor a ${MAX_LIMIT}`
      }).toNextResponse();
    }

    const skip = (page - 1) * limit;

    // Construir whereClause base
    let whereClause = {};

    // Filtrado por rol (solo ADMINISTRADOR o AUDITOR_PROCESOS pueden ver todos)
    if (![1, 4].includes(session.roleId)) {
      whereClause.userId = parseInt(session.id, 10);
    }

    // Filtro por estado
    if (estado && Object.values(EstadoRecepcion).includes(estado)) {
      whereClause.estado = estado;
    }

    // Filtro de búsqueda
    if (search) {
      whereClause.OR = [
        { nombreBarco: { contains: search, mode: "insensitive" } },
        { producto: { contains: search, mode: "insensitive" } },
        { chequero: { contains: search, mode: "insensitive" } }
      ];
    }

    // contar y consultar en transacción
    const [totalCount, rawRecepciones] = await prisma.$transaction([
      prisma.recepcionTraslado.count({ where: whereClause }),
      prisma.recepcionTraslado.findMany({
        where: whereClause,
        include: { barcoRecepcion: true },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Procesar y asegurar campos
    const recepciones = rawRecepciones.map(r => ({
      id: r.id,
      userId: r.userId,
      userName: r.userName,
      barcoId: r.barcoId,
      fechaInicio: r.fechaInicio,
      fecha: r.fecha,
      fechaCierre: r.fechaCierre,
      producto: r.producto,
      nombreBarco: r.nombreBarco,
      chequero: r.chequero,
      turnoInicio: r.turnoInicio,
      turnoFin: r.turnoFin,
      puntoCarga: r.puntoCarga,
      puntoDescarga: r.puntoDescarga,
      bitacoras: Array.isArray(r.bitacoras) ? r.bitacoras : [],
      eliminado: r.eliminado,
      estado: r.estado || EstadoRecepcion.CREADA,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      barcoRecepcion: r.barcoRecepcion,
    }));

    return Status.ok({ recepciones, totalCount }, "Recepciones obtenidas correctamente").toNextResponse();
  } catch (error) {
    console.error("Error GET /api/v1/recepcion:", error);
    const prismaError = handlePrismaError(error);
    if (prismaError) return prismaError.toNextResponse();
    return Status.internalError("Ocurrió un error al obtener las recepciones").toNextResponse();
  }
}

export async function POST(request) {
  // autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();

    // valida esquema de entrada
    const { valid, errors } = validateSchema({
      barcoId: "required|integer",
      fechaInicio: "required|string",
      fecha: "required|string",
      fechaCierre: "nullable|string",
      producto: "nullable|string",
      nombreBarco: "nullable|string",
      turnoInicio: "nullable|string",
      turnoFin: "nullable|string",
      puntoCarga: "nullable|string",
      puntoDescarga: "nullable|string",
      bitacoras: "nullable|array",
      estado: "nullable|string|max:50",
      eliminado: "nullable|boolean",
    }, body);

    console.log(valid)
    console.log(errors)

    if (!valid) {
      return Status.unprocessableEntity("Datos de entrada inválidos", errors).toNextResponse();
    }

    // Verificar que el barco existe
    const barcoExists = await prisma.barcoRecepcion.findUnique({
      where: { id: body.barcoId }
    });
    if (!barcoExists) {
      return Status.notFound("Barco de recepción no encontrado").toNextResponse();
    }

    // Determinar estado automáticamente
    const estadoCalculado = determineStateFromContent({
      bitacoras: body.bitacoras,
      eliminado: body.eliminado || false,
      estado: body.estado
    });

    // creamos la recepción/traslado
    const nuevo = await prisma.recepcionTraslado.create({
      data: {
        userId: session.id ? parseInt(session.id, 10) : null,
        userName: session.username || "",
        barcoId: body.barcoId,
        fechaInicio: body.fechaInicio,
        fecha: body.fecha,
        fechaCierre: body.fechaCierre,
        producto: body.producto,
        nombreBarco: body.nombreBarco,
        chequero: session.nombreCompleto || "",
        turnoInicio: body.turnoInicio ?? null,
        turnoFin: body.turnoFin ?? null,
        puntoCarga: body.puntoCarga ?? null,
        puntoDescarga: body.puntoDescarga ?? null,
        bitacoras: body.bitacoras,
        estado: estadoCalculado,
        eliminado: body.eliminado ?? false,
      },
    });

    // Asegurar que bitacoras es un array
    nuevo.bitacoras = Array.isArray(nuevo.bitacoras) ? nuevo.bitacoras : [];

    return Status.created(nuevo, "Recepción/traslado creado correctamente").toNextResponse();
  } catch (error) {
    console.error("Error POST /api/v1/recepcion:", error);
    const prismaError = handlePrismaError(error);
    if (prismaError) return prismaError.toNextResponse();
    return Status.internalError("Ocurrió un error al crear la recepción/traslado").toNextResponse();
  }
}