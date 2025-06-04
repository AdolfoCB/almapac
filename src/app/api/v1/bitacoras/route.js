import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";
import { authorize } from "@/lib/sessionRoleValidator";

const ALLOWED_ROLES = [1, 2, 7];
const MAX_LIMIT = 200;

export async function GET(request) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const url = new URL(request.url);
  const pageParam = url.searchParams.get("page") ?? "1";
  const limitParam = url.searchParams.get("limit") ?? "10";
  const search = url.searchParams.get("search")?.trim() ?? "";

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
  let whereClause = {};

  // Si no es ADMINISTRADOR ni AUDITOR_PROCESOS, limitar a sus propias bitácoras
  if (![1, 4].includes(session.roleId)) {
    whereClause.userId = parseInt(session.id, 10);
  }

  if (search) {
    whereClause.OR = [
      { muellero: { contains: search, mode: "insensitive" } },
      { vaporBarco: { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    const [totalCount, rawItems] = await prisma.$transaction([
      prisma.bitacoraBarco.count({ where: whereClause }),
      prisma.bitacoraBarco.findMany({
        where: whereClause,
        include: {barco: true},
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const bitacoras = rawItems.map(b => ({
      id: b.id,
      userId: b.userId,
      userName: b.userName,
      barcoId: b.barcoId,
      vaporBarco: b.vaporBarco,
      fechaInicio: b.fechaInicio,
      fecha: b.fecha,
      fechaCierre: b.fechaCierre,
      muellero: b.muellero,
      turnoInicio: b.turnoInicio,
      turnoFin: b.turnoFin,
      observaciones: b.observaciones,
      eliminado: b.eliminado,
      estado: b.estado,
      operaciones: Array.isArray(b.operaciones) ? b.operaciones : [],
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      barco: b.barco,
    }));

    return Status.ok({ bitacoras, totalCount }, "Bitácoras obtenidas correctamente").toNextResponse();
  } catch (error) {
    console.error("Error GET /api/v1/bitacoras:", error);
    const prismaError = handlePrismaError(error);
    if (prismaError) return prismaError.toNextResponse();
    return Status.internalError("Ocurrió un error al obtener las bitácoras").toNextResponse();
  }
}

export async function POST(request) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

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
      barcoId: "required|integer",
      estado: "nullable|string|max:50", // Agregar validación para estado
      eliminado: "nullable|boolean", // Agregar validación para eliminado
      operaciones: "required|array",
    }, body);

    if (!valid) {
      return Status.unprocessableEntity("Datos de entrada inválidos", errors).toNextResponse();
    }

    // Verificar que barcoId existe
    const barcoExists = await prisma.barco.findUnique({
      where: { id: body.barcoId }
    });
    if (!barcoExists) {
      return Status.notFound("Barco no encontrado").toNextResponse();
    }

    const creado = await prisma.bitacoraBarco.create({
      data: {
        userId: session.id ? parseInt(session.id, 10) : null,
        userName: session.username || "",
        barcoId: body.barcoId,
        vaporBarco: barcoExists?.vaporBarco ?? null,
        fechaInicio: body.fechaInicio ?? null,
        fecha: body.fecha ?? null,
        fechaCierre: body.fechaCierre ?? null,
        muellero: body.muellero,
        turnoInicio: body.turnoInicio ?? null,
        turnoFin: body.turnoFin ?? null,
        observaciones: body.observaciones ?? null,
        estado: body.estado ?? "CREADA", // Corregir: usar body.estado en lugar de b.estado
        eliminado: body.eliminado ?? false, // Agregar campo eliminado
        operaciones: body.operaciones,
      },
    });

    // Asegurar que operaciones es un array
    creado.operaciones = Array.isArray(creado.operaciones) ? creado.operaciones : [];

    return Status.created(creado, "Bitácora creada correctamente").toNextResponse();
  } catch (error) {
    console.error("Error POST /api/v1/bitacoras:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Ocurrió un error al crear la bitácora").toNextResponse();
  }
}