// File: /app/api/v1/recepcion/transportes/route.js

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorize } from "@/lib/sessionRoleValidator";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";

// Solo ADMINISTRADOR (roleId === 1)
const ALLOWED_ROLES = [1];

export async function GET(request) {
  // autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  try {
    const url = new URL(request.url);
    const activoParam = url.searchParams.get("activo");
    const pageParam  = url.searchParams.get("page")  ?? "1";
    const limitParam = url.searchParams.get("limit") ?? "10";
    const search     = url.searchParams.get("search")?.trim() ?? "";

    const page  = Math.max(parseInt(pageParam, 10), 1);
    const limit = Math.max(parseInt(limitParam, 10), 1);

    // Filtro activo
    // Si activoParam es 'false' o 'all', no filtramos por activo
    // Si es 'true' o null, filtramos por activo: true
    const whereClause = (activoParam === "false" || activoParam === "all")
      ? {}
      : { activo: true };

    if (search.length > 0) {
      whereClause.nombre = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Conteo total para paginación
    const totalCount = await prisma.empresaTransporte.count({
      where: whereClause,
    });

    // Obtener lista paginada
    const empresas = await prisma.empresaTransporte.findMany({
      where: whereClause,
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return Status.ok({ empresas, totalCount }, "Empresas de transporte obtenidas correctamente")
                 .toNextResponse();
  } catch (error) {
    console.error("Error GET /api/v1/recepcion/transportes:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status
      .internalError("Ocurrió un error al obtener las empresas de transporte")
      .toNextResponse();
  }
}

export async function POST(request) {
  // autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  try {
    const payload = await request.json();
    const items = Array.isArray(payload) ? payload : [payload];

    const created = [];

    for (const item of items) {
      // Validación de esquema para cada item
      const { valid, errors } = validateSchema({
        nombre: "required|string|max:255",
        motoristas: "nullable|array",
        fechaRegistro: "required|string",
      }, item);
      if (!valid) {
        return Status.unprocessableEntity("Datos de entrada inválidos", errors)
                     .toNextResponse();
      }

      const nombreTrimmed = item.nombre.trim();

      const motoristasData = Array.isArray(item.motoristas) ? item.motoristas : [];

      const nueva = await prisma.empresaTransporte.create({
        data: {
          nombre: nombreTrimmed,
          motoristas: motoristasData,
          fechaRegistro: item.fechaRegistro,
        },
      });

      created.push(nueva);
    }

    return Status.created(Array.isArray(payload) ? created : created[0], "Empresa(s) de transporte creada(s) correctamente")
                 .toNextResponse();

  } catch (error) {
    console.error("Error POST /api/v1/recepcion/transportes:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status
      .internalError("Ocurrió un error al crear la(s) empresa(s) de transporte")
      .toNextResponse();
  }
}