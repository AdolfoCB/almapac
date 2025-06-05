// ============================================================================
// 1. NUEVO: /lib/auth.js - Solo mover creación de sesión al JWT callback
// ============================================================================

import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { RateLimiterMemory } from "rate-limiter-flexible";
// Corrección: usar require para ua-parser-js
const UAParser = require("ua-parser-js");

// Instancia global de Prisma
const globalForPrisma = globalThis;
const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ log: ["error", "warn"] });
globalForPrisma.prisma = prisma;

// Configuración del rate limiter
const rateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 30,
});

// Función para extraer info del dispositivo
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
  adapter: PrismaAdapter(prisma),

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

        const hash = user
          ? user.password
          : "$2a$10$C6UzMDM.H6dfI/f/IKcEeO";

        const valid = await bcrypt.compare(password, hash);
        if (!user || user.eliminado || !user.activo || !valid) {
          console.log(`❌ [authorize] Credenciales inválidas para ${username}`);
          throw new Error("Usuario o contraseña inválidos");
        }

        console.log(`✅ [authorize] Login OK: ${username}`);
        await rateLimiter.delete(ip);

        // Extraer info del dispositivo
        const deviceInfo = extractDeviceInfo(req);
        
        // CAMBIO: No generar sessionId aquí, dejarlo para el JWT callback
        return {
          id: user.id,
          username: user.username,
          roleId: user.roleId,
          roleName: user.role.name,
          codigo: user.codigo,
          nombreCompleto: user.nombreCompleto,
          deviceInfo, // Incluir info del dispositivo para usarla en JWT
        };
      },
    }),
  ],

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60,
  },

  jwt: {
    maxAge: 12 * 60 * 60,
  },

  callbacks: {
    async jwt({ token, user, trigger }) {
      // CAMBIO CRÍTICO: Crear sesión en DB aquí en lugar de en signIn
      if (user && !token.sessionId) {
        // Generar sessionId único
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Poblar token inmediatamente
        token.id = user.id;
        token.username = user.username;
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.codigo = user.codigo;
        token.nombreCompleto = user.nombreCompleto;
        token.sessionId = sessionId;
        token.sessionReady = false; // Marca que aún no está lista en DB
        
        console.log(`🔄 [JWT] Creando sesión para ${user.username} con sessionId: ${sessionId}`);
        
        // Crear sesión en DB de forma síncrona (bloquear hasta completar)
        try {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 12); // 12 horas
          
          // Cerrar sesiones previas activas del mismo usuario
          const updateResult = await prisma.userSession.updateMany({
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
          
          console.log(`🔄 [JWT] Sesiones previas cerradas: ${updateResult.count}`);
          
          // Crear nueva sesión con la información del dispositivo
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
          
          // Marcar sesión como lista solo después de crearla exitosamente
          token.sessionReady = true;
          console.log(`✅ [JWT] Sesión creada exitosamente en DB para ${user.username}`);
          
          // Verificación adicional: confirmar que se creó
          const verifySession = await prisma.userSession.findFirst({
            where: {
              sessionToken: sessionId,
              isActive: true,
            }
          });
          
          if (!verifySession) {
            console.error(`❌ [JWT] ERROR CRÍTICO: Sesión no encontrada después de crear`);
            token.sessionReady = false;
          } else {
            console.log(`✅ [JWT] Sesión verificada en DB`);
          }
          
        } catch (error) {
          console.error("❌ [JWT] Error al crear sesión en DB:", error);
          // IMPORTANTE: No fallar el login, pero marcar sesión como no lista
          token.sessionReady = false;
        }
      }
      
      // Si trigger es "update", verificar si la sesión sigue activa
      if (trigger === "update" && token.sessionId && token.sessionReady) {
        try {
          const response = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/validate-session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: token.id,
              sessionId: token.sessionId,
            }),
          });
          
          const data = await response.json();
          if (!data.valid) {
            console.log(`❌ [JWT] Sesión revocada durante update para ${token.username}`);
            // Sesión revocada
            return null;
          }
        } catch (error) {
          console.error("❌ [JWT] Error validando sesión durante update:", error);
        }
      }
      
      return token;
    },
    
    async session({ session, token }) {
      session.user = {
        id: token.id,
        username: token.username,
        roleId: token.roleId,
        roleName: token.roleName,
        codigo: token.codigo,
        nombreCompleto: token.nombreCompleto,
      };
      session.sessionId = token.sessionId;
      session.sessionReady = token.sessionReady;
      console.log(`🕒 [session] Sesión para ${token.username} - sessionReady: ${token.sessionReady}`);
      return session;
    },
    
    // SIMPLIFICADO: signIn callback solo retorna true
    async signIn({ user, account, profile, email, credentials }) {
      // La lógica de creación de sesión se movió al JWT callback
      console.log(`✅ [signIn] Login completado para ${user.username}`);
      return true;
    },
  },

  events: {
    async signOut(message) {
      // message.token contiene el token JWT
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
          console.log(`🚪 [signOut] Sesión terminada para token ${message.token.sessionId}`);
        } catch (error) {
          console.error("❌ [signOut] Error al terminar sesión:", error);
        }
      }
    },
    async error({ error, method }) {
      console.warn(`[next-auth][${method}]`, error);
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// ============================================================================
// 2. MODIFICADO: middleware.js - Lógica original COMPLETA + validación mejorada
// ============================================================================

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

// 9) Función para validar sesión contra la DB - MEJORADA para manejar timing
async function validateSessionInDB(token, req) {
  console.log(`🔍 [validateSessionInDB] Iniciando validación para ${token.username}`);
  console.log(`📊 [validateSessionInDB] sessionId: ${token.sessionId}, sessionReady: ${token.sessionReady}`);
  
  // Si no hay sessionId, es una sesión antigua sin sincronización DB
  if (!token.sessionId) {
    console.log("⚠️ [validateSessionInDB] Token sin sessionId, permitiendo acceso por compatibilidad");
    return true;
  }
  
  // NUEVO: Si la sesión no está lista, esperar un poco y reintentar
  if (!token.sessionReady) {
    console.log("⏳ [validateSessionInDB] Sesión no lista, esperando...");
    
    // Esperar hasta 3 segundos con reintentos
    const maxWaitTime = 3000; // 3 segundos
    const retryInterval = 200; // 200ms entre reintentos
    const maxRetries = maxWaitTime / retryInterval;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 [validateSessionInDB] Intento ${attempt}/${maxRetries} esperando sesión lista`);
      
      // Esperar un poco
      await new Promise(resolve => setTimeout(resolve, retryInterval));
      
      // Volver a obtener el token actualizado
      try {
        const updatedToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        if (updatedToken && updatedToken.sessionReady) {
          console.log(`✅ [validateSessionInDB] Sesión lista en intento ${attempt}`);
          // Continuar con la validación usando el token actualizado
          token = updatedToken;
          break;
        }
      } catch (error) {
        console.error(`❌ [validateSessionInDB] Error obteniendo token actualizado:`, error);
      }
      
      // Si es el último intento y aún no está lista, usar modo degradado
      if (attempt === maxRetries) {
        console.log(`⚠️ [validateSessionInDB] Sesión no lista después de ${maxWaitTime}ms, usando modo degradado`);
        return true; // Permitir acceso en modo degradado
      }
    }
  }
  
  try {
    console.log(`📡 [validateSessionInDB] Realizando validación HTTP para sessionId: ${token.sessionId}`);
    
    // Timeout para evitar bloqueos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`⏰ [validateSessionInDB] Timeout de validación`);
      controller.abort();
    }, 5000); // 5 segundos timeout
    
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
    
    // En caso de error de red/timeout, usar modo degradado
    if (error.name === 'AbortError') {
      console.log("⚠️ [validateSessionInDB] Timeout - usando modo degradado");
    } else {
      console.log("⚠️ [validateSessionInDB] Error de red - usando modo degradado");
    }
    return true; // En caso de error, permitir continuar en modo degradado
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  console.log(`🛣️ [middleware] Procesando ruta: ${pathname}`);

  // Rutas públicas
  if (PUBLIC_ROUTES.some(r => matchRoute(pathname, r))) {
    console.log(`🟢 [middleware] Ruta pública permitida: ${pathname}`);
    return applySecurityHeaders(NextResponse.next());
  }

  // Token y sesión
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  console.log(`🎫 [middleware] Token obtenido:`, {
    exists: !!token,
    username: token?.username,
    roleId: token?.roleId,
    sessionId: token?.sessionId,
    sessionReady: token?.sessionReady
  });
  
  if (!token) {
    console.log(`❌ [middleware] No hay token para ${pathname}, redirigiendo a login`);
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Not authenticated", message: "Authentication required" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login?authorize=SessionRequired", req.url));
  }

  // CAMBIO: Validar sesión en la base de datos para TODAS las rutas autenticadas
  // (solo excluir la propia ruta de validación para evitar recursión infinita)
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

  // Verificación de permisos
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