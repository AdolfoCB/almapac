// lib/sessionRoleValidator.js
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { HTTP_STATUS_CODE } from "./status";
import jwt from "jsonwebtoken";

/**
 * Extrae el token JWT de NextAuth desde cookies O desde Authorization header
 * @param {Request} request 
 * @returns {Promise<object|null>}
 */
async function extractToken(request) {
  // 1. Intentar obtener token de cookies (método normal de NextAuth)
  try {
    const sessionFromCookie = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    
    if (sessionFromCookie) {
      console.log(`🍪 [TOKEN] Obtenido desde cookie para: ${sessionFromCookie.username}`);
      return sessionFromCookie;
    }
  } catch (error) {
    console.log('🍪 [TOKEN] No se pudo obtener desde cookie:', error.message);
  }

  // 2. Si no hay cookie, intentar desde Authorization header (para Postman)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET);
      console.log(`🎫 [TOKEN] Obtenido desde Bearer para: ${decoded.username}`);
      return decoded;
    } catch (error) {
      console.log('🎫 [TOKEN] Token Bearer inválido:', error.message);
      return null;
    }
  }

  console.log('❌ [TOKEN] No se encontró token en cookies ni en Authorization header');
  return null;
}

/**
 * 1) Verifica que el usuario esté autenticado desde cookies O Authorization header.
 *    Si no, devuelve 401 JSON.
 * @param {Request} request
 * @returns {Promise<object|NextResponse>} — session o Response
 */
export async function validateSession(request) {
  const session = await extractToken(request);
  
  if (!session) {
    return NextResponse.json(
      { 
        error: "No autenticado",
        message: "Inicia sesión o incluye el header: Authorization: Bearer <token>",
        hint: "Iniciar session en la aplicacion y copiar el token desde la consola"
      },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED }
    );
  }
  
  return session;
}

/**
 * 2) Verifica que el session.roleId esté en el arreglo de roles permitidos.
 *    Si no, devuelve 403 JSON.
 * @param {{ roleId: number }} session
 * @param {number[]} allowedRoles
 * @returns {NextResponse|undefined}
 */
export function validateRole(session, allowedRoles) {
  // arreglo vacío => cualquier autenticado
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    if (!allowedRoles.includes(session.roleId)) {
      return NextResponse.json(
        { 
          error: "Acceso denegado",
          message: `No tienes permisos para ejecutar esta acción`,
        },
        { status: HTTP_STATUS_CODE.FORBIDDEN }
      );
    }
  }
  // si allowedRoles no es arreglo o es vacío, dejamos pasar
}

/**
 * 3) Atajo todo-en-uno: recibe el request y los roles permitidos para esta ruta.
 *    Devuelve { session } si todo ok, o retorna directamente el NextResponse de error.
 * @param {Request} request
 * @param {number[]} allowedRoles
 */
export async function authorize(request, allowedRoles = []) {
  const session = await validateSession(request);
  if (session instanceof NextResponse) return session;

  const roleCheck = validateRole(session, allowedRoles);
  if (roleCheck) return roleCheck;

  console.log(`✅ [AUTHORIZE] Usuario autorizado: ${session.username} (rol: ${session.roleName || session.roleId})`);
  
  return session;
}

/**
 * 4) Función helper para debugging - muestra información del token
 * @param {Request} request 
 */
export async function debugToken(request) {
  console.log('🔍 [DEBUG TOKEN] Analizando request...');
  
  // Verificar cookies
  const cookies = request.headers.get('cookie');
  console.log('🍪 [COOKIES]:', cookies ? 'Presentes' : 'No encontradas');
  
  // Verificar Authorization header
  const authHeader = request.headers.get('authorization');
  console.log('🎫 [AUTH HEADER]:', authHeader ? `${authHeader.substring(0, 20)}...` : 'No encontrado');
  
  // Intentar extraer token
  const session = await extractToken(request);
  console.log('👤 [SESSION]:', session ? {
    username: session.username,
    roleId: session.roleId,
    roleName: session.roleName
  } : 'No encontrada');
  
  return session;
}