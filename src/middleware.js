// ============================================================================
// SOLUCIÓN COOKIES: /lib/auth.js - Configuración específica para Vercel
// ============================================================================

import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { RateLimiterMemory } from "rate-limiter-flexible";
const UAParser = require("ua-parser-js");

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma || new PrismaClient({ log: ["error", "warn"] });
globalForPrisma.prisma = prisma;

const rateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 30,
});

function extractDeviceInfo(req) {
  const userAgent = req.headers["user-agent"] || "";
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  return {
    deviceOS: result.os.name ? `${result.os.name} ${result.os.version || ""}`.trim() : null,
    browser: result.browser.name ? `${result.browser.name} ${result.browser.version || ""}`.trim() : null,
    deviceModel: result.device.model || null,
    deviceType: result.device.type || "desktop",
    ipAddress: req.headers["x-forwarded-for"]?.split(",")[0] || 
               req.headers["x-real-ip"] || 
               req.socket?.remoteAddress || 
               null,
  };
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials, req) {
        const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

        try {
          await rateLimiter.consume(ip);
        } catch {
          throw new Error("Demasiados intentos. Intenta de nuevo más tarde.");
        }

        console.log(`🔑 [authorize] Intento login: ${credentials?.username}`);

        if (!credentials?.username || !credentials?.password) {
          throw new Error("Usuario o contraseña inválidos");
        }

        const username = credentials.username.trim().toLowerCase();
        const password = credentials.password;

        const user = await prisma.user.findUnique({
          where: { username },
          include: { role: true },
        });

        const hash = user ? user.password : "$2a$10$C6UzMDM.H6dfI/f/IKcEeO";
        const valid = await bcrypt.compare(password, hash);

        if (!user || user.eliminado || !user.activo || !valid) {
          console.log(`❌ [authorize] Credenciales inválidas para ${username}`);
          throw new Error("Usuario o contraseña inválidos");
        }

        console.log(`✅ [authorize] Login OK: ${username}`);
        await rateLimiter.delete(ip);

        const deviceInfo = extractDeviceInfo(req);
        
        return {
          id: user.id,
          username: user.username,
          roleId: user.roleId,
          roleName: user.role.name,
          codigo: user.codigo,
          nombreCompleto: user.nombreCompleto,
          deviceInfo,
        };
      },
    }),
  ],

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // 12 horas
  },

  jwt: {
    maxAge: 12 * 60 * 60, // 12 horas
  },

  // CRÍTICO: Configuración específica de cookies para Vercel
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // CLAVE: No especificar dominio para que funcione en todos los subdominios de Vercel
        domain: undefined,
      }
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: undefined,
      }
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: undefined,
      }
    },
    pkceCodeVerifier: {
      name: `next-auth.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 900, // 15 minutos
        domain: undefined,
      }
    },
    state: {
      name: `next-auth.state`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 900, // 15 minutos  
        domain: undefined,
      }
    },
  },

  callbacks: {
    async jwt({ token, user }) {
      console.log(`🔄 [JWT] Callback - user: ${!!user}, token.id: ${!!token.id}`);
      
      if (user && !token.id) {
        console.log(`🆕 [JWT] Primer login para ${user.username}`);
        
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Asignar datos al token inmediatamente
        token.id = user.id;
        token.username = user.username;
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.codigo = user.codigo;
        token.nombreCompleto = user.nombreCompleto;
        token.sessionId = sessionId;
        
        console.log(`🔄 [JWT] Token creado para ${user.username} con ID: ${sessionId}`);
        
        // Crear sesión en DB de forma asíncrona
        setImmediate(async () => {
          try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 12);
            
            await prisma.userSession.updateMany({
              where: {
                userId: user.id,
                isActive: true,
              },
              data: {
                isActive: false,
                endedAt: new Date(),
                endReason: "Nueva sesión iniciada",
              },
            });
            
            await prisma.userSession.create({
              data: {
                userId: user.id,
                sessionToken: sessionId,
                isActive: true,
                expiresAt,
                deviceOS: user.deviceInfo?.deviceOS || null,
                browser: user.deviceInfo?.browser || null,
                deviceModel: user.deviceInfo?.deviceModel || null,
                deviceType: user.deviceInfo?.deviceType || "desktop",
                ipAddress: user.deviceInfo?.ipAddress || null,
                createdAt: new Date(),
                lastActivity: new Date(),
              },
            });
            
            console.log(`✅ [JWT] Sesión creada en DB para ${user.username}`);
            
          } catch (error) {
            console.error("❌ [JWT] Error al crear sesión en DB:", error);
          }
        });
      }
      
      console.log(`📊 [JWT] Token final:`, {
        username: token.username,
        sessionId: token.sessionId,
        roleId: token.roleId,
        iat: token.iat,
        exp: token.exp
      });
      
      return token;
    },
    
    async session({ session, token }) {
      console.log(`🕒 [session] Generando sesión para ${token?.username}`);
      
      if (token) {
        session.user = {
          id: token.id,
          username: token.username,
          roleId: token.roleId,
          roleName: token.roleName,
          codigo: token.codigo,
          nombreCompleto: token.nombreCompleto,
        };
        session.sessionId = token.sessionId;
        console.log(`✅ [session] Sesión creada para ${token.username}`);
      }
      
      return session;
    },
    
    async signIn({ user, account }) {
      console.log(`✅ [signIn] Callback para ${user.username}`);
      return true;
    },
  },

  events: {
    async signOut(message) {
      if (message?.token?.sessionId) {
        try {
          await prisma.userSession.updateMany({
            where: {
              sessionToken: message.token.sessionId,
              isActive: true,
            },
            data: {
              isActive: false,
              endedAt: new Date(),
              endReason: "Logout",
            },
          });
          console.log(`🚪 [signOut] Sesión terminada: ${message.token.sessionId}`);
        } catch (error) {
          console.error("❌ [signOut] Error:", error);
        }
      }
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  
  // NUEVO: Configuración específica para debugging
  debug: process.env.NODE_ENV === 'development',
  
  // NUEVO: Logger para ver problemas de cookies
  logger: {
    error(code, metadata) {
      console.error(`🚨 [NextAuth Error] ${code}:`, metadata);
    },
    warn(code) {
      console.warn(`⚠️ [NextAuth Warning] ${code}`);
    },
    debug(code, metadata) {
      console.log(`🐛 [NextAuth Debug] ${code}:`, metadata);
    }
  }
};

// ============================================================================
// MIDDLEWARE CON DEBUG DE COOKIES: middleware.js
// ============================================================================

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

function applySecurityHeaders(response) {
  // REDUCIDO: Solo headers esenciales que no interfieren con cookies
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  
  // REMOVIDO temporalmente HSTS para debug
  // response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  
  return response;
}

function matchRoute(path, pattern) {
  if (pattern.includes(":path*")) {
    return path.startsWith(pattern.replace("/:path*", ""));
  }
  return path === pattern;
}

async function validateSessionInDB(token, req) {
  console.log(`🔍 [validateSessionInDB] Validando ${token.username} con sessionId: ${token.sessionId}`);
  
  if (!token.sessionId) {
    console.log("⚠️ [validateSessionInDB] Sin sessionId, modo degradado");
    return true;
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
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
      return true;
    }
    
    const data = await response.json();
    const isValid = data.valid === true;
    console.log(`📊 [validateSessionInDB] Resultado: ${isValid}`);
    return isValid;
    
  } catch (error) {
    console.error("💥 [validateSessionInDB] Error, modo degradado:", error.message);
    return true;
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  console.log(`🛣️ [middleware] ${pathname}`);

  // NUEVO: Debug detallado de cookies
  const allCookies = req.cookies.getAll();
  console.log(`🍪 [middleware] Cookies recibidas (${allCookies.length}):`, allCookies.map(c => ({
    name: c.name,
    hasValue: !!c.value,
    valueLength: c.value?.length || 0,
    valuePreview: c.value?.substring(0, 20) + '...'
  })));

  // Buscar específicamente la cookie de sesión
  const sessionCookie = req.cookies.get('next-auth.session-token');
  console.log(`🔑 [middleware] Cookie de sesión:`, {
    exists: !!sessionCookie,
    hasValue: !!sessionCookie?.value,
    valueLength: sessionCookie?.value?.length || 0
  });

  if (PUBLIC_ROUTES.some(r => matchRoute(pathname, r))) {
    console.log(`🟢 [middleware] Ruta pública: ${pathname}`);
    return applySecurityHeaders(NextResponse.next());
  }

  // MEJORADO: Debug del proceso de getToken
  console.log(`🔑 [middleware] Intentando obtener token...`);
  console.log(`🔧 [middleware] NEXTAUTH_SECRET disponible: ${!!process.env.NEXTAUTH_SECRET}`);

  const token = await getToken({ 
    req, 
    secret: process.env.NEXTAUTH_SECRET,
    // NUEVO: Configuraciones adicionales para debug
    secureCookie: process.env.NODE_ENV === 'production',
    cookieName: 'next-auth.session-token'
  });
  
  console.log(`🎫 [middleware] Resultado getToken:`, {
    tokenExists: !!token,
    username: token?.username,
    roleId: token?.roleId,
    sessionId: token?.sessionId?.substring(0, 15) + '...',
    tokenIat: token?.iat,
    tokenExp: token?.exp,
    tokenValid: token?.exp ? token.exp > Date.now() / 1000 : 'N/A'
  });
  
  if (!token) {
    console.log(`❌ [middleware] Sin token para ${pathname}, redirigiendo a login`);
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login?authorize=SessionRequired", req.url));
  }

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