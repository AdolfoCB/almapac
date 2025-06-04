import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// 1) Definición de roles en español
const ROLES = {
  ADMINISTRADOR: 1,
  MUELLERO: 2,
  CHEQUERO: 3,
  AUDITOR_PROCESOS: 4,
  OPERADOR: 5,
  SUPERVISOR_MANTENIMIENTO: 6,
  MUELLERO_CHEQUERO: 7,
};

// 2) Rutas públicas (no requieren auth)
const PUBLIC_ROUTES = [
  "/login",
  "/api/auth",
  "/api/auth/path*",
  "/health",
  "/api/v1/health",
];

// 3) Grupos de permisos
const PERMISSIONS = {
  AUTHENTICATED: [], // cualquier usuario autenticado
  ADMIN_ONLY: [ROLES.ADMINISTRADOR],
  MUELLERO: [ROLES.ADMINISTRADOR, ROLES.MUELLERO, ROLES.MUELLERO_CHEQUERO, ROLES.AUDITOR_PROCESOS],
  MUELLERO_LIMITED: [ROLES.ADMINISTRADOR, ROLES.AUDITOR_PROCESOS],
  EQUIPOS: [ROLES.ADMINISTRADOR, ROLES.OPERADOR, ROLES.SUPERVISOR_MANTENIMIENTO],
  EQUIPOS_LIMITED: [ROLES.ADMINISTRADOR, ROLES.SUPERVISOR_MANTENIMIENTO],
  RECEPCION_FULL: [ROLES.ADMINISTRADOR, ROLES.CHEQUERO, ROLES.AUDITOR_PROCESOS, ROLES.MUELLERO_CHEQUERO],
  PROCESS_FULL: [ROLES.ADMINISTRADOR, ROLES.MUELLERO, ROLES.CHEQUERO, ROLES.MUELLERO_CHEQUERO],
  RECEPCION_LIMITED: [ROLES.ADMINISTRADOR, ROLES.AUDITOR_PROCESOS],
};

// 5) Definición de permisos por ruta
const ROUTE_PERMISSIONS = {
  // Globales
  "/": PERMISSIONS.AUTHENTICATED,
  "/perfil": PERMISSIONS.AUTHENTICATED,
  "/proceso/iniciar": PERMISSIONS.PROCESS_FULL,
  "/building": PERMISSIONS.AUTHENTICATED,

  // ADMIN
  "/usuarios": PERMISSIONS.ADMIN_ONLY,
  "/sesiones": PERMISSIONS.ADMIN_ONLY,
  // "/api/v1/users": PERMISSIONS.ADMIN_ONLY,
  // "/api/v1/users/:path*": PERMISSIONS.ADMIN_ONLY,
  // "/api/v1/roles": PERMISSIONS.ADMIN_ONLY,
  // "/api/v1/roles/:path*": PERMISSIONS.ADMIN_ONLY,

  // Barco y Bitácoras
  // "/api/v1/barcos": PERMISSIONS.MUELLERO,
  // "/api/v1/barcos/:path*": PERMISSIONS.MUELLERO,
  "/proceso/iniciar/barco": PERMISSIONS.MUELLERO,
  "/proceso/consultar/barco": PERMISSIONS.MUELLERO,
  // "/api/v1/bitacoras": PERMISSIONS.MUELLERO,
  // "/api/v1/bitacoras/:path*": PERMISSIONS.MUELLERO,
  // "/api/v1/bitacoras/export-excel": PERMISSIONS.MUELLERO_LIMITED,
  "/proceso/consultar/bitacora": PERMISSIONS.MUELLERO,
  "/proceso/editar/bitacora": PERMISSIONS.ADMIN_ONLY,

  // Equipos
  // "/api/v1/equipos": PERMISSIONS.EQUIPOS,
  // "/api/v1/equipos/:path*": PERMISSIONS.EQUIPOS,
  // "/api/v1/equipos/export-excel": PERMISSIONS.EQUIPOS_LIMITED,
  "/proceso/iniciar/equipo": PERMISSIONS.EQUIPOS,
  "/proceso/consultar/equipo": PERMISSIONS.EQUIPOS,

  // Recepción
  // "/api/v1/recepcion": PERMISSIONS.RECEPCION_FULL,
  // "/api/v1/recepcion/bitacoras/:path*": PERMISSIONS.RECEPCION_FULL,
  // "/api/v1/recepcion/barcos": PERMISSIONS.RECEPCION_FULL,
  "/proceso/iniciar/recepcion": PERMISSIONS.RECEPCION_FULL,
  "/proceso/consultar/recepcion": PERMISSIONS.RECEPCION_FULL,
  // "/api/v1/recepcion/productos": PERMISSIONS.RECEPCION_LIMITED,
  // "/api/v1/recepcion/barcos/:path*": PERMISSIONS.RECEPCION_LIMITED,
  // "/api/v1/recepcion/productos/:path*": PERMISSIONS.RECEPCION_LIMITED,
  // "/api/v1/recepcion/export-excel": PERMISSIONS.RECEPCION_LIMITED,
  // "/api/v1/recepcion/transportes": PERMISSIONS.RECEPCION_LIMITED,
  // "/api/v1/recepcion/transportes/:path*": PERMISSIONS.RECEPCION_LIMITED,
  // "/api/v1/transportes": PERMISSIONS.RECEPCION_LIMITED,
  "/proceso/consultar/recepcion/barcos": PERMISSIONS.RECEPCION_FULL,
  // "/api/v1/recepcion/:path*": PERMISSIONS.ADMIN_ONLY,
  "/proceso/editar/recepcion": PERMISSIONS.ADMIN_ONLY,
};

