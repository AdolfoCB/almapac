// middleware.js - Middleware CORREGIDO para Vercel
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Roles definidos
const ROLES = {
  ADMINISTRADOR: 1,
  MUELLERO: 2,
  CHEQUERO: 3,
  AUDITOR_PROCESOS: 4,
  OPERADOR: 5,
  SUPERVISOR_MANTENIMIENTO: 6,
  MUELLERO_CHEQUERO: 7,
};

// Rutas públicas
const PUBLIC_ROUTES = [
  "/login",
  "/api/auth",
  "/api/auth/callback",
  "/api/auth/session", 
  "/api/auth/signin",
  "/api/auth/signout",
  "/api/auth/providers",
  "/api/auth/csrf",
  "/health",
  "/api/v1/health",
  "/_next",
  "/favicon.ico",
];

// Grupos de permisos
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

// Permisos por ruta
const ROUTE_PERMISSIONS = {
  "/": PERMISSIONS.AUTHENTICATED,
  "/perfil": PERMISSIONS.AUTHENTICATED,
  "/proceso/iniciar": PERMISSIONS.AUTHENTICATED,
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

// Headers de seguridad optimizados para Vercel
const SecurityHeaders = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-XSS-Protection': '1; mode=block',
};

// 🔧 CONFIGURACIÓN CRÍTICA PARA DETECTAR URL EN VERCEL
function getBaseUrl(req) {
  // 1. NEXTAUTH_URL explícito
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  
  // 2. En desarrollo
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  
  // 3. Detectar desde headers de Vercel
  const host = req.headers.get('host');
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  
  if (host) {
    return `${protocol}://${host}`;
  }
  
  // 4. VERCEL_URL automático
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // 5. Fallback
  return 'https://almapac.vercel.app';
}

// Función para verificar rutas
function matchRoute(path, pattern) {
  if (pattern.includes(":path*")) {
    return path.startsWith(pattern.replace("/:path*", ""));
  }
  if (pattern.endsWith("*")) {
    return path.startsWith(pattern.slice(0, -1));
  }
  return path === pattern;
}

// Función para verificar si es ruta pública
function isPublicRoute(pathname) {
  return PUBLIC_ROUTES.some(route => {
    if (route.endsWith("*")) {
      return pathname.startsWith(route.slice(0, -1));
    }
    return matchRoute(pathname, route);
  });
}

// Función para aplicar headers de seguridad
function applySecurityHeaders(response) {
  Object.entries(SecurityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  
  // Log para debugging
  console.log(`🔍 [middleware] Procesando: ${pathname}`);

  // Aplicar headers de seguridad a todas las respuestas
  const response = NextResponse.next();
  applySecurityHeaders(response);

  // Permitir rutas públicas
  if (isPublicRoute(pathname)) {
    console.log(`✅ [middleware] Ruta pública permitida: ${pathname}`);
    return response;
  }

  try {
    // 🔥 CONFIGURACIÓN CRÍTICA PARA GETTOKEN EN VERCEL
    const baseUrl = getBaseUrl(req);
    
    // Configuración específica para getToken en Vercel
    const tokenOptions = {
      req,
      secret: process.env.NEXTAUTH_SECRET,
      // 🚨 CRÍTICO: Configurar cookieName basado en el entorno
      cookieName: process.env.NODE_ENV === 'production' 
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      // 🚨 CRÍTICO: Usar la URL detectada
      secureCookie: process.env.NODE_ENV === 'production',
      // Salt debe coincidir con la configuración de NextAuth
      salt: process.env.NODE_ENV === 'production' 
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
    };

    console.log(`🔧 [middleware] Usando baseUrl: ${baseUrl}`);
    console.log(`🍪 [middleware] Cookie name: ${tokenOptions.cookieName}`);

    // Verificar token JWT
    const token = await getToken(tokenOptions);

    if (!token) {
      console.log(`❌ [middleware] No token found for ${pathname}`);
      
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("authorize", "SessionRequired");
      loginUrl.searchParams.set("callbackUrl", req.url);
      
      console.log(`🔄 [middleware] Redirecting to: ${loginUrl.toString()}`);
      return NextResponse.redirect(loginUrl);
    }

    console.log(`✅ [middleware] Token encontrado para usuario: ${token.username}`);

    // Verificar expiración del token
    const tokenAge = Date.now() - (token.loginTime || 0);
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas
    const inactivityLimit = 12 * 60 * 60 * 1000; // 12 horas de inactividad
    
    const isTokenExpired = tokenAge > maxAge;
    const isInactive = token.lastActivity && (Date.now() - token.lastActivity) > inactivityLimit;
    
    if (isTokenExpired || isInactive) {
      const reason = isTokenExpired ? "TokenExpired" : "InactivityTimeout";
      console.log(`⏰ [middleware] ${reason} para usuario ${token.username}`);
      
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("authorize", reason);
      loginUrl.searchParams.set("callbackUrl", req.url);
      
      return NextResponse.redirect(loginUrl);
    }

    // Verificación de permisos por ruta
    const routeKey = Object.keys(ROUTE_PERMISSIONS).find(route => matchRoute(pathname, route));
    const allowedRoles = routeKey ? ROUTE_PERMISSIONS[routeKey] : PERMISSIONS.AUTHENTICATED;
    
    // Verificar permisos
    if (allowedRoles.length === 0 || allowedRoles.includes(token.roleId)) {
      console.log(`✅ [middleware] Acceso permitido para ${token.username} a ${pathname}`);
      // Actualizar timestamp de última actividad en el header
      response.headers.set('X-Last-Activity', Date.now().toString());
      return response;
    }

    // Acceso denegado
    console.log(`🚫 [middleware] Acceso denegado: roleId ${token.roleId} no permitido en ruta ${pathname}`);
    
    return NextResponse.redirect(new URL("/403", req.url));

  } catch (error) {
    console.error(`💥 [middleware] Error procesando ${pathname}:`, error);
    
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("authorize", "AuthError");
    return NextResponse.redirect(loginUrl);
  }
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
    // "/api/v1/:path*",
  ],
};