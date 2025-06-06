// app/api/v1/sessions/route.js - API para gestionar sesiones
import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { authorize } from "@/lib/sessionRoleValidator";
import { Status, handlePrismaError } from "@/lib/status";

const ALLOWED_ROLES = [1]; // solo admin

// Obtener todas las sesiones
export async function GET(request) {
  try {
    const session = await authorize(request, ALLOWED_ROLES);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const userId = searchParams.get('userId');
    const isActive = searchParams.get('isActive');

    const where = {};
    if (userId) where.userId = parseInt(userId);
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [sessions, total] = await Promise.all([
      prisma.userSession.findMany({
        where,
        include: {
          user: {
            select: {
              username: true,
              nombreCompleto: true,
              role: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.userSession.count({ where })
    ]);

    return NextResponse.json({
      sessions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Error fetching sessions:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al obtener sessions").toNextResponse();
  }
}