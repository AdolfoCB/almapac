// src/app/api/v1/sessions/route.js - API principal para listar y gestionar sesiones
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorize } from "@/lib/sessionRoleValidator";
import { Status, handlePrismaError } from "@/lib/status";
import { validateSchema } from "@/lib/validator";

const ALLOWED_ROLES = [1];

function sanitizeSession(session) {
  // No mostrar el token completo en las respuestas por seguridad
  const { sessionToken, ...rest } = session;
  return {
    ...rest,
    sessionToken: sessionToken ? `${sessionToken.substring(0, 20)}...` : null
  };
}

export async function GET(request) {
  // Autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';
  const userId = searchParams.get('userId');
  const isActive = searchParams.get('isActive');
  const deviceType = searchParams.get('deviceType');
  const ipAddress = searchParams.get('ipAddress');

  try {
    // Construir filtros
    const where = {};
    
    if (userId) {
      where.userId = parseInt(userId);
    }
    
    if (isActive !== null && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    
    if (deviceType) {
      where.deviceType = deviceType;
    }
    
    if (ipAddress) {
      where.ipAddress = { contains: ipAddress };
    }
    
    if (search) {
      where.OR = [
        { user: { username: { contains: search, mode: 'insensitive' } } },
        { user: { nombreCompleto: { contains: search, mode: 'insensitive' } } },
        { deviceOS: { contains: search, mode: 'insensitive' } },
        { browser: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search } }
      ];
    }

    // Contar total
    const totalCount = await prisma.userSession.count({ where });

    // Obtener sesiones con paginación
    const sessions = await prisma.userSession.findMany({
      where,
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
      },
      orderBy: [
        { isActive: 'desc' },
        { lastActivity: 'desc' }
      ],
      skip: (page - 1) * limit,
      take: limit
    });

    const sanitizedSessions = sessions.map(sanitizeSession);

    return Status.ok({
      sessions: sanitizedSessions,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    }, "Sesiones obtenidas correctamente").toNextResponse();

  } catch (error) {
    console.error("Error fetching sessions:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al obtener sesiones").toNextResponse();
  }
}

export async function DELETE(request) {
  // Autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const body = await request.json();

  // Validación de esquema
  const { valid, errors } = validateSchema({
    action: "required|string|in:revoke-user,revoke-all,delete-session,delete-all",
    userId: "nullable|integer",
    sessionId: "nullable|string",
    reason: "nullable|string|max:255"
  }, body);

  if (!valid) {
    return Status.unprocessableEntity("Datos de entrada inválidos", errors).toNextResponse();
  }

  try {
    const { action, userId, sessionId, reason = 'ADMIN_ACTION' } = body;

    switch (action) {
      case 'revoke-user':
        // Revocar todas las sesiones activas de un usuario
        if (!userId) {
          return Status.badRequest("userId es requerido para revocar sesiones de usuario").toNextResponse();
        }

        const revokedUserSessions = await prisma.userSession.updateMany({
          where: {
            userId: userId,
            isActive: true
          },
          data: {
            isActive: false,
            endedAt: new Date(),
            endReason: reason
          }
        });

        console.log(`🚫 [ADMIN] Revocadas ${revokedUserSessions.count} sesiones del usuario ${userId}`);
        
        return Status.ok({
          revokedSessions: revokedUserSessions.count,
          userId: userId,
          reason: reason
        }, `${revokedUserSessions.count} sesiones revocadas correctamente`).toNextResponse();

      case 'revoke-all':
        // Revocar TODAS las sesiones activas del sistema
        const revokedAllSessions = await prisma.userSession.updateMany({
          where: {
            isActive: true
          },
          data: {
            isActive: false,
            endedAt: new Date(),
            endReason: reason
          }
        });

        console.log(`🚫 [ADMIN] Revocadas TODAS las sesiones: ${revokedAllSessions.count}`);

        return Status.ok({
          revokedSessions: revokedAllSessions.count,
          reason: reason
        }, `${revokedAllSessions.count} sesiones revocadas correctamente`).toNextResponse();

      case 'delete-session':
        // Eliminar físicamente una sesión de la base de datos
        if (!sessionId) {
          return Status.badRequest("sessionId es requerido para eliminar sesión").toNextResponse();
        }

        const sessionToDelete = await prisma.userSession.findUnique({
          where: { id: sessionId },
          include: {
            user: {
              select: { username: true }
            }
          }
        });

        if (!sessionToDelete) {
          return Status.notFound("Sesión no encontrada").toNextResponse();
        }

        await prisma.userSession.delete({
          where: { id: sessionId }
        });

        console.log(`🗑️ [ADMIN] Eliminada sesión ${sessionId} del usuario ${sessionToDelete.user.username}`);

        return Status.ok({
          deletedSessionId: sessionId,
          username: sessionToDelete.user.username
        }, "Sesión eliminada correctamente").toNextResponse();

      case 'delete-all':
        // Eliminar físicamente TODAS las sesiones de la base de datos
        const totalSessionsCount = await prisma.userSession.count();

        if (totalSessionsCount === 0) {
          return Status.ok({
            deletedSessions: 0
          }, "No hay sesiones para eliminar").toNextResponse();
        }

        const deletedAllSessions = await prisma.userSession.deleteMany({});

        console.log(`🗑️ [ADMIN] Eliminadas físicamente TODAS las sesiones: ${deletedAllSessions.count}`);

        return Status.ok({
          deletedSessions: deletedAllSessions.count,
          reason: reason
        }, `${deletedAllSessions.count} sesiones eliminadas físicamente de la base de datos`).toNextResponse();

      default:
        return Status.badRequest("Acción no válida").toNextResponse();
    }

  } catch (error) {
    console.error("Error managing sessions:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al gestionar sesiones").toNextResponse();
  }
}