// src/app/api/auth/validate-session/route.js - API para validar sesiones en base de datos
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // Usar el prisma client configurado
import { decode } from "next-auth/jwt";

export async function POST(request) {
  try {
    // Obtener datos del request
    const { token, userId, sessionId, isPageValidation } = await request.json();

    // Validación de parámetros requeridos
    if (!token || !userId) {
      console.log('❌ [VALIDATE SESSION] Parámetros faltantes:', { token: !!token, userId: !!userId });
      return NextResponse.json(
        { 
          error: 'Token y userId son requeridos', 
          code: 'MISSING_PARAMS',
          shouldRevoke: false // NO cerrar sesión por parámetros faltantes
        },
        { status: 400 }
      );
    }

    console.log(`🔍 [VALIDATE SESSION] Validando sesión para usuario ${userId}, sessionId: ${sessionId}, isPage: ${isPageValidation}`);

    // 1. Verificar el token JWT de NextAuth
    let decoded;
    try {
      decoded = await decode({
        token: token,
        secret: process.env.NEXTAUTH_SECRET
      });

      if (!decoded) {
        throw new Error('Token decode returned null');
      }

      console.log(`✅ [VALIDATE SESSION] JWT válido para usuario: ${decoded.username}`);
    } catch (jwtError) {
      console.log(`❌ [VALIDATE SESSION] JWT inválido:`, jwtError.message);
      return NextResponse.json(
        { 
          error: 'Token JWT inválido', 
          code: 'INVALID_JWT',
          details: jwtError.message,
          shouldRevoke: true // SÍ cerrar sesión - token no válido
        },
        { status: 401 }
      );
    }

    // 2. Verificar que el userId del token coincida con el solicitado
    if (decoded.id !== parseInt(userId)) {
      console.log(`❌ [VALIDATE SESSION] UserID no coincide: token=${decoded.id}, request=${userId}`);
      return NextResponse.json(
        { 
          error: 'Usuario no coincide con el token', 
          code: 'USER_MISMATCH',
          shouldRevoke: true // SÍ cerrar sesión - token no coincide
        },
        { status: 401 }
      );
    }

    // 3. Buscar el usuario en la base de datos con el esquema correcto
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      include: { 
        role: {
          select: {
            id: true,
            name: true // Campo correcto según el esquema (mapeado a 'nombre' en DB)
          }
        }
      }
    });

    if (!user) {
      console.log(`❌ [VALIDATE SESSION] Usuario no encontrado: ${userId}`);
      return NextResponse.json(
        { 
          error: 'Usuario no encontrado', 
          code: 'USER_NOT_FOUND',
          shouldRevoke: true // SÍ cerrar sesión - usuario no existe
        },
        { status: 401 }
      );
    }

    // 4. Verificar que el usuario esté activo
    if (user.eliminado || !user.activo) {
      console.log(`❌ [VALIDATE SESSION] Usuario inactivo: ${userId}, eliminado: ${user.eliminado}, activo: ${user.activo}`);
      return NextResponse.json(
        { 
          error: 'Usuario inactivo o eliminado', 
          code: 'USER_INACTIVE',
          shouldRevoke: true // SÍ cerrar sesión - usuario inactivo
        },
        { status: 401 }
      );
    }

    // 5. Buscar sesión activa del usuario que coincida con el token
    const sessionQuery = {
      userId: user.id,
      sessionToken: token, // El sessionToken debe coincidir con el JWT enviado
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    };

    // Si tenemos sessionId específico, agregarlo a la consulta
    if (sessionId) {
      sessionQuery.id = sessionId;
    }

    const activeSession = await prisma.userSession.findFirst({
      where: sessionQuery,
      orderBy: { createdAt: 'desc' }
    });

    if (!activeSession) {
      console.log(`❌ [VALIDATE SESSION] No hay sesión activa con este token para usuario: ${userId}`);
      return NextResponse.json(
        { 
          error: 'No hay sesión activa con este token', 
          code: 'NO_ACTIVE_SESSION',
          shouldRevoke: true // SÍ cerrar sesión - sesión no encontrada
        },
        { status: 401 }
      );
    }

    console.log(`🔍 [VALIDATE SESSION] Sesión encontrada: ${activeSession.id}, expira: ${activeSession.expiresAt}`);

    // 6. Verificar si la sesión ha expirado
    if (activeSession.expiresAt && activeSession.expiresAt < new Date()) {
      console.log(`⏰ [VALIDATE SESSION] Sesión expirada: ${activeSession.id}`);
      
      // Marcar la sesión como terminada
      await prisma.userSession.update({
        where: { id: activeSession.id },
        data: {
          isActive: false,
          endedAt: new Date(),
          endReason: 'EXPIRED'
        }
      });

      return NextResponse.json(
        { 
          error: 'Sesión expirada', 
          code: 'SESSION_EXPIRED',
          shouldRevoke: true // SÍ cerrar sesión - sesión expirada
        },
        { status: 401 }
      );
    }

    // 7. Verificar que la sesión esté activa (redundante pero importante)
    if (!activeSession.isActive) {
      console.log(`❌ [VALIDATE SESSION] Sesión no activa: ${activeSession.id}`);
      return NextResponse.json(
        { 
          error: 'Sesión no está activa', 
          code: 'SESSION_INACTIVE',
          shouldRevoke: true // SÍ cerrar sesión - sesión inactiva
        },
        { status: 401 }
      );
    }

    // 8. Actualizar última actividad si es validación de página
    if (isPageValidation) {
      await prisma.userSession.update({
        where: { id: activeSession.id },
        data: { lastActivity: new Date() }
      });
    }

    // 9. Todo válido - preparar respuesta con información completa
    const responseData = {
      valid: true,
      sessionId: activeSession.id,
      user: {
        id: user.id,
        username: user.username,
        roleId: user.roleId,
        roleName: user.role?.name || `ROLE_${user.roleId}`,
        codigo: user.codigo,
        nombreCompleto: user.nombreCompleto,
        email: user.email
      },
      session: {
        id: activeSession.id,
        createdAt: activeSession.createdAt,
        lastActivity: activeSession.lastActivity,
        expiresAt: activeSession.expiresAt,
        loginAttempts: activeSession.loginAttempts,
        isActive: activeSession.isActive,
        // Información del dispositivo
        device: {
          os: activeSession.deviceOS,
          browser: activeSession.browser,
          model: activeSession.deviceModel,
          type: activeSession.deviceType,
          ipAddress: activeSession.ipAddress
        }
      }
    };

    console.log(`✅ [VALIDATE SESSION] Sesión válida para ${user.username} (${user.role?.name})`);

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ [VALIDATE SESSION] Error interno:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor', 
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        shouldRevoke: false // NO cerrar sesión por errores internos
      },
      { status: 500 }
    );
  }
}

