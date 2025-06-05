import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { userId, sessionId } = await request.json();
    console.log(`🔍 [validate-session API] Validando sesión:`, { userId, sessionId });
        
    if (!userId || !sessionId) {
      console.log(`❌ [validate-session API] Faltan parámetros: userId=${userId}, sessionId=${sessionId}`);
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    // Verificar conexión a DB
    await prisma.$connect();
    console.log(`📡 [validate-session API] Conectado a base de datos`);
        
    const session = await prisma.userSession.findFirst({
      where: {
        userId: parseInt(userId),
        sessionToken: sessionId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    console.log(`📄 [validate-session API] Resultado de búsqueda:`, {
      sessionFound: !!session,
      sessionId: session?.sessionToken,
      isActive: session?.isActive,
      expiresAt: session?.expiresAt,
      lastActivity: session?.lastActivity
    });
        
    if (!session) {
      console.log(`❌ [validate-session API] No se encontró sesión válida para userId=${userId}, sessionId=${sessionId}`);
      return NextResponse.json({ valid: false });
    }
        
    // Actualizar última actividad cada 5 minutos
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (session.lastActivity < fiveMinutesAgo) {
      console.log(`🔄 [validate-session API] Actualizando última actividad para sessionId=${sessionId}`);
      await prisma.userSession.update({
        where: { id: session.id },
        data: { lastActivity: new Date() },
      });
    }

    console.log(`✅ [validate-session API] Sesión válida confirmada para userId=${userId}, sessionId=${sessionId}`);
    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("💥 [validate-session API] Error validando sesión:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}