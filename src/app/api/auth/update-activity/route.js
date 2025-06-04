// src/app/api/auth/update-activity/route.js - API para actualizar última actividad de sesión
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    // Obtener datos del request
    const { sessionId, userId } = await request.json();

    // Validación de parámetros requeridos
    if (!sessionId) {
      console.log('❌ [UPDATE ACTIVITY] sessionId es requerido');
      return NextResponse.json(
        { 
          error: 'sessionId es requerido',
          code: 'MISSING_SESSION_ID'
        },
        { status: 400 }
      );
    }

    console.log(`🔄 [UPDATE ACTIVITY] Actualizando actividad para sesión: ${sessionId}`);

    // Verificar que la sesión existe y está activa
    const session = await prisma.userSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            activo: true,
            eliminado: true
          }
        }
      }
    });

    if (!session) {
      console.log(`❌ [UPDATE ACTIVITY] Sesión no encontrada: ${sessionId}`);
      return NextResponse.json(
        { 
          error: 'Sesión no encontrada',
          code: 'SESSION_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Verificar que la sesión esté activa
    if (!session.isActive) {
      console.log(`❌ [UPDATE ACTIVITY] Sesión inactiva: ${sessionId}`);
      return NextResponse.json(
        { 
          error: 'Sesión ya no está activa',
          code: 'SESSION_INACTIVE'
        },
        { status: 400 }
      );
    }

    // Verificar que el usuario siga activo
    if (!session.user.activo || session.user.eliminado) {
      console.log(`❌ [UPDATE ACTIVITY] Usuario inactivo para sesión: ${sessionId}`);
      
      // Terminar la sesión automáticamente si el usuario está inactivo
      await prisma.userSession.update({
        where: { id: sessionId },
        data: {
          isActive: false,
          endedAt: new Date(),
          endReason: 'USER_DISABLED'
        }
      });

      return NextResponse.json(
        { 
          error: 'Usuario inactivo, sesión terminada',
          code: 'USER_DISABLED'
        },
        { status: 401 }
      );
    }

    // Verificar si la sesión ha expirado
    if (session.expiresAt && session.expiresAt < new Date()) {
      console.log(`⏰ [UPDATE ACTIVITY] Sesión expirada: ${sessionId}`);
      
      // Marcar como expirada
      await prisma.userSession.update({
        where: { id: sessionId },
        data: {
          isActive: false,
          endedAt: new Date(),
          endReason: 'EXPIRED'
        }
      });

      return NextResponse.json(
        { 
          error: 'Sesión expirada',
          code: 'SESSION_EXPIRED'
        },
        { status: 401 }
      );
    }

    // Actualizar la última actividad de la sesión
    const updatedSession = await prisma.userSession.update({
      where: { id: sessionId },
      data: { 
        lastActivity: new Date() 
      },
      select: {
        id: true,
        lastActivity: true,
        expiresAt: true,
        user: {
          select: {
            username: true
          }
        }
      }
    });

    console.log(`✅ [UPDATE ACTIVITY] Actividad actualizada para ${updatedSession.user.username}: ${updatedSession.lastActivity}`);

    // Calcular tiempo restante hasta expiración
    let timeRemaining = null;
    if (updatedSession.expiresAt) {
      timeRemaining = Math.max(0, Math.floor((updatedSession.expiresAt.getTime() - Date.now()) / 1000));
    }

    return NextResponse.json({
      success: true,
      message: 'Actividad actualizada correctamente',
      data: {
        sessionId: updatedSession.id,
        lastActivity: updatedSession.lastActivity,
        expiresAt: updatedSession.expiresAt,
        timeRemaining: timeRemaining
      }
    });

  } catch (error) {
    console.error('❌ [UPDATE ACTIVITY] Error interno:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  } finally {
    // Cerrar conexión de Prisma
    await prisma.$disconnect();
  }
}

// Método GET para obtener información de actividad (opcional)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { 
          error: 'sessionId es requerido como parámetro de consulta',
          example: '/api/auth/update-activity?sessionId=xxx'
        },
        { status: 400 }
      );
    }

    // Obtener información de la sesión
    const session = await prisma.userSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        isActive: true,
        createdAt: true,
        lastActivity: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            username: true,
            nombreCompleto: true
          }
        }
      }
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Sesión no encontrada' },
        { status: 404 }
      );
    }

    // Calcular métricas
    const now = new Date();
    const lastActivityAgo = Math.floor((now.getTime() - session.lastActivity.getTime()) / 1000);
    const timeRemaining = session.expiresAt ? 
      Math.max(0, Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000)) : null;

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        isActive: session.isActive,
        user: session.user,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        lastActivityAgo: lastActivityAgo,
        expiresAt: session.expiresAt,
        timeRemaining: timeRemaining,
        isExpired: session.expiresAt ? session.expiresAt < now : false
      }
    });

  } catch (error) {
    console.error('❌ [UPDATE ACTIVITY GET] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Métodos no permitidos
export async function PUT() {
  return NextResponse.json(
    { 
      error: 'Método no permitido',
      allowedMethods: ['GET', 'POST']
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { 
      error: 'Método no permitido',
      allowedMethods: ['GET', 'POST']
    },
    { status: 405 }
  );
}