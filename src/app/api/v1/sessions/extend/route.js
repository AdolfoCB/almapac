// app/api/sessions/extend/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  
  const { hours = 12 } = await request.json();
  
  try {
    const userSession = await prisma.userSession.findFirst({
      where: {
        userId: session.user.id,
        sessionToken: session.sessionId,
        isActive: true,
      },
    });
    
    if (!userSession) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }
    
    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + hours);
    
    await prisma.userSession.update({
      where: { id: userSession.id },
      data: {
        expiresAt: newExpiresAt,
        lastActivity: new Date(),
      },
    });
    
    return NextResponse.json({ 
      success: true,
      expiresAt: newExpiresAt,
    });
  } catch (error) {
    return NextResponse.json({ error: "Error al extender sesión" }, { status: 500 });
  }
}