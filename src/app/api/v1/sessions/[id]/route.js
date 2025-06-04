// src/app/api/v1/sessions/[id]/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorize } from "@/lib/sessionRoleValidator";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";

const ALLOWED_ROLES = [1];

export async function GET(request, { params }) {
  // Autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  try {
    const userSession = await prisma.userSession.findUnique({
      where: { id: id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nombreCompleto: true,
            email: true,
            roleId: true,
            role: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!userSession) {
      return Status.notFound("Sesión no encontrada").toNextResponse();
    }

    return Status.ok("Sesión obtenida correctamente").toNextResponse();

  } catch (error) {
    console.error("Error GET /api/v1/sessions/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al obtener sesión").toNextResponse();
  }
}

export async function PUT(request, { params }) {
  // Autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const body = await request.json();

  // Validación de esquema
  const { valid, errors } = validateSchema({
    action: "required|string|in:revoke,reactivate",
    reason: "nullable|string|max:255"
  }, body);

  if (!valid) {
    return Status.unprocessableEntity("Datos de entrada inválidos", errors).toNextResponse();
  }

  try {
    const { action, reason = 'ADMIN_ACTION' } = body;

    const existingSession = await prisma.userSession.findUnique({
      where: { id: id },
      include: {
        user: {
          select: { username: true }
        }
      }
    });

    if (!existingSession) {
      return Status.notFound("Sesión no encontrada").toNextResponse();
    }

    let updatedSession;

    if (action === 'revoke') {
      // Revocar sesión específica
      updatedSession = await prisma.userSession.update({
        where: { id: id },
        data: {
          isActive: false,
          endedAt: new Date(),
          endReason: reason
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nombreCompleto: true,
              email: true,
              roleId: true
            }
          }
        }
      });

      console.log(`🚫 [ADMIN] Revocada sesión ${id} del usuario ${existingSession.user.username}`);
      
    } else if (action === 'reactivate') {
      // Reactivar sesión (solo si no ha expirado)
      if (existingSession.expiresAt && existingSession.expiresAt < new Date()) {
        return Status.badRequest("No se puede reactivar una sesión expirada").toNextResponse();
      }

      updatedSession = await prisma.userSession.update({
        where: { id: id },
        data: {
          isActive: true,
          endedAt: null,
          endReason: null
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nombreCompleto: true,
              email: true,
              roleId: true
            }
          }
        }
      });

      console.log(`✅ [ADMIN] Reactivada sesión ${id} del usuario ${existingSession.user.username}`);
    }

    return Status.ok(`Sesión ${action === 'revoke' ? 'revocada' : 'reactivada'} correctamente`).toNextResponse();

  } catch (error) {
    console.error("Error PUT /api/v1/sessions/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al actualizar sesión").toNextResponse();
  }
}

export async function DELETE(request, { params }) {
  // Autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  try {
    const existingSession = await prisma.userSession.findUnique({
      where: { id: id },
      include: {
        user: {
          select: { username: true }
        }
      }
    });

    if (!existingSession) {
      return Status.notFound("Sesión no encontrada").toNextResponse();
    }

    await prisma.userSession.delete({
      where: { id: id }
    });

    console.log(`🗑️ [ADMIN] Eliminada sesión ${id} del usuario ${existingSession.user.username}`);

    return Status.ok({
      deletedSessionId: id,
      username: existingSession.user.username
    }, "Sesión eliminada correctamente").toNextResponse();

  } catch (error) {
    console.error("Error DELETE /api/v1/sessions/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al eliminar sesión").toNextResponse();
  }
}