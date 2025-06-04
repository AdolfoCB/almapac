import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Status, handlePrismaError } from "@/lib/status";
import { authorize } from "@/lib/sessionRoleValidator";

// Roles permitidos: ADMINISTRADOR (1), AUDITOR_PROCESOS (4), CHEQUERO (3), MUELLERO_CHEQUERO (7)
const ALLOWED_ROLES = [1, 3, 4, 7];

export async function GET(request, { params }) {
  // 1. Autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  // 2. Validar y parsear el ID del barco
  const { id } = await params;
  const barcoId = parseInt(id, 10);

  // Validate that barcoId is a valid number
  if (isNaN(barcoId)) {
    return Status.badRequest("ID inválido", { id: "Debe ser un entero" })
                 .toNextResponse();
  }

  try {
    // 3. Traer datos base del BarcoRecepcion
    const barco = await prisma.barcoRecepcion.findUnique({
      where: { id: barcoId },
      select: {
        id:               true,
        vaporBarco:       true,
        productos:        true,
        puntosDescarga:   true,
        transportes:      true,   // JSON: [{ id, nombre }, …]
        observaciones:    true,
        createdAt:        true,
        updatedAt:        true,
      },
    });
    
    if (!barco) {
      return Status.notFound("Barco no encontrado").toNextResponse();
    }

    // 4. Extraer IDs únicos de empresas de transporte
    const transIds   = (barco.transportes || []).map(t => t.id);
    const uniqueIds  = Array.from(new Set(transIds));

    // 5. Recuperar motoristas para esas empresas
    const empresas = await prisma.empresaTransporte.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, motoristas: true },
    });
    const motosMap = empresas.reduce((acc, e) => {
      acc[e.id] = e.motoristas;
      return acc;
    }, {});

    // 6. Inyectar motoristas en cada transporte
    const transportesConMotoristas = (barco.transportes || []).map(t => ({
      id:         t.id,
      nombre:     t.nombre,
      motoristas: motosMap[t.id] || [],
    }));

    // 7. Responder con la entidad completa ajustada
    return Status.ok({
      ...barco,
      transportes: transportesConMotoristas
    }, "Barco de recepción con motoristas obtenido correctamente")
      .toNextResponse();

  } catch (error) {
    console.error("Error GET /api/v1/recepcion/bitacoras/[id]:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status
      .internalError("Ocurrió un error al obtener el barco de recepción")
      .toNextResponse();
  }
}