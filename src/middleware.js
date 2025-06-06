// middleware.js - Middleware optimizado para Vercel
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
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

// Configuración de cookies para diferentes ambientes
const isProduction = process.env.NODE_ENV === 'production';
const domain = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).hostname : undefined;

// Función para limpiar cookies de autenticación
function clearAuthCookies(response) {
  const cookieNames = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.csrf-token', 
    '__Host-next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
    'next-auth.pkce.code_verifier',
    '__Secure-next-auth.pkce.code_verifier',
    'next-auth.state',
    '__Secure-next-auth.state',
    'next-auth.nonce',
    '__Secure-next-auth.nonce',
  ];

  cookieNames.forEach(name => {
    // Limpiar para el dominio actual
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      domain: isProduction ? domain : undefined,
      expires: new Date(0),
      maxAge: 0,
    });
    
    // Limpiar sin dominio (para localhost)
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
      maxAge: 0,
    });
  });

  return response;
}

// Función para aplicar headers de seguridad
function applySecurityHeaders(response) {
  Object.entries(SecurityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // CSP específico para la aplicación
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', csp);
  return response;
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

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const response = NextResponse.next();

  // Aplicar headers de seguridad a todas las respuestas
  applySecurityHeaders(response);

  // Permitir rutas públicas
  if (isPublicRoute(pathname)) {
    return response;
  }

  try {
    // Verificar token JWT con configuración específica para Vercel
    const token = await getToken({ 
      req, 
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: isProduction,
      salt: isProduction ? '__Secure-authjs.session-token' : 'authjs.session-token',
    });

    if (!token) {
      console.log(`❌ [middleware] No token found for ${pathname}`);
      
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ 
          error: "Not authenticated", 
          message: "Authentication required",
          code: "AUTH_REQUIRED"
        }, { status: 401 });
      }
      
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("authorize", "SessionRequired");
      loginUrl.searchParams.set("callbackUrl", req.url);
      
      const redirectResponse = NextResponse.redirect(loginUrl);
      return clearAuthCookies(redirectResponse);
    }

    // Verificar expiración del token
    const tokenAge = Date.now() - (token.loginTime || 0);
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas
    const inactivityLimit = 12 * 60 * 60 * 1000; // 12 horas de inactividad
    
    const isTokenExpired = tokenAge > maxAge;
    const isInactive = token.lastActivity && (Date.now() - token.lastActivity) > inactivityLimit;
    
    if (isTokenExpired || isInactive) {
      const reason = isTokenExpired ? "TokenExpired" : "InactivityTimeout";
      console.log(`⏰ [middleware] ${reason} para usuario ${token.username}`);
      
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ 
          error: "Token expired", 
          message: "Please login again",
          code: reason.toUpperCase()
        }, { status: 401 });
      }
      
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("authorize", reason);
      loginUrl.searchParams.set("callbackUrl", req.url);
      
      const redirectResponse = NextResponse.redirect(loginUrl);
      return clearAuthCookies(redirectResponse);
    }

    // Verificación de permisos por ruta
    const routeKey = Object.keys(ROUTE_PERMISSIONS).find(route => matchRoute(pathname, route));
    const allowedRoles = routeKey ? ROUTE_PERMISSIONS[routeKey] : PERMISSIONS.AUTHENTICATED;
    
    // Verificar permisos
    if (allowedRoles.length === 0 || allowedRoles.includes(token.roleId)) {
      // Actualizar timestamp de última actividad en el header
      response.headers.set('X-Last-Activity', Date.now().toString());
      return response;
    }

    // Acceso denegado
    console.log(`🚫 [middleware] Acceso denegado: roleId ${token.roleId} no permitido en ruta ${pathname}`);
    
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ 
        error: "Insufficient permissions", 
        message: "Access denied",
        code: "INSUFFICIENT_PERMISSIONS"
      }, { status: 403 });
    }
    
    return NextResponse.redirect(new URL("/403", req.url));

  } catch (error) {
    console.error(`💥 [middleware] Error procesando ${pathname}:`, error);
    
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ 
        error: "Internal server error", 
        message: "Authentication verification failed",
        code: "AUTH_ERROR"
      }, { status: 500 });
    }
    
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("authorize", "AuthError");
    const redirectResponse = NextResponse.redirect(loginUrl);
    return clearAuthCookies(redirectResponse);
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