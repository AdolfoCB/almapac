// middleware.js
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
  RECEPCION_LIMITED: [ROLES.ADMINISTRADOR, ROLES.AUDITOR_PROCESOS],
};

// 6) Definición de permisos por ruta
const ROUTE_PERMISSIONS = {
  // Globales
  "/": PERMISSIONS.AUTHENTICATED,
  "/perfil": PERMISSIONS.AUTHENTICATED,
  "/proceso/iniciar": PERMISSIONS.AUTHENTICATED,
  "/building": PERMISSIONS.AUTHENTICATED,

  // ADMIN
  "/usuarios": PERMISSIONS.ADMIN_ONLY,
  "/sesiones": PERMISSIONS.ADMIN_ONLY,
  "/api/sessions": PERMISSIONS.ADMIN_ONLY,
  "/api/sessions/:path*": PERMISSIONS.ADMIN_ONLY,
  "/api/v1/users": PERMISSIONS.ADMIN_ONLY,
  "/api/v1/users/:path*": PERMISSIONS.ADMIN_ONLY,
  "/api/v1/roles": PERMISSIONS.ADMIN_ONLY,
  "/api/v1/roles/:path*": PERMISSIONS.ADMIN_ONLY,

  // Barco y Bitácoras
  "/proceso/iniciar/barco": PERMISSIONS.MUELLERO,
  "/proceso/consultar/barco": PERMISSIONS.MUELLERO,
  "/api/v1/bitacoras": PERMISSIONS.MUELLERO,
  "/api/v1/bitacoras/:path*": PERMISSIONS.MUELLERO,
  "/api/v1/bitacoras/export-excel": PERMISSIONS.MUELLERO_LIMITED,
  "/proceso/consultar/bitacora": PERMISSIONS.MUELLERO,
  "/proceso/editar/bitacora": PERMISSIONS.ADMIN_ONLY,

  // Equipos
  "/api/v1/equipos": PERMISSIONS.EQUIPOS,
  "/api/v1/equipos/export-excel": PERMISSIONS.EQUIPOS_LIMITED,
  "/proceso/iniciar/equipo": PERMISSIONS.EQUIPOS,
  "/proceso/consultar/equipo": PERMISSIONS.EQUIPOS,

  // Recepción
  "/api/v1/recepcion": PERMISSIONS.RECEPCION_FULL,
  "/api/v1/recepcion/bitacoras/:path*": PERMISSIONS.RECEPCION_FULL,
  "/api/v1/recepcion/barcos": PERMISSIONS.RECEPCION_FULL,
  "/proceso/iniciar/recepcion": PERMISSIONS.RECEPCION_FULL,
  "/proceso/consultar/recepcion": PERMISSIONS.RECEPCION_FULL,
  "/api/v1/recepcion/productos": PERMISSIONS.RECEPCION_LIMITED,
  "/api/v1/recepcion/barcos/:path*": PERMISSIONS.RECEPCION_LIMITED,
  "/api/v1/recepcion/productos/:path*": PERMISSIONS.RECEPCION_LIMITED,
  "/api/v1/recepcion/export-excel": PERMISSIONS.RECEPCION_LIMITED,
  "/api/v1/recepcion/transportes": PERMISSIONS.RECEPCION_LIMITED,
  "/api/v1/recepcion/transportes/:path*": PERMISSIONS.RECEPCION_LIMITED,
  "/api/v1/transportes": PERMISSIONS.RECEPCION_LIMITED,
  "/proceso/consultar/recepcion/barcos": PERMISSIONS.RECEPCION_FULL,
  "/api/v1/recepcion/:path*": PERMISSIONS.ADMIN_ONLY,
  "/proceso/editar/recepcion": PERMISSIONS.ADMIN_ONLY,
};

// 7) Headers de seguridad
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

// 8) Helper para coincidencia de rutas
function matchRoute(path, pattern) {
  if (pattern.includes(":path*")) {
    return path.startsWith(pattern.replace("/:path*", ""));
  }
  return path === pattern;
}

// 9) Función para validar sesión contra la DB
async function validateSessionInDB(token, req) {
  // Si no hay sessionId, es una sesión antigua sin sincronización DB
  if (!token.sessionId) {
    console.log("Token sin sessionId, permitiendo acceso por compatibilidad");
    return true;
  }
  
  try {
    const response = await fetch(new URL("/api/auth/validate-session", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: token.id,
        sessionId: token.sessionId,
      }),
    });
    
    const data = await response.json();
    return data.valid === true;
  } catch (error) {
    console.error("Error validando sesión en DB:", error);
    return true; // En caso de error, permitir continuar
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Rutas públicas
  if (PUBLIC_ROUTES.some(r => matchRoute(pathname, r))) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Token y sesión
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Not authenticated", message: "Authentication required" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login?authorize=SessionRequired", req.url));
  }

  // Validar sesión en la base de datos (solo para rutas no públicas y si hay sessionId)
  if (token.sessionId && !pathname.startsWith("/api/auth/validate-session")) {
    const isValidSession = await validateSessionInDB(token, req);
    if (!isValidSession) {
      console.log(`Sesión inválida o expirada para usuario ${token.username}`);
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Session expired", message: "Session has been revoked or expired" }, { status: 401 });
      }
      const response = NextResponse.redirect(new URL("/login?authorize=SessionExpired", req.url));
      response.cookies.delete("next-auth.session-token");
      response.cookies.delete("next-auth.csrf-token");
      return response;
    }
  }

  // Verificación de permisos
  const routeKey = Object.keys(ROUTE_PERMISSIONS).find(route => matchRoute(pathname, route));
  const allowedRoles = routeKey ? ROUTE_PERMISSIONS[routeKey] : null;
  if (!allowedRoles) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized", message: "Access denied" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/403", req.url));
  }
  if (allowedRoles.length === 0 || allowedRoles.includes(token.roleId)) {
    return applySecurityHeaders(NextResponse.next());
  }

  console.log(`Acceso denegado: roleId ${token.roleId} no permitido en ruta ${pathname}`);
  return NextResponse.redirect(new URL("/403", req.url));
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

    // BARCO
    "/proceso/iniciar/barco",
    "/proceso/consultar/barco",

    // BITÁCORAS
    "/proceso/consultar/bitacora",
    "/proceso/editar/bitacora",

    // EQUIPOS
    "/proceso/iniciar/equipo",
    "/proceso/consultar/equipo",

    // RECEPCIÓN
    "/proceso/iniciar/recepcion",
    "/proceso/editar/recepcion",
    "/proceso/consultar/recepcion",
    "/proceso/consultar/recepcion/barcos",

    // ADMIN
    "/usuarios",
    "/sesiones",
    // "/api/sessions",
    // "/api/sessions/:path*",
  ],
};