// Método GET para obtener información de sesión (útil para debugging)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');

    if (!sessionId && !userId) {
      return NextResponse.json(
        { 
          error: 'Se requiere sessionId o userId como parámetro de consulta',
          example: '/api/auth/validate-session?sessionId=xxx o ?userId=123'
        },
        { status: 400 }
      );
    }

    const whereClause = sessionId 
      ? { id: sessionId }
      : { userId: parseInt(userId), isActive: true };

    // Obtener información de la sesión
    const sessions = await prisma.userSession.findMany({
      where: whereClause,
      include: {
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
      take: sessionId ? 1 : 10 // Si es por userId, limitar a 10 sesiones
    });

    if (sessions.length === 0) {
      return NextResponse.json(
        { error: 'Sesión(es) no encontrada(s)' },
        { status: 404 }
      );
    }

    const sessionsWithMetrics = sessions.map(session => {
      const now = new Date();
      const lastActivityAgo = Math.floor((now.getTime() - session.lastActivity.getTime()) / 1000);
      const timeRemaining = session.expiresAt ? 
        Math.max(0, Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000)) : null;

      return {
        sessionId: session.id,
        isActive: session.isActive,
        user: {
          ...session.user,
          roleName: session.user.role?.name
        },
        device: {
          os: session.deviceOS,
          browser: session.browser,
          model: session.deviceModel,
          type: session.deviceType,
          ipAddress: session.ipAddress
        },
        activity: {
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          lastActivityAgo: lastActivityAgo,
          expiresAt: session.expiresAt,
          timeRemaining: timeRemaining,
          isExpired: session.expiresAt ? session.expiresAt < now : false
        },
        endInfo: {
          endedAt: session.endedAt,
          endReason: session.endReason
        },
        loginAttempts: session.loginAttempts
      };
    });

    return NextResponse.json({
      success: true,
      data: sessionId ? sessionsWithMetrics[0] : sessionsWithMetrics,
      total: sessions.length
    });

  } catch (error) {
    console.error('❌ [VALIDATE SESSION GET] Error:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
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