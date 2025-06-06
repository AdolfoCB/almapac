import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authorize } from "@/lib/sessionRoleValidator";
import { Status, handlePrismaError } from "@/lib/status";

const ALLOWED_ROLES = [1]; // solo admin

export async function GET(request) {
  // autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  try {
    // Obtener estadísticas en paralelo para mejor rendimiento
    const [
      totalUsers,
      activeSessions,
      bitacoraEnProceso,
      recepcionEnProceso,
      barcosInMuelle,
      barcosInRecepcion
    ] = await Promise.all([
      // Total de usuarios registrados (no eliminados)
      prisma.user.count({
        where: { eliminado: false }
      }),

      // Usuarios con sesiones activas
      prisma.userSession.count({
        where: { isActive: true }
      }),

      // Procesos de bitácora en estado "EN PROCESO"
      prisma.bitacoraBarco.count({
        where: { 
          estado: "EN PROCESO",
          eliminado: false 
        }
      }),

      // Procesos de recepción en estado "EN PROCESO"
      prisma.recepcionTraslado.count({
        where: { 
          estado: "EN PROCESO",
          eliminado: false 
        }
      }),

      // Barcos en muelle
      prisma.barco.count({
        where: { activo: true }
      }),

      // Barcos en recepción
      prisma.barcoRecepcion.count({
        where: { activo: true }
      })
    ]);

    // Unir los totales de bitacoraBarco y recepcionTraslado
    const processesInProgress = bitacoraEnProceso + recepcionEnProceso;

    const stats = {
      totalUsers,
      activeSessions,
      processesInProgress, // Total combinado de ambas tablas
      barcosInMuelle,
      barcosInRecepcion,
      // Opcional: mantener los conteos separados si los necesitas
      breakdown: {
        bitacoraEnProceso,
        recepcionEnProceso
      },
      timestamp: new Date().toISOString()
    };

    return Status.ok(stats, "Estadísticas obtenidas correctamente").toNextResponse();
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Error al obtener estadísticas del dashboard").toNextResponse();
  }
}