// app/api/auth/validate-session/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { userId, sessionId } = await request.json();
    
    if (!userId || !sessionId) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }
    
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
    
    if (!session) {
      return NextResponse.json({ valid: false });
    }
    
    // Actualizar última actividad cada 5 minutos
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (session.lastActivity < fiveMinutesAgo) {
      await prisma.userSession.update({
        where: { id: session.id },
        data: { lastActivity: new Date() },
      });
    }
    
    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Error validando sesión:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}