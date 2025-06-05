// app/api/sessions/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET: Obtener sesiones del usuario actual
export async function GET(request) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  
  try {
    const sessions = await prisma.userSession.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    
    return NextResponse.json(sessions);
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener sesiones" }, { status: 500 });
  }
}

// DELETE: Revocar una sesión específica
export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  
  const { sessionId } = await request.json();
  
  try {
    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        endedAt: new Date(),
        endReason: "Revocada por el usuario",
      },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al revocar sesión" }, { status: 500 });
  }
}