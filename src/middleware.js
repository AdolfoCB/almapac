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

// 10) Validar sesión de página contra DB
async function validatePageSessionInDB(nextAuthToken) {
  try {
    const apiToken = nextAuthToken.apiToken;
    const userId = nextAuthToken.id;

    if (!apiToken || !userId) {
      console.log('⚠️ [VALIDATE PAGE] Token de NextAuth sin apiToken o userId');
      return { valid: false, shouldRevoke: false }; 
    }

    const baseUrl = process.env.NEXTAUTH_URL;
    const response = await fetch(`${baseUrl}/api/auth/validate-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: apiToken,
        userId: userId,
        isApiToken: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log(`❌ [VALIDATE PAGE] Sesión inválida en DB: ${errorData.code}`);
      return { valid: false, shouldRevoke: errorData.shouldRevoke || false, error: errorData.error, code: errorData.code };
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
    return { valid: false, shouldRevoke: false };
  }
}

// 11) Revocar sesión (limpiar cookies y terminar en DB)
async function revokeSession(req, sessionId) {
  try {
    if (sessionId) {
      const baseUrl = process.env.NEXTAUTH_URL;
      await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    }

    const loginUrl = new URL("/login?authorize=SessionRevoked", req.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('next-auth.session-token');
    response.cookies.delete('__Secure-next-auth.session-token');
    response.cookies.delete('next-auth.csrf-token');
    response.cookies.delete('__Secure-next-auth.csrf-token');
    
    console.log(`✅ [REVOKE SESSION] Sesión revocada y cookies limpiadas`);
    return response;

  } catch (error) {
    console.error('❌ [REVOKE SESSION] Error revocando sesión:', error);
    return NextResponse.redirect(new URL("/login?authorize=SessionError", req.url));
  }
}

// 12) Actualizar actividad de sesión
async function updateSessionActivity(sessionId) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL;
    await fetch(`${baseUrl}/api/auth/update-activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  if (!token) {
    console.log("⚠️ [MIDDLEWARE] No se encontró un token de sesión");
    return NextResponse.redirect(new URL("/login?authorize=SessionRequired", req.url));
  }

  if (!token.apiToken || !token.id) {
    console.log("⚠️ [MIDDLEWARE] Token incompleto, faltan apiToken o userId");
    return NextResponse.redirect(new URL("/login?authorize=SessionInvalid", req.url));
  }

  const pageValidation = await validatePageSessionInDB(token);

  if (!pageValidation.valid) {
    console.log(`🚫 [MIDDLEWARE] Sesión inválida para página ${pathname}`);

    if (pageValidation.shouldRevoke) {
      console.log(`🚫 [MIDDLEWARE] Revocando sesión por: ${pageValidation.code}`);
      return await revokeSession(req, token.sessionId);
    }

    console.log(`⚠️ [MIDDLEWARE] Sesión inválida pero no se revoca: ${pageValidation.code}`);
    return NextResponse.redirect(new URL("/login?authorize=SessionInvalid", req.url));
  }

  if (pageValidation.sessionId) {
    await updateSessionActivity(pageValidation.sessionId);
  }

  console.log(`✅ [MIDDLEWARE] Sesión de página válida para ${pageValidation.user.username} en ${pathname}`);

  const routeKey = Object.keys(ROUTE_PERMISSIONS).find(route => matchRoute(pathname, route));
  const allowedRoles = routeKey ? ROUTE_PERMISSIONS[routeKey] : null;

  if (!allowedRoles) {
    return NextResponse.redirect(new URL("/403", req.url));
  }

  const hasPermission = allowedRoles.length === 0 || allowedRoles.includes(token.roleId);

  if (!hasPermission) {
    console.log(`❌ [MIDDLEWARE] Acceso denegado: roleId ${token.roleId} no permitido en ruta ${pathname}`);
    return NextResponse.redirect(new URL("/403", req.url));
  }

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
    "/proceso/iniciar/barco",
    "/proceso/consultar/barco",
    "/proceso/consultar/bitacora",
    "/proceso/editar/bitacora",
    "/proceso/iniciar/equipo",
    "/proceso/consultar/equipo",
    "/proceso/iniciar/recepcion",
    "/proceso/consultar/recepcion",
    "/proceso/consultar/recepcion/barcos",
    "/proceso/editar/recepcion",
    "/usuarios",
    "/sesiones",
  ],
};