// 6) Headers de seguridad
const SecurityHeaders = {
  HSTS: "max-age=63072000; includeSubDomains; preload",
  X_FRAME: "DENY",
  X_CONTENT: "nosniff",
  REFERRER: "no-referrer",
  PERMISSIONS_POLICY: "camera=(), microphone=(), geolocation=()",
};

function applySecurityHeaders(response) {
  Object.entries(SecurityHeaders).forEach(([key, value]) => {
    response.headers.set(key.replace('_', '-'), value);
  });
  return response;
}

// 7) Helper para coincidencia de rutas
function matchRoute(path, pattern) {
  if (pattern.includes(":path*")) {
    return path.startsWith(pattern.replace("/:path*", ""));
  }
  return path === pattern;
}

// 10) 🆕 Validar sesión de página contra DB
async function validatePageSessionInDB(nextAuthToken) {
  try {
    // El token de NextAuth ya contiene el apiToken generado
    const apiToken = nextAuthToken.apiToken;
    const userId = nextAuthToken.id;
    
    if (!apiToken || !userId) {
      console.log('⚠️ [VALIDATE PAGE] Token de NextAuth sin apiToken o userId');
      return { valid: false, shouldRevoke: false }; // NO revocar por token de NextAuth incompleto
    }

    // Validar contra la base de datos
    const baseUrl = process.env.NEXTAUTH_URL;
    const response = await fetch(`${baseUrl}/api/auth/validate-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: apiToken,
        userId: userId,
        isApiToken: false // Es una sesión de página
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log(`❌ [VALIDATE PAGE] Sesión inválida en DB: ${errorData.code}`);
      
      // Usar el shouldRevoke que viene de la API validate-session
      const shouldRevoke = errorData.shouldRevoke || false;
      
      return { 
        valid: false, 
        shouldRevoke: shouldRevoke, // Solo revocar si la API lo indica
        error: errorData.error,
        code: errorData.code 
      };
    }

    const sessionData = await response.json();
    console.log(`✅ [VALIDATE PAGE] Sesión válida para ${sessionData.user.username}`);
    
    return {
      valid: true,
      shouldRevoke: false,
      sessionId: sessionData.sessionId,
      user: sessionData.user
    };
    
  } catch (error) {
    console.error('❌ [VALIDATE PAGE] Error validando sesión:', error);
    return { valid: false, shouldRevoke: false }; // NO revocar por errores de conexión
  }
}

// 11) 🆕 Revocar sesión (limpiar cookies y terminar en DB)
async function revokeSession(req, sessionId) {
  try {
    console.log(`🚫 [REVOKE SESSION] Revocando sesión: ${sessionId}`);
    
    if (sessionId) {
      // Terminar sesión en base de datos
      const baseUrl = process.env.NEXTAUTH_URL;
      await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });
    }

    // Crear respuesta de redirect al login con cookies limpiadas
    const loginUrl = new URL("/login?authorize=SessionRevoked", req.url);
    const response = NextResponse.redirect(loginUrl);
    
    // Limpiar cookies de NextAuth
    response.cookies.delete('next-auth.session-token');
    response.cookies.delete('__Secure-next-auth.session-token');
    response.cookies.delete('next-auth.csrf-token');
    response.cookies.delete('__Secure-next-auth.csrf-token');
    
    console.log(`✅ [REVOKE SESSION] Sesión revocada y cookies limpiadas`);
    return response;
    
  } catch (error) {
    console.error('❌ [REVOKE SESSION] Error revocando sesión:', error);
    // Fallback: redirect simple al login
    return NextResponse.redirect(new URL("/login?authorize=SessionError", req.url));
  }
}

// 12) 🆕 Actualizar actividad de sesión
async function updateSessionActivity(sessionId) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL;
    await fetch(`${baseUrl}/api/auth/update-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });
  } catch (error) {
    console.error('❌ [MIDDLEWARE] Error actualizando actividad:', error);
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Rutas públicas
  if (PUBLIC_ROUTES.some(r => matchRoute(pathname, r))) {
    return applySecurityHeaders(NextResponse.next());
  }

  let token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Verificar si el token está presente
  if (!token) {
    console.log("⚠️ [MIDDLEWARE] No se encontró un token de sesión");
    return NextResponse.redirect(new URL("/login?authorize=SessionRequired", req.url));
  }

  // Verificar si el token tiene apiToken y userId
  if (!token.apiToken || !token.id) {
    console.log("⚠️ [MIDDLEWARE] Token incompleto, faltan apiToken o userId");
    return NextResponse.redirect(new URL("/login?authorize=SessionInvalid", req.url));
  }

  // Validar sesión contra la base de datos
  const pageValidation = await validatePageSessionInDB(token);

  if (!pageValidation.valid) {
    console.log(`🚫 [MIDDLEWARE] Sesión inválida para página ${pathname}`);

    // Solo revocar sesión si shouldRevoke es true (casos específicos)
    if (pageValidation.shouldRevoke) {
      console.log(`🚫 [MIDDLEWARE] Revocando sesión por: ${pageValidation.code}`);
      return await revokeSession(req, token.sessionId);
    }

    // Si no es para revocar, redirect normal al login sin limpiar cookies
    console.log(`⚠️ [MIDDLEWARE] Sesión inválida pero no se revoca: ${pageValidation.code}`);
    return NextResponse.redirect(new URL("/login?authorize=SessionInvalid", req.url));
  }

  // Actualizar actividad para sesiones de página también
  if (pageValidation.sessionId) {
    await updateSessionActivity(pageValidation.sessionId);
  }

  console.log(`✅ [MIDDLEWARE] Sesión de página válida para ${pageValidation.user.username} en ${pathname}`);

  // 🛡️ VERIFICACIÓN DE PERMISOS (basado en ROUTE_PERMISSIONS)
  const routeKey = Object.keys(ROUTE_PERMISSIONS).find(route => matchRoute(pathname, route));
  const allowedRoles = routeKey ? ROUTE_PERMISSIONS[routeKey] : null;
  
  if (!allowedRoles) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized", message: "Access denied" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/403", req.url));
  }

  // Verificar si el usuario tiene permisos (AUTHENTICATED permite cualquier usuario autenticado)
  const hasPermission = allowedRoles.length === 0 || allowedRoles.includes(token.roleId);
  
  if (!hasPermission) {
    console.log(`❌ [MIDDLEWARE] Acceso denegado: roleId ${token.roleId} no permitido en ruta ${pathname}`);
    
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ 
        error: "Forbidden", 
        message: `Rol ${token.roleId} no tiene permisos para acceder a ${pathname}`,
        requiredRoles: allowedRoles 
      }, { status: 403 });
    }
    
    return NextResponse.redirect(new URL("/403", req.url));
  }

  // ✅ Acceso permitido
  console.log(`✅ [MIDDLEWARE] Acceso permitido: roleId ${token.roleId} en ruta ${pathname}`);
  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/health",
    "/api/v1/health",
    "/perfil",
    "/building",
    "/proceso/analisis",
    "/proceso/iniciar",

    // BARCO
    // "/api/v1/barcos",
    // "/api/v1/barcos/:path*",
    "/proceso/iniciar/barco",
    "/proceso/consultar/barco",

    // BITÁCORAS
    // "/api/v1/bitacoras",
    // "/api/v1/bitacoras/:path*",
    // "/api/v1/bitacoras/export-excel",
    "/proceso/consultar/bitacora",
    "/proceso/editar/bitacora",

    // EQUIPOS
    // "/api/v1/equipos",
    // "/api/v1/equipos/:path*",
    // "/api/v1/equipos/export-excel",
    "/proceso/iniciar/equipo",
    "/proceso/consultar/equipo",

    // RECEPCIÓN
    // "/api/v1/recepcion",
    // "/api/v1/recepcion/:path*",
    // "/api/v1/recepcion/bitacoras/:path*",
    // "/api/v1/recepcion/barcos",
    // "/api/v1/recepcion/productos",
    // "/api/v1/recepcion/barcos/:path*",
    // "/api/v1/recepcion/productos/:path*",
    // "/api/v1/recepcion/export-excel",
    // "/api/v1/recepcion/transportes",
    // "/api/v1/recepcion/transportes/:path*",
    // "/api/v1/transportes",
    "/proceso/iniciar/recepcion",
    "/proceso/editar/recepcion",
    "/proceso/consultar/recepcion",
    "/proceso/consultar/recepcion/barcos",

    // ADMIN
    "/usuarios",
    "/sesiones",
    // "/api/v1/users/:path*",
    // "/api/v1/roles/:path*",
    // "/api/v1/users",
    // "/api/v1/roles",
  ],
};