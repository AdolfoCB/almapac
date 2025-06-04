import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorize } from "@/lib/sessionRoleValidator";
import { Status, handlePrismaError } from "@/lib/status";

const ALLOWED_ROLES = [1]; // solo administradores

export async function GET(request) {
  // Autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const timeRange = parseInt(searchParams.get('timeRange') || '7'); // días

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRange);

    // Estadísticas generales
    const [
      totalSessions,
      activeSessions,
      recentSessions,
      uniqueUsers,
      deviceStats,
      osStats,
      browserStats,
      ipStats
    ] = await Promise.all([
      // Total de sesiones
      prisma.userSession.count(),
      
      // Sesiones activas
      prisma.userSession.count({
        where: { isActive: true }
      }),
      
      // Sesiones recientes
      prisma.userSession.count({
        where: {
          createdAt: { gte: startDate }
        }
      }),
      
      // Usuarios únicos activos
      prisma.userSession.findMany({
        where: { isActive: true },
        select: { userId: true },
        distinct: ['userId']
      }),
      
      // Estadísticas por tipo de dispositivo
      prisma.userSession.groupBy({
        by: ['deviceType'],
        where: {
          createdAt: { gte: startDate },
          deviceType: { not: null }
        },
        _count: { id: true }
      }),
      
      // Estadísticas por OS
      prisma.userSession.groupBy({
        by: ['deviceOS'],
        where: {
          createdAt: { gte: startDate },
          deviceOS: { not: null }
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10
      }),
      
      // Estadísticas por navegador
      prisma.userSession.groupBy({
        by: ['browser'],
        where: {
          createdAt: { gte: startDate },
          browser: { not: null }
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10
      }),
      
      // Top IPs
      prisma.userSession.groupBy({
        by: ['ipAddress'],
        where: {
          createdAt: { gte: startDate },
          ipAddress: { not: null }
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10
      })
    ]);

    const stats = {
      summary: {
        totalSessions,
        activeSessions,
        recentSessions,
        uniqueActiveUsers: uniqueUsers.length,
        timeRangeDays: timeRange
      },
      deviceTypes: deviceStats.map(stat => ({
        type: stat.deviceType,
        count: stat._count.id
      })),
      operatingSystems: osStats.map(stat => ({
        os: stat.deviceOS,
        count: stat._count.id
      })),
      browsers: browserStats.map(stat => ({
        browser: stat.browser,
        count: stat._count.id
      })),
      topIPs: ipStats.map(stat => ({
        ip: stat.ipAddress,
        count: stat._count.id
      }))
    };

    return Status.ok(stats, "Estadísticas obtenidas correctamente").toNextResponse();

  } catch (error) {
    console.error("Error fetching session stats:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al obtener estadísticas").toNextResponse();
  }
}