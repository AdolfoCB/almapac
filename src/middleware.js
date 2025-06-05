import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const ROLES = {
  ADMINISTRADOR: 1,
  MUELLERO: 2,
  CHEQUERO: 3,
  AUDITOR_PROCESOS: 4,
  OPERADOR: 5,
  SUPERVISOR_MANTENIMIENTO: 6,
  MUELLERO_CHEQUERO: 7,
};

const PUBLIC_ROUTES = [
  "/login",
  "/api/auth",
  "/api/auth/path*",
  "/health",
  "/api/v1/health",
];

const PERMISSIONS = {
  AUTHENTICATED: [],
  ADMIN_ONLY: [ROLES.ADMINISTRADOR],
  MUELLERO: [ROLES.ADMINISTRADOR, ROLES.MUELLERO, ROLES.MUELLERO_CHEQUERO, ROLES.AUDITOR_PROCESOS],
  MUELLERO_LIMITED: [ROLES.ADMINISTRADOR, ROLES.AUDITOR_PROCESOS],
  EQUIPOS: [ROLES.ADMINISTRADOR, ROLES.OPERADOR, ROLES.SUPERVISOR_MANTENIMIENTO],
  EQUIPOS_LIMITED: [ROLES.ADMINISTRADOR, ROLES.SUPERVISOR_MANTENIMIENTO],
  RECEPCION_FULL: [ROLES.ADMINISTRADOR, ROLES.CHEQUERO, ROLES.AUDITOR_PROCESOS, ROLES.MUELLERO_CHEQUERO],
  RECEPCION_LIMITED: [ROLES.ADMINISTRADOR, ROLES.AUDITOR_PROCESOS],
};

const ROUTE_PERMISSIONS = {
  "/": PERMISSIONS.AUTHENTICATED,
  "/perfil": PERMISSIONS.AUTHENTICATED,
  "/proceso/iniciar": PERMISSIONS.AUTHENTICATED,
  "/building": PERMISSIONS.AUTHENTICATED,
  "/usuarios": PERMISSIONS.ADMIN_ONLY,
  "/sesiones": PERMISSIONS.ADMIN_ONLY,
  "/api/sessions": PERMISSIONS.ADMIN_ONLY,
  "/api/sessions/:path*": PERMISSIONS.ADMIN_ONLY,
  "/api/v1/users": PERMISSIONS.ADMIN_ONLY,
  "/api/v1/users/:path*": PERMISSIONS.ADMIN_ONLY,
  "/api/v1/roles": PERMISSIONS.ADMIN_ONLY,
  "/api/v1/roles/:path*": PERMISSIONS.ADMIN_ONLY,
  "/proceso/iniciar/barco": PERMISSIONS.MUELLERO,
  "/proceso/consultar/barco": PERMISSIONS.MUELLERO,
  "/api/v1/bitacoras": PERMISSIONS.MUELLERO,
  "/api/v1/bitacoras/:path*": PERMISSIONS.MUELLERO,
  "/api/v1/bitacoras/export-excel": PERMISSIONS.MUELLERO_LIMITED,
  "/proceso/consultar/bitacora": PERMISSIONS.MUELLERO,
  "/proceso/editar/bitacora": PERMISSIONS.ADMIN_ONLY,
  "/api/v1/equipos": PERMISSIONS.EQUIPOS,
  "/api/v1/equipos/export-excel": PERMISSIONS.EQUIPOS_LIMITED,
  "/proceso/iniciar/equipo": PERMISSIONS.EQUIPOS,
  "/proceso/consultar/equipo": PERMISSIONS.EQUIPOS,
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

function matchRoute(path, pattern) {
  if (pattern.includes(":path*")) {
    return path.startsWith(pattern.replace("/:path*", ""));
  }
  return path === pattern;
}

// SIMPLIFICADO: Validación de sesión sin complicaciones de timing
async function validateSessionInDB(token, req) {
  console.log(`🔍 [validateSessionInDB] Validando ${token.username} con sessionId: ${token.sessionId}`);
  
  if (!token.sessionId) {
    console.log("⚠️ [validateSessionInDB] Sin sessionId, modo degradado");
    return true;
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos
    
    const response = await fetch(new URL("/api/auth/validate-session", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: token.id,
        sessionId: token.sessionId,
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`❌ [validateSessionInDB] HTTP ${response.status}`);
      return true; // Modo degradado
    }
    
    const data = await response.json();
    const isValid = data.valid === true;
    console.log(`📊 [validateSessionInDB] Resultado: ${isValid}`);
    return isValid;
    
  } catch (error) {
    console.error("💥 [validateSessionInDB] Error, modo degradado:", error.message);
    return true; // Siempre permitir en caso de error
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  console.log(`🛣️ [middleware] ${pathname}`);

  // Rutas públicas
  if (PUBLIC_ROUTES.some(r => matchRoute(pathname, r))) {
    console.log(`🟢 [middleware] Ruta pública: ${pathname}`);
    return applySecurityHeaders(NextResponse.next());
  }

  // Obtener token
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  
  console.log(`🎫 [middleware] Token:`, {
    exists: !!token,
    username: token?.username,
    roleId: token?.roleId,
    sessionId: token?.sessionId?.substring(0, 10) + '...'
  });
  
  if (!token) {
    console.log(`❌ [middleware] Sin token, redirigiendo a login`);
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login?authorize=SessionRequired", req.url));
  }

  // Validar sesión en DB para TODAS las rutas autenticadas
  if (token.sessionId && !pathname.startsWith("/api/auth/validate-session")) {
    const isValidSession = await validateSessionInDB(token, req);
    
    if (!isValidSession) {
      console.log(`❌ [middleware] Sesión inválida para ${token.username}`);
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Session expired" }, { status: 401 });
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
    console.log(`❌ [middleware] Ruta no autorizada: ${pathname}`);
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/403", req.url));
  }
  
  if (allowedRoles.length === 0 || allowedRoles.includes(token.roleId)) {
    console.log(`✅ [middleware] Acceso permitido para ${token.username}`);
    return applySecurityHeaders(NextResponse.next());
  }

  console.log(`❌ [middleware] Rol ${token.roleId} no permitido en ${pathname}`);
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
    "/proceso/iniciar/barco",
    "/proceso/consultar/barco",
    "/proceso/consultar/bitacora",
    "/proceso/editar/bitacora",
    "/proceso/iniciar/equipo",
    "/proceso/consultar/equipo",
    "/proceso/iniciar/recepcion",
    "/proceso/editar/recepcion",
    "/proceso/consultar/recepcion",
    "/proceso/consultar/recepcion/barcos",
    "/usuarios",
    "/sesiones",
  ],
};