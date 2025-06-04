// File: /app/api/v1/barcos/route.js

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";
import { authorize } from "@/lib/sessionRoleValidator";

// Roles permitidos: ADMINISTRADOR, MUELLERO, AUDITOR_PROCESOS, MUELLERO_CHEQUERO
const ALLOWED_ROLES = [1, 2, 4, 7];
const LIMITED_ROLES = [1]; // Solo ADMINISTRADOR puede crear barcos
// Límite máximo de registros por página
const MAX_LIMIT = 200;

export async function GET(request) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const url        = new URL(request.url);
  const activoParam = url.searchParams.get("activo");
  const pageParam  = url.searchParams.get("page")  ?? "1";
  const limitParam = url.searchParams.get("limit") ?? "10";
  const search     = url.searchParams.get("search")?.trim() ?? "";

  // Determinar si se requiere paginación basado en parámetros recibidos
  const paginationRequested = pageParam !== null || limitParam !== null;

  let page = 1, limit = 10, skip = 0;

  if (paginationRequested) {
    page = parseInt(pageParam ?? "1", 10);
    limit = parseInt(limitParam ?? "10", 10);

    if (isNaN(page) || page < 1) {
      return Status
        .badRequest("Parámetro inválido", { page: "Debe ser un entero ≥ 1" })
        .toNextResponse();
    }
    if (isNaN(limit) || limit < 1) {
      return Status
        .badRequest("Parámetro inválido", { limit: "Debe ser un entero > 0" })
        .toNextResponse();
    }
    if (limit > MAX_LIMIT) {
      return Status
        .badRequest(`El límite máximo por página es ${MAX_LIMIT}`, { limit: `No puede ser mayor a ${MAX_LIMIT}` })
        .toNextResponse();
    }
    
    skip = (page - 1) * limit;
  }
  let whereClause = {};

  if (search) {
    whereClause.OR = [
      { muelle:     { contains: search } },
      { vaporBarco: { contains: search } },
    ];
  }

  if (!(activoParam === "false" || activoParam === "all")) {
    whereClause.activo = true;
  }

  try {
    let barcos, totalCount;
    
    if (paginationRequested) {
      // Con paginación: cuando se envían parámetros page o limit
      [barcos, totalCount] = await prisma.$transaction([
        prisma.barco.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.barco.count({ where: whereClause }),
      ]);
    } else {
      // Sin paginación: cuando NO se envían parámetros de paginación
      [barcos, totalCount] = await prisma.$transaction([
        prisma.barco.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
        }),
        prisma.barco.count({ where: whereClause }),
      ]);
    }

    return Status
      .ok({ barcos, totalCount }, "Barcos obtenidos correctamente")
      .toNextResponse();
  } catch (error) {
    console.error("Error GET /api/v1/barcos:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status
      .internalError("Ocurrió un error al obtener los barcos")
      .toNextResponse();
  }
}

export async function POST(request) {
  const session = await authorize(request, LIMITED_ROLES);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();

    const { valid, errors } = validateSchema({
      muelle:                 "required|string|max:255",
      vaporBarco:             "required|string|max:255",
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
      fechaRegistro:          "nullable|string",
    }, body);

    if (!valid) {
      return Status
        .unprocessableEntity("Datos de entrada inválidos", errors)
        .toNextResponse();
    }

    const tipoCargaJSON         = body.tipoCarga         ? JSON.stringify(body.tipoCarga)         : "[]";
    const sistemaUtilizadoJSON  = body.sistemaUtilizado  ? JSON.stringify(body.sistemaUtilizado)  : "[]";

    const creado = await prisma.barco.create({
      data: {
        muelle:                 body.muelle,
        vaporBarco:             body.vaporBarco,
        fechaArribo:            body.fechaArribo            ?? null,
        horaArribo:             body.horaArribo             ?? null,
        fechaAtraque:           body.fechaAtraque           ?? null,
        horaAtraque:            body.horaAtraque            ?? null,
        fechaRecibido:          body.fechaRecibido          ?? null,
        horaRecibido:           body.horaRecibido           ?? null,
        fechaInicioOperaciones: body.fechaInicioOperaciones ?? null,
        horaInicioOperaciones:  body.horaInicioOperaciones  ?? null,
        fechaFinOperaciones:    body.fechaFinOperaciones    ?? null,
        horaFinOperaciones:     body.horaFinOperaciones     ?? null,
        tipoCarga:              tipoCargaJSON,
        sistemaUtilizado:       sistemaUtilizadoJSON,
        fechaRegistro:          body.fechaRegistro         ?? null,
      },
    });

    return Status
      .created(creado, "Barco creado correctamente")
      .toNextResponse();
  } catch (error) {
    console.error("Error POST /api/v1/barcos:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status
      .internalError("Ocurrió un error al crear el barco")
      .toNextResponse();
  }
}