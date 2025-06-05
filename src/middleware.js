import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Mantener toda la configuración original igual...
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

async function validateSessionInDB(token, req) {
  console.log(`🔍 [validateSessionInDB] Iniciando validación para ${token.username}`);
  console.log(`📊 [validateSessionInDB] sessionId: ${token.sessionId}, sessionReady: ${token.sessionReady}`);
  
  if (!token.sessionId) {
    console.log("⚠️ [validateSessionInDB] Token sin sessionId, permitiendo acceso por compatibilidad");
    return true;
  }
  
  if (!token.sessionReady) {
    console.log("⏳ [validateSessionInDB] Sesión no lista, esperando...");
    
    const maxWaitTime = 3000;
    const retryInterval = 200;
    const maxRetries = maxWaitTime / retryInterval;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 [validateSessionInDB] Intento ${attempt}/${maxRetries} esperando sesión lista`);
      
      await new Promise(resolve => setTimeout(resolve, retryInterval));
      
      try {
        const updatedToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        if (updatedToken && updatedToken.sessionReady) {
          console.log(`✅ [validateSessionInDB] Sesión lista en intento ${attempt}`);
          token = updatedToken;
          break;
        }
      } catch (error) {
        console.error(`❌ [validateSessionInDB] Error obteniendo token actualizado:`, error);
      }
      
      if (attempt === maxRetries) {
        console.log(`⚠️ [validateSessionInDB] Sesión no lista después de ${maxWaitTime}ms, usando modo degradado`);
        return true;
      }
    }
  }
  
  try {
    console.log(`📡 [validateSessionInDB] Realizando validación HTTP para sessionId: ${token.sessionId}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`⏰ [validateSessionInDB] Timeout de validación`);
      controller.abort();
    }, 5000);
    
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
    
    console.log(`📊 [validateSessionInDB] Respuesta HTTP: status=${response.status}, ok=${response.ok}`);
    
    if (!response.ok) {
      console.log(`❌ [validateSessionInDB] Response no OK: ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    console.log(`📄 [validateSessionInDB] Datos de respuesta:`, data);
    
    return data.valid === true;
  } catch (error) {
    console.error("💥 [validateSessionInDB] Error validando sesión en DB:", error);
    
    if (error.name === 'AbortError') {
      console.log("⚠️ [validateSessionInDB] Timeout - usando modo degradado");
    } else {
      console.log("⚠️ [validateSessionInDB] Error de red - usando modo degradado");
    }
    return true;
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  console.log(`🛣️ [middleware] Procesando ruta: ${pathname}`);

  // NUEVO: Debug de cookies
  const cookies = req.cookies.getAll();
  console.log(`🍪 [middleware] Cookies disponibles:`, cookies.map(c => ({ name: c.name, value: c.value?.substring(0, 20) + '...' })));

  if (PUBLIC_ROUTES.some(r => matchRoute(pathname, r))) {
    console.log(`🟢 [middleware] Ruta pública permitida: ${pathname}`);
    return applySecurityHeaders(NextResponse.next());
  }

  // MEJORADO: Debug del proceso de obtención de token
  console.log(`🔑 [middleware] Obteniendo token para ${pathname}...`);
  console.log(`🔧 [middleware] NEXTAUTH_SECRET configurado: ${!!process.env.NEXTAUTH_SECRET}`);
  
  const token = await getToken({ 
    req, 
    secret: process.env.NEXTAUTH_SECRET,
    debug: process.env.NEXTAUTH_DEBUG === 'true' 
  });
  
  console.log(`🎫 [middleware] Resultado de getToken:`, {
    tokenExists: !!token,
    username: token?.username,
    roleId: token?.roleId,
    sessionId: token?.sessionId,
    sessionReady: token?.sessionReady,
    iat: token?.iat,
    exp: token?.exp,
    tokenAge: token?.iat ? Date.now() / 1000 - token.iat : 'N/A'
  });
  
  if (!token) {
    console.log(`❌ [middleware] No hay token para ${pathname}, redirigiendo a login`);
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Not authenticated", message: "Authentication required" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login?authorize=SessionRequired", req.url));
  }

  if (token.sessionId && !pathname.startsWith("/api/auth/validate-session")) {
    console.log(`🔍 [middleware] Validando sesión en DB para usuario: ${token.username}`);
    
    const isValidSession = await validateSessionInDB(token, req);
    console.log(`📊 [middleware] Resultado de validación: ${isValidSession}`);
    
    if (!isValidSession) {
      console.log(`❌ [middleware] Sesión inválida o expirada para usuario ${token.username}`);
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Session expired", message: "Session has been revoked or expired" }, { status: 401 });
      }
      const response = NextResponse.redirect(new URL("/login?authorize=SessionExpired", req.url));
      response.cookies.delete("next-auth.session-token");
      response.cookies.delete("next-auth.csrf-token");
      return response;
    }
    
    console.log(`✅ [middleware] Sesión válida confirmada para usuario: ${token.username}`);
  } else if (!token.sessionId) {
    console.log(`⚠️ [middleware] Token sin sessionId para ${token.username} - sesión antigua o modo degradado`);
  }

  console.log(`🔐 [middleware] Verificando permisos para ruta: ${pathname}`);
  const routeKey = Object.keys(ROUTE_PERMISSIONS).find(route => matchRoute(pathname, route));
  const allowedRoles = routeKey ? ROUTE_PERMISSIONS[routeKey] : null;
  
  if (!allowedRoles) {
    console.log(`❌ [middleware] Ruta no encontrada en permisos: ${pathname}`);
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized", message: "Access denied" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/403", req.url));
  }
  
  console.log(`📋 [middleware] Roles permitidos para ${pathname}:`, allowedRoles);
  console.log(`👤 [middleware] Rol del usuario: ${token.roleId}`);
  
  if (allowedRoles.length === 0 || allowedRoles.includes(token.roleId)) {
    console.log(`✅ [middleware] Acceso permitido para ${token.username} en ${pathname}`);
    return applySecurityHeaders(NextResponse.next());
  }

  console.log(`❌ [middleware] Acceso denegado: roleId ${token.roleId} no permitido en ruta ${pathname}`);
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