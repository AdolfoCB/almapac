import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorize } from "@/lib/sessionRoleValidator";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";

const ALLOWED_ROLES = [1]; // solo admin

export async function GET(request) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  try {
    const roles = await prisma.role.findMany({
      orderBy: { id: "asc" },
    });
    return Status.ok(roles, "Roles obtenidos correctamente").toNextResponse();
  } catch (error) {
    console.error("Error fetching roles:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al obtener roles").toNextResponse();
  }
}

export async function POST(request) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const body = await request.json();

  const { valid, errors } = validateSchema(
    {
      name: "required|string|max:255",
    },
    body
  );

  if (!valid) {
    return Status.unprocessableEntity("Datos inválidos", errors).toNextResponse();
  }

  try {
    const newRole = await prisma.role.create({
      data: { name: body.name },
    });
    return Status.created(newRole, "Rol creado correctamente").toNextResponse();
  } catch (error) {
    console.error("Error creating role:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al crear rol").toNextResponse();
  }
}