// File: /app/api/v1/recepcion/barcos/route.js

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";
import { authorize } from "@/lib/sessionRoleValidator";

// Roles permitidos: ADMINISTRADOR (1), CHEQUERO (3), AUDITOR_PROCESOS (4), MUELLERO_CHEQUERO (7)
const ALLOWED_ROLES = [1, 3, 4, 7];
// Roles permitidos: ADMINISTRADOR (1)
const LIMITED_ROLES = [1];

const MAX_LIMIT = 200;

export async function GET(request) {
  // autorización
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
      { vaporBarco:   { contains: search, mode: "insensitive" } },
      { observaciones:{ contains: search, mode: "insensitive" } },
    ];
  }

  if (!(activoParam === "false" || activoParam === "all")) {
    whereClause.activo = true;
  }

  try {
    let barcos, totalCount;
      if (paginationRequested) {
      // Con paginación: cuando se envían parámetros page o limit
      [ barcos, totalCount ] = await prisma.$transaction([
        prisma.barcoRecepcion.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.barcoRecepcion.count({ where: whereClause }),
      ]);
    } else {
      [ totalCount, barcos ] = await prisma.$transaction([
        prisma.barcoRecepcion.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.barcoRecepcion.count({ where: whereClause }),
      ]);
    }

    return Status.ok({ barcos, totalCount }, "Barcos de recepción obtenidos").toNextResponse();
  } catch (error) {
    console.error("Error GET /api/v1/recepcion/barcos:", error);
    const prismaErrorResponse = handlePrismaError(error);
        if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status
      .internalError("Ocurrió un error al obtener la lista de barcos de recepción/traslado")
      .toNextResponse();
  }
}

export async function POST(request) {
  // autorización
  const session = await authorize(request, LIMITED_ROLES);
  if (session instanceof NextResponse) return session;

  const body = await request.json();

  // validación de esquema
  const { valid, errors } = validateSchema({
    vaporBarco:      "required|string|max:255",
    observaciones:   "nullable|string|max:255",
    productos:       "required|array",
    puntosDescarga:  "required|array",
    transportes:     "required|array",
    fechaRegistro:   "required|string"
  }, body);

  if (!valid) {
    return Status.unprocessableEntity("Datos inválidos", errors).toNextResponse();
  }

  // validaciones adicionales
  if (new Set(body.puntosDescarga).size !== body.puntosDescarga.length) {
    return Status.badRequest("Los puntos de descarga deben ser únicos").toNextResponse();
  }

  const names = body.transportes.map(t => t.nombre);
  if (names.some(n => typeof n !== "string" || !n.trim())) {
    return Status.badRequest("Cada transporte debe tener un 'nombre' válido").toNextResponse();
  }
  if (new Set(names).size !== names.length) {
    return Status.badRequest("Los nombres de transporte deben ser únicos").toNextResponse();
  }

  try {
    const nuevo = await prisma.$transaction(async tx => {
      // validar cada empresa de transporte
      for (const { id, nombre } of body.transportes) {
        if (typeof id !== "number") {
          throw new Error(`Transporte "${nombre}" debe incluir un 'id' numérico`);
        }
        const exists = await tx.empresaTransporte.findUnique({ where: { id } });
        if (!exists) {
          throw new Error(`No existe empresa con id ${id}`);
        }
        if (exists.nombre !== nombre) {
          throw new Error(`Nombre provisto ("${nombre}") no coincide con "${exists.nombre}"`);
        }
      }

      // crear el registro
      return tx.barcoRecepcion.create({
        data: {
          vaporBarco:     body.vaporBarco,
          observaciones:  body.observaciones   ?? null,
          productos:      body.productos,
          puntosDescarga: body.puntosDescarga,
          transportes:    body.transportes,
          fechaRegistro:  body.fechaRegistro  ?? null
        }
      });
    });

    return Status.created(nuevo, "Barco de recepción creado correctamente").toNextResponse();
  } catch (error) {
    console.error("Error POST /api/v1/recepcion/barcos:", error);
    const prismaErrorResponse = handlePrismaError(error);
        if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status
      .internalError("Ocurrió un error al crear el barco de recepción/traslado")
      .toNextResponse();
  }
}