// app/api/health/route.js
import prisma from "@/lib/prisma";
import NodeCache from "node-cache";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Retorna un mensaje descriptivo basado en el código de estado HTTP.
 */
function getStatusMessage(code) {
  switch (code) {
    case 200:
      return "OK - Petición exitosa.";
    case 400:
      return "Solicitud mal formada o parámetros inválidos.";
    case 401:
      return "No autorizado - Credenciales inválidas o no proveídas.";
    case 403:
      return "Prohibido - No se tienen permisos para acceder al recurso.";
    case 404:
      return "No encontrado - El recurso no existe o ha sido movido.";
    case 500:
      return "Error interno del servidor.";
    default:
      return "Error desconocido.";
  }
}

/**
 * Devuelve una descripción para el estado de la base de datos.
 */
function getDatabaseDescription(status) {
  return status === "Activo"
    ? "Servicio de base de datos funcionando correctamente."
    : "Error al conectar con la base de datos.";
}

/**
 * Devuelve una descripción para el estado del servicio de autenticación.
 */
function getAuthDescription(status) {
  return status === "Activo"
    ? "Servicio de autenticación funcionando correctamente."
    : "El servicio de autenticación presenta problemas.";
}

/**
 * Devuelve una descripción para el servicio de caché.
 */
function getCacheDescription(status) {
  return status === "Activo"
    ? "Servicio de caché funcionando correctamente."
    : "Error: no se pudo leer/escribir correctamente en el caché.";
}

/**
 * Comprueba la conexión a la base de datos.
 */
async function checkDatabase() {
  let status = "Inactivo";
  try {
    await prisma.$queryRaw`SELECT 1`;
    status = "Activo";
  } catch (error) {
    console.error("Error de conexión a la base de datos:", error);
  }
  return status;
}

/**
 * Comprueba el servicio de autenticación consultando un endpoint público de NextAuth (/api/auth/csrf).
 * De esta forma se verifica que el sistema de autenticación funciona, independientemente de si hay sesión activa.
 */
async function checkAuthService() {
  const fullUrl = `${process.env.NEXTAUTH_URL}/api/auth/csrf`;
  try {
    const start = performance.now();
    const res = await fetch(fullUrl);
    const end = performance.now();
    const responseTime = Math.round(end - start);
    if (res.ok) {
      return { status: "Activo", responseTime, statusCode: res.status, message: getStatusMessage(res.status) };
    } else {
      return { status: "Inactivo", responseTime, statusCode: res.status, message: getStatusMessage(res.status) };
    }
  } catch (error) {
    console.error("Error verificando servicio de autenticación:", error);
    return { status: "Inactivo", responseTime: 0, statusCode: 0, message: "Error de red o servicio inaccesible." };
  }
}

/**
 * Comprueba el servicio de caché utilizando NodeCache.
 */
async function checkCache() {
  let status = "Inactivo";
  try {
    const cache = new NodeCache();
    const testKey = "healthCheckTest";
    cache.set(testKey, "OK", 5);
    const value = cache.get(testKey);
    if (value === "OK") {
      status = "Activo";
    } else {
      throw new Error("NodeCache no funciona correctamente");
    }
  } catch (error) {
    console.error("Error en NodeCache:", error);
  }
  return status;
}

export async function GET(request) {
  // Se intenta extraer el token (opcional) para usarlo en endpoints que requieran autenticación (como /api/user/profile)
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET, raw: true });
  // Nota: No se retorna error si no hay token, pues el Health Check debe verse siempre.

  // 1) Estado de la base de datos
  const dbStatus = await checkDatabase();

  // 2) Estado del servicio de autenticación (verificado mediante /api/auth/csrf)
  const authResult = await checkAuthService();

  // 3) Estado del servicio de caché
  const cacheStatus = await checkCache();

  const healthData = {
    database: {
      status: dbStatus,
      description: getDatabaseDescription(dbStatus),
    },
    authentication: {
      // Se devuelve el resultado obtenido de /api/auth/csrf
      status: authResult.status,
      description: getAuthDescription(authResult.status),
    },
    cache: {
      status: cacheStatus,
      description: getCacheDescription(cacheStatus),
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(healthData);
}
