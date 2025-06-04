import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// 1) Definición de roles en español (dinámico desde DB, con fallback)
const ROLES_FALLBACK = {
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
  ADMIN_ONLY: [1], // ADMINISTRADOR
  MUELLERO: [1, 2, 7, 4], // ADMINISTRADOR, MUELLERO, MUELLERO_CHEQUERO, AUDITOR_PROCESOS
  MUELLERO_LIMITED: [1, 4], // ADMINISTRADOR, AUDITOR_PROCESOS
  EQUIPOS: [1, 5, 6], // ADMINISTRADOR, OPERADOR, SUPERVISOR_MANTENIMIENTO
  EQUIPOS_LIMITED: [1, 6], // ADMINISTRADOR, SUPERVISOR_MANTENIMIENTO
  RECEPCION_FULL: [1, 3, 4, 7], // ADMINISTRADOR, CHEQUERO, AUDITOR_PROCESOS, MUELLERO_CHEQUERO
  PROCESS_FULL: [1, 2, 3, 7], // ADMINISTRADOR, MUELLERO, CHEQUERO, MUELLERO_CHEQUERO
  RECEPCION_LIMITED: [1, 4], // ADMINISTRADOR, AUDITOR_PROCESOS
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

  // Barco y Bitácoras
  "/proceso/iniciar/barco": PERMISSIONS.MUELLERO,
  "/proceso/consultar/barco": PERMISSIONS.MUELLERO,
  "/proceso/consultar/bitacora": PERMISSIONS.MUELLERO,
  "/proceso/editar/bitacora": PERMISSIONS.ADMIN_ONLY,

  // Equipos
  "/proceso/iniciar/equipo": PERMISSIONS.EQUIPOS,
  "/proceso/consultar/equipo": PERMISSIONS.EQUIPOS,

  // Recepción
  "/proceso/iniciar/recepcion": PERMISSIONS.RECEPCION_FULL,
  "/proceso/consultar/recepcion": PERMISSIONS.RECEPCION_FULL,
  "/proceso/consultar/recepcion/barcos": PERMISSIONS.RECEPCION_FULL,
  "/proceso/editar/recepcion": PERMISSIONS.ADMIN_ONLY,
};

// 6) Headers de seguridad
const SecurityHeaders = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function applySecurityHeaders(response) {
  Object.entries(SecurityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
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

// 10) 🆕 Validar sesión de página contra DB usando el token de NextAuth
async function validatePageSessionInDB(nextAuthToken) {
  try {
    // Verificar que tenemos la información necesaria del token
    if (!nextAuthToken || !nextAuthToken.id || !nextAuthToken.sessionId) {
      console.log('⚠️ [VALIDATE PAGE] Token de NextAuth incompleto');
      return { valid: false, shouldRevoke: false };
    }

    // El token dbToken contiene el JWT que se almacenó en la base de datos
    const dbToken = nextAuthToken.dbToken;
    const userId = nextAuthToken.id;
    const sessionId = nextAuthToken.sessionId;
    
    if (!dbToken) {
      console.log('⚠️ [VALIDATE PAGE] No hay dbToken en NextAuth token');
      return { valid: false, shouldRevoke: false };
    }

    // Validar contra la base de datos
    const baseUrl = process.env.NEXTAUTH_URL;
    const response = await fetch(`${baseUrl}/api/auth/validate-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: dbToken, // Usar el token que se almacenó en DB
        userId: userId,
        sessionId: sessionId,
        isPageValidation: true
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log(`❌ [VALIDATE PAGE] Sesión inválida en DB: ${errorData.code}`);
      
      // Usar el shouldRevoke que viene de la API validate-session
      const shouldRevoke = errorData.shouldRevoke || false;
      
      return { 
        valid: false, 
        shouldRevoke: shouldRevoke,
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
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });
    }

    // Crear respuesta de redirect al login con cookies limpiadas
    const loginUrl = new URL("/login?error=SessionRevoked", req.url);
    const response = NextResponse.redirect(loginUrl);
    
    // Limpiar cookies de NextAuth (todas las variantes posibles)
    const cookiesToClear = [
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      'next-auth.csrf-token',
      '__Secure-next-auth.csrf-token',
      'next-auth.callback-url',
      '__Secure-next-auth.callback-url'
    ];

    cookiesToClear.forEach(cookieName => {
      response.cookies.set(cookieName, '', {
        expires: new Date(0),
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
      });
    });
    
    console.log(`✅ [REVOKE SESSION] Sesión revocada y cookies limpiadas`);
    return response;
    
  } catch (error) {
    console.error('❌ [REVOKE SESSION] Error revocando sesión:', error);
    // Fallback: redirect simple al login
    return NextResponse.redirect(new URL("/login?error=SessionError", req.url));
  }
}

// 12) 🆕 Actualizar actividad de sesión
async function updateSessionActivity(sessionId) {
  try {
    if (!sessionId) return;
    
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/auth/update-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ [ACTIVITY] Actividad actualizada para sesión ${sessionId}`);
    } else {
      console.log(`⚠️ [ACTIVITY] No se pudo actualizar actividad para sesión ${sessionId}`);
    }
  } catch (error) {
    console.error('❌ [MIDDLEWARE] Error actualizando actividad:', error);
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  console.log(`🔍 [MIDDLEWARE] Procesando ruta: ${pathname}`);

  // Rutas públicas - permitir acceso directo
  if (PUBLIC_ROUTES.some(r => matchRoute(pathname, r))) {
    console.log(`✅ [MIDDLEWARE] Ruta pública permitida: ${pathname}`);
    return applySecurityHeaders(NextResponse.next());
  }

  // 1. Obtener token de NextAuth
  let token = null;
  try {
    token = await getToken({ 
      req, 
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: process.env.NODE_ENV === 'production' 
        ? '__Secure-next-auth.session-token' 
        : 'next-auth.session-token'
    });
  } catch (error) {
    console.error('❌ [MIDDLEWARE] Error obteniendo token NextAuth:', error);
  }

  // Si no hay token, redirigir al login
  if (!token) {
    console.log(`❌ [MIDDLEWARE] No hay token NextAuth para ${pathname}`);
    
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ 
        error: "Not authenticated", 
        message: "Authentication required",
        code: "NO_TOKEN"
      }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login?error=AuthRequired", req.url));
  }

  console.log(`🔑 [MIDDLEWARE] Token NextAuth encontrado para usuario: ${token.username} (roleId: ${token.roleId})`);

  // 2. 🆕 Validar sesión contra base de datos
  const pageValidation = await validatePageSessionInDB(token);
  
  if (!pageValidation.valid) {
    console.log(`🚫 [MIDDLEWARE] Sesión inválida para página ${pathname}: ${pageValidation.code}`);
    
    // Solo revocar sesión si shouldRevoke es true (casos específicos)
    if (pageValidation.shouldRevoke) {
      console.log(`🚫 [MIDDLEWARE] Revocando sesión por: ${pageValidation.code}`);
      return await revokeSession(req, token.sessionId);
    }
    
    // Si no es para revocar, redirect normal al login sin limpiar cookies
    console.log(`⚠️ [MIDDLEWARE] Sesión inválida pero no se revoca: ${pageValidation.code}`);
    
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ 
        error: "Session invalid", 
        message: "Please log in again",
        code: pageValidation.code
      }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login?error=SessionInvalid", req.url));
  }

  // 3. 🆕 Actualizar actividad para sesiones de página también
  if (pageValidation.sessionId) {
    await updateSessionActivity(pageValidation.sessionId);
  }

  console.log(`✅ [MIDDLEWARE] Sesión de página válida para ${pageValidation.user.username} en ${pathname}`);

  // 🛡️ VERIFICACIÓN DE PERMISOS (basado en ROUTE_PERMISSIONS)
  const routeKey = Object.keys(ROUTE_PERMISSIONS).find(route => matchRoute(pathname, route));
  const allowedRoles = routeKey ? ROUTE_PERMISSIONS[routeKey] : null;
  
  if (!allowedRoles) {
    console.log(`⚠️ [MIDDLEWARE] Ruta no definida en permisos: ${pathname}`);
    
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ 
        error: "Unauthorized", 
        message: "Access denied - route not configured",
        code: "ROUTE_NOT_CONFIGURED"
      }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/403", req.url));
  }

  // Verificar si el usuario tiene permisos (AUTHENTICATED permite cualquier usuario autenticado)
  const hasPermission = allowedRoles.length === 0 || allowedRoles.includes(token.roleId);
  
  if (!hasPermission) {
    console.log(`❌ [MIDDLEWARE] Acceso denegado: roleId ${token.roleId} (${token.roleName}) no permitido en ruta ${pathname}`);
    
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ 
        error: "Forbidden", 
        message: `Rol ${token.roleName || token.roleId} no tiene permisos para acceder a ${pathname}`,
        requiredRoles: allowedRoles,
        userRole: token.roleId,
        code: "INSUFFICIENT_PERMISSIONS"
      }, { status: 403 });
    }
    
    return NextResponse.redirect(new URL("/403", req.url));
  }

  // ✅ Acceso permitido
  console.log(`✅ [MIDDLEWARE] Acceso permitido: roleId ${token.roleId} (${token.roleName}) en ruta ${pathname}`);
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