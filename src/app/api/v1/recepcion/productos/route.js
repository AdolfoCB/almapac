// File: /app/api/v1/productos/route.js

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
    const productos = await prisma.producto.findMany({
      orderBy: { createdAt: "asc" },
    });
    return Status.ok({ productos }, "Productos obtenidos correctamente")
                 .toNextResponse();
  } catch (error) {
    console.error("Error GET /api/v1/productos:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status
      .internalError("Ocurrió un error al obtener los productos")
      .toNextResponse();
  }
}

export async function POST(request) {
  // autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  // validación de esquema
  const { valid, errors } = validateSchema({
    nombre:      "required|string|max:255",
    descripcion: "nullable|string|max:255",
  }, body);
  if (!valid) {
    return Status.unprocessableEntity("Datos de entrada inválidos", errors)
                 .toNextResponse();
  }

  try {
    const nuevoProducto = await prisma.producto.create({
      data: {
        nombre:      body.nombre,
        descripcion: body.descripcion ?? null,
      },
    });
    return Status.created(nuevoProducto, "Producto creado correctamente")
                 .toNextResponse();
  } catch (error) {
    console.error("Error POST /api/v1/productos:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status
      .internalError("Ocurrió un error al crear el producto")
      .toNextResponse();
  }
}