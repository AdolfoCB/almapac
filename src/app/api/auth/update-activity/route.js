// src/app/api/auth/update-activity/route.js - API para actualizar última actividad de sesión
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // Usar el prisma client configurado

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
            eliminado: true,
            role: {
              select: {
                id: true,
                name: true // Campo correcto según el esquema
              }
            }
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
        deviceOS: true,
        browser: true,
        deviceType: true,
        ipAddress: true,
        user: {
          select: {
            id: true,
            username: true,
            nombreCompleto: true,
            role: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    console.log(`✅ [UPDATE ACTIVITY] Actividad actualizada para ${updatedSession.user.username}: ${updatedSession.lastActivity}`);

    // Calcular tiempo restante hasta expiración
    let timeRemaining = null;
    let minutesRemaining = null;
    if (updatedSession.expiresAt) {
      const msRemaining = updatedSession.expiresAt.getTime() - Date.now();
      timeRemaining = Math.max(0, Math.floor(msRemaining / 1000));
      minutesRemaining = Math.max(0, Math.floor(msRemaining / 60000));
    }

    // Información adicional del dispositivo para logging/debugging
    const deviceInfo = {
      os: updatedSession.deviceOS,
      browser: updatedSession.browser,
      type: updatedSession.deviceType,
      ip: updatedSession.ipAddress
    };

    return NextResponse.json({
      success: true,
      message: 'Actividad actualizada correctamente',
      data: {
        sessionId: updatedSession.id,
        lastActivity: updatedSession.lastActivity,
        expiresAt: updatedSession.expiresAt,
        timeRemaining: timeRemaining, // segundos
        minutesRemaining: minutesRemaining, // minutos
        user: {
          id: updatedSession.user.id,
          username: updatedSession.user.username,
          nombreCompleto: updatedSession.user.nombreCompleto,
          roleName: updatedSession.user.role?.name
        },
        device: deviceInfo
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
  }
}

// Método GET para obtener información de actividad (opcional)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');

    if (!sessionId && !userId) {
      return NextResponse.json(
        { 
          error: 'sessionId o userId es requerido como parámetro de consulta',
          examples: [
            '/api/auth/update-activity?sessionId=xxx',
            '/api/auth/update-activity?userId=123'
          ]
        },
        { status: 400 }
      );
    }

    // Preparar query según el parámetro recibido
    const whereClause = sessionId 
      ? { id: sessionId }
      : { 
          userId: parseInt(userId),
          isActive: true 
        };

    // Obtener información de la sesión
    const sessions = await prisma.userSession.findMany({
      where: whereClause,
      select: {
        id: true,
        isActive: true,
        createdAt: true,
        lastActivity: true,
        expiresAt: true,
        endedAt: true,
        endReason: true,
        loginAttempts: true,
        // Información del dispositivo
        deviceOS: true,
        browser: true,
        deviceModel: true,
        deviceType: true,
        ipAddress: true,
        user: {
          select: {
            id: true,
            username: true,
            nombreCompleto: true,
            email: true,
            role: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { lastActivity: 'desc' },
      take: sessionId ? 1 : 5 // Si es por userId, solo las 5 más recientes
    });

    if (sessions.length === 0) {
      return NextResponse.json(
        { error: 'Sesión(es) no encontrada(s)' },
        { status: 404 }
      );
    }

    // Calcular métricas para cada sesión
    const sessionsWithMetrics = sessions.map(session => {
      const now = new Date();
      const lastActivityAgo = Math.floor((now.getTime() - session.lastActivity.getTime()) / 1000);
      const lastActivityMinutesAgo = Math.floor(lastActivityAgo / 60);
      
      let timeRemaining = null;
      let minutesRemaining = null;
      let isExpired = false;
      
      if (session.expiresAt) {
        const msRemaining = session.expiresAt.getTime() - now.getTime();
        timeRemaining = Math.max(0, Math.floor(msRemaining / 1000));
        minutesRemaining = Math.max(0, Math.floor(msRemaining / 60000));
        isExpired = session.expiresAt < now;
      }

      return {
        sessionId: session.id,
        isActive: session.isActive,
        user: {
          id: session.user.id,
          username: session.user.username,
          nombreCompleto: session.user.nombreCompleto,
          email: session.user.email,
          roleId: session.user.role?.id,
          roleName: session.user.role?.name
        },
        device: {
          os: session.deviceOS,
          browser: session.browser,
          model: session.deviceModel,
          type: session.deviceType,
          ipAddress: session.ipAddress
        },
        timing: {
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          lastActivityAgo: lastActivityAgo, // segundos
          lastActivityMinutesAgo: lastActivityMinutesAgo, // minutos
          expiresAt: session.expiresAt,
          timeRemaining: timeRemaining, // segundos
          minutesRemaining: minutesRemaining, // minutos
          isExpired: isExpired
        },
        status: {
          isActive: session.isActive,
          endedAt: session.endedAt,
          endReason: session.endReason,
          loginAttempts: session.loginAttempts
        }
      };
    });

    return NextResponse.json({
      success: true,
      query: { sessionId, userId },
      data: sessionId ? sessionsWithMetrics[0] : sessionsWithMetrics,
      total: sessions.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [UPDATE ACTIVITY GET] Error:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// Método PATCH para actualizar actividad sin retornar información completa (más eficiente)
export async function PATCH(request) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId es requerido' },
        { status: 400 }
      );
    }

    // Solo actualizar la actividad sin validaciones adicionales
    // (para uso en casos donde ya se validó la sesión)
    const updated = await prisma.userSession.updateMany({
      where: {
        id: sessionId,
        isActive: true
      },
      data: {
        lastActivity: new Date()
      }
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: 'Sesión no encontrada o inactiva' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Actividad actualizada',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [UPDATE ACTIVITY PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Métodos no permitidos
export async function PUT() {
  return NextResponse.json(
    { 
      error: 'Método no permitido',
      allowedMethods: ['GET', 'POST', 'PATCH']
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { 
      error: 'Método no permitido',
      allowedMethods: ['GET', 'POST', 'PATCH']
    },
    { status: 405 }
  );
}