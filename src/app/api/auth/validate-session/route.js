// src/app/api/auth/validate-session/route.js - API para validar sesiones en base de datos
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    // Obtener datos del request
    const { token, userId, isApiToken } = await request.json();

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

    console.log(`🔍 [VALIDATE SESSION] Validando sesión para usuario ${userId}, isApiToken: ${isApiToken}`);

    // 1. Verificar el token JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET);
      console.log(`✅ [VALIDATE SESSION] JWT válido para usuario: ${decoded.username}`);
    } catch (jwtError) {
      console.log(`❌ [VALIDATE SESSION] JWT inválido:`, jwtError.message);
      return NextResponse.json(
        { 
          error: 'Token JWT inválido', 
          code: 'INVALID_JWT',
          details: jwtError.message,
          shouldRevoke: true // SÍ cerrar sesión - token no coincide
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

    // 3. Buscar el usuario en la base de datos
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      include: { 
        role: {
          select: {
            id: true,
            name: true
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
          shouldRevoke: false // NO cerrar sesión por usuario no encontrado
        },
        { status: 401 }
      );
    }

    // 4. Verificar que el usuario esté activo
    if (user.eliminado || !user.activo) {
      console.log(`❌ [VALIDATE SESSION] Usuario inactivo: ${userId}, eliminado: ${user.eliminado}, activo: ${user.activo}`);
      return NextResponse.json(
        { 
          error: 'Usuario no encontrado o inactivo', 
          code: 'USER_INACTIVE',
          shouldRevoke: false // NO cerrar sesión por usuario inactivo
        },
        { status: 401 }
      );
    }

    // 5. Buscar sesión activa del usuario que coincida con el token
    const activeSession = await prisma.userSession.findFirst({
      where: {
        userId: user.id,
        sessionToken: token, // ✅ El sessionToken debe coincidir con el JWT enviado
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!activeSession) {
      console.log(`❌ [VALIDATE SESSION] No hay sesión activa con este token para usuario: ${userId}`);
      return NextResponse.json(
        { 
          error: 'No hay sesión activa con este token', 
          code: 'NO_ACTIVE_SESSION',
          shouldRevoke: true // SÍ cerrar sesión - token no coincide
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
          shouldRevoke: true // SÍ cerrar sesión - sesión está en activa = false
        },
        { status: 401 }
      );
    }

    // 8. Todo válido - preparar respuesta
    const responseData = {
      valid: true,
      sessionId: activeSession.id,
      user: {
        id: user.id,
        username: user.username,
        roleId: user.roleId,
        roleName: user.role.name,
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
        isActive: activeSession.isActive
      }
    };

    console.log(`✅ [VALIDATE SESSION] Sesión válida para ${user.username} (${user.role.name})`);

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
  } finally {
    // Cerrar conexión de Prisma
    await prisma.$disconnect();
  }
}

// Método GET no permitido
export async function GET() {
  return NextResponse.json(
    { 
      error: 'Método no permitido',
      message: 'Esta API solo acepta requests POST' 
    },
    { status: 405 }
  );
}

// Otros métodos no permitidos
export async function PUT() {
  return NextResponse.json(
    { error: 'Método no permitido' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Método no permitido' },
    { status: 405 }
  );
}