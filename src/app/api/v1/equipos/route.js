// File: /app/api/v1/equipos/route.js

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";
import { authorize } from "@/lib/sessionRoleValidator";

// Solo ADMINISTRADOR (1), OPERADOR (5) y SUPERVISOR_MANTENIMIENTO (6)
const ALLOWED_ROLES = [1, 5, 6];
// Límite máximo de registros por página
const MAX_LIMIT = 200;

export async function GET(request) {
  // Autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  // Parámetros de consulta
  const url        = new URL(request.url);
  const pageParam  = url.searchParams.get("page")  ?? "1";
  const limitParam = url.searchParams.get("limit") ?? "10";
  const search     = url.searchParams.get("search")?.trim() ?? "";

  const page  = parseInt(pageParam,  10);
  const limit = parseInt(limitParam, 10);

  // Validaciones de page/limit
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
      .badRequest(`El límite máximo por página es ${MAX_LIMIT}`, {
        limit: `No puede ser mayor a ${MAX_LIMIT}`
      })
      .toNextResponse();
  }

  const skip = (page - 1) * limit;
  // Construir whereClause base
  let whereClause = {};

  // Filtrado por rol (solo ADMINISTRADOR o SUPERVISOR pueden ver todos)
  if (![1, 6].includes(session.roleId)) {
    whereClause.userId = parseInt(session.id, 10);
  }

  // Filtro de búsqueda
  if (search) {
    whereClause.OR = [
      { equipo:     { contains: search } },
      { operador:   { contains: search } },
    ];
  }

  try {
    const [ totalCount, equipos ] = await prisma.$transaction([
      prisma.equipo.count({ where: whereClause }),
      prisma.equipo.findMany({
        where: whereClause,
        skip,
        take:    limit,
        orderBy: { createdAt: "asc" },
      }),
    ]);

    return Status
      .ok({ equipos, totalCount }, "Equipos obtenidos correctamente")
      .toNextResponse();
  } catch (error) {
    console.error("Error GET /api/v1/equipos:", error);
    const prismaError = handlePrismaError(error);
    if (prismaError) return prismaError.toNextResponse();
    return Status
      .internalError("Ocurrió un error al listar los equipos")
      .toNextResponse();
  }
}

export async function POST(request) {
  // Autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();

    // Validación de esquema
    const { valid, errors } = validateSchema({
      equipo:          "required|string|max:255",
      horometro:       "nullable|numeric",
      operador:        "required|string|max:255",
      fecha:           "required|string|max:50",
      hora:            "required|string|max:50",
      horaFin:         "nullable|string|max:50",
      tiempoTotal:     "nullable|numeric",
      turnoInicio:     "nullable|string|max:50",
      turnoFin:        "nullable|string|max:50",
      recomendaciones: "nullable|string|max:255",
      inspecciones:    "nullable|array",
    }, body);

    if (!valid) {
      return Status
        .unprocessableEntity("Datos de entrada inválidos", errors)
        .toNextResponse();
    }

    // Creación del registro
    const created = await prisma.equipo.create({
      data: {
        userId:          parseInt(session.id, 10),
        userName:        session.username || "",
        equipo:          body.equipo,
        horometro:       body.horometro      ?? null,
        operador:        body.operador,
        fecha:           body.fecha,
        hora:            body.hora,
        horaFin:         body.horaFin        ?? null,
        tiempoTotal:     body.tiempoTotal    ?? null,
        turnoInicio:     body.turnoInicio         ?? null,
        turnoFin:        body.turnoFin          ?? null,
        recomendaciones: body.recomendaciones ?? null,
        inspecciones:    Array.isArray(body.inspecciones)
                          ? body.inspecciones
                          : [],
      },
    });

    return Status
      .created(created, "Equipo creado correctamente")
      .toNextResponse();
  } catch (error) {
    console.error("Error POST /api/v1/equipos:", error);
    const prismaError = handlePrismaError(error);
    if (prismaError) return prismaError.toNextResponse();
    return Status
      .internalError("Ocurrió un error al guardar el equipo")
      .toNextResponse();
  }
}