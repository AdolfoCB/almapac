// lib/auth.js - Configuración modificada para soportar Bearer tokens con gestión de sesiones en DB y tracking de dispositivos
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { RateLimiterMemory } from "rate-limiter-flexible";
import jwt from "jsonwebtoken";
import { UAParser } from 'ua-parser-js';

// Instancia global de Prisma
const globalForPrisma = globalThis;
const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ log: ["error", "warn"] });
globalForPrisma.prisma = prisma;

// Configuración del rate limiter: 5 intentos cada 30 segundos
const rateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 30,
});

// Límite máximo de sesiones activas por usuario
const MAX_SESSIONS_PER_USER = 3;

// 🆕 Mapeo de roles para compatibilidad
const ROLE_NAMES = {
  1: 'ADMINISTRADOR',
  2: 'MUELLERO', 
  3: 'CHEQUERO',
  4: 'AUDITOR_PROCESOS',
  5: 'OPERADOR',
  6: 'SUPERVISOR_MANTENIMIENTO',
  7: 'MUELLERO_CHEQUERO'
};

// ============================================================================
// 🔍 FUNCIONES PARA TRACKING DE DISPOSITIVOS E IP
// ============================================================================

// Función para extraer la IP real del cliente
function extractClientIP(req) {
  // Intentar obtener IP de diferentes headers (en orden de prioridad)
  const forwardedFor = req.headers["x-forwarded-for"];
  const realIP = req.headers["x-real-ip"];
  const clientIP = req.headers["x-client-ip"];
  const cfConnectingIP = req.headers["cf-connecting-ip"]; // Cloudflare
  const remoteAddr = req.connection?.remoteAddress || req.socket?.remoteAddress;
  
  let clientIpAddress = null;
  
  if (forwardedFor) {
    // X-Forwarded-For puede contener múltiples IPs separadas por comas
    clientIpAddress = forwardedFor.split(',')[0].trim();
  } else if (cfConnectingIP) {
    // Cloudflare
    clientIpAddress = cfConnectingIP;
  } else if (realIP) {
    clientIpAddress = realIP;
  } else if (clientIP) {
    clientIpAddress = clientIP;
  } else if (remoteAddr) {
    clientIpAddress = remoteAddr;
  }
  
  // Limpiar la IP (remover puerto si existe)
  if (clientIpAddress) {
    clientIpAddress = clientIpAddress.replace(/:\d+$/, '');
  }
  
  return clientIpAddress || 'unknown';
}

// Función para parsear información del dispositivo con UA-Parser
function parseDeviceInfoWithUAParser(userAgent) {
  if (!userAgent) {
    return {
      deviceOS: null,
      browser: null,
      deviceModel: null,
      deviceType: 'desktop'
    };
  }

  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  // 🖥️ SISTEMA OPERATIVO
  let deviceOS = null;
  if (result.os.name) {
    deviceOS = result.os.version ? 
      `${result.os.name} ${result.os.version}` : 
      result.os.name;
  }

  // 🌐 NAVEGADOR
  let browser = null;
  if (result.browser.name) {
    browser = result.browser.version ? 
      `${result.browser.name} ${result.browser.version}` : 
      result.browser.name;
  }

  // 📱 MODELO DE DISPOSITIVO
  let deviceModel = null;
  if (result.device.model) {
    deviceModel = result.device.vendor ? 
      `${result.device.vendor} ${result.device.model}` : 
      result.device.model;
  } else if (result.device.vendor) {
    deviceModel = result.device.vendor;
  }

  // 💻 TIPO DE DISPOSITIVO
  let deviceType = 'desktop'; // default
  if (result.device.type) {
    deviceType = result.device.type; // mobile, tablet, console, smarttv, wearable, embedded
  } else {
    // Si no detecta tipo pero hay info de mobile
    if (result.os.name && ['Android', 'iOS'].includes(result.os.name)) {
      deviceType = 'mobile';
    }
  }

  return {
    deviceOS,
    browser,
    deviceModel,
    deviceType
  };
}

// Función para extraer toda la información del request
function extractDeviceAndIPInfo(req) {
  const userAgent = req.headers["user-agent"] || '';
  const ipAddress = extractClientIP(req);
  const deviceInfo = parseDeviceInfoWithUAParser(userAgent);
  
  console.log('🔍 [DEVICE DETECTION]', {
    ip: ipAddress,
    userAgent: userAgent.substring(0, 80) + '...',
    parsed: deviceInfo
  });
  
  return {
    ...deviceInfo,
    ipAddress
  };
}

// ============================================================================
// 📱 CONFIGURACIÓN DE NEXTAUTH
// ============================================================================

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
          
          // Registrar intento fallido si el usuario existe
          if (user) {
            await registerFailedAttempt(user.id, req);
          }
          
          throw new Error("Usuario o contraseña inválidos");
        }

        console.log(`✅ [authorize] Login OK: ${username} (Rol: ${ROLE_NAMES[user.roleId] || user.role.name})`);
        await rateLimiter.delete(ip);

        // 🆕 Pasar el request al usuario para usar en jwt callback
        return {
          id: user.id,
          username: user.username,
          roleId: user.roleId,
          roleName: ROLE_NAMES[user.roleId] || user.role.name,
          codigo: user.codigo,
          nombreCompleto: user.nombreCompleto,
          // Almacenar la info del request temporalmente
          _requestInfo: req
        };
      },
    }),
  ],

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // 12 horas
  },

  jwt: {
    maxAge: 12 * 60 * 60,
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.codigo = user.codigo;
        token.nombreCompleto = user.nombreCompleto;
        
        // 🎫 CREAR TOKEN PERSONALIZADO PARA API
        const expirationTime = Math.floor(Date.now() / 1000) + (12 * 60 * 60); // 12 horas
        const apiToken = jwt.sign(
          {
            id: user.id,
            username: user.username,
            roleId: user.roleId,
            roleName: user.roleName,
            codigo: user.codigo,
            nombreCompleto: user.nombreCompleto,
            iat: Math.floor(Date.now() / 1000),
            exp: expirationTime
          },
          process.env.NEXTAUTH_SECRET,
          { algorithm: 'HS256' }
        );
        
        token.apiToken = apiToken;
        
        // 💾 CREAR SESIÓN EN BASE DE DATOS CON INFO DEL DISPOSITIVO
        try {
          const sessionId = await createUserSession(
            user.id, 
            apiToken, 
            new Date(expirationTime * 1000),
            user._requestInfo // Pasar el request para extraer device info
          );
          token.sessionId = sessionId;
          
          // 🔑 MOSTRAR TOKEN EN CONSOLA PARA POSTMAN
          console.log('🎫 ========================================');
          console.log('🎫 TOKEN PARA POSTMAN/APIs:');
          console.log('🎫 ========================================');
          console.log(`🎫 Usuario: ${user.username} (${user.roleName})`);
          console.log(`🎫 Token: ${apiToken}`);
          console.log('🎫 ========================================');
          console.log(`✅ [JWT] Token y sesión generados para ${user.username}`);
          
        } catch (error) {
          console.error('❌ [JWT] Error creando sesión:', error);
          // Continúar sin la sesión en DB si hay error
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
      
      // Incluir el token API y sessionId en la sesión
      session.apiToken = token.apiToken;
      session.sessionId = token.sessionId;
      
      console.log(`🕒 [session] Sesión activa para ${token.username} (${token.roleName})`);
      return session;
    },
  },

  events: {
    async signOut({ token }) {
      // Terminar la sesión en la base de datos cuando el usuario hace logout
      if (token?.sessionId) {
        try {
          await endUserSession(token.sessionId, 'LOGOUT');
          console.log(`🚪 [signOut] Sesión ${token.sessionId} terminada por logout`);
        } catch (error) {
          console.error('❌ [signOut] Error terminando sesión:', error);
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
// 💾 FUNCIÓN MEJORADA PARA CREAR SESIÓN EN BASE DE DATOS CON DEVICE TRACKING
// ============================================================================

async function createUserSession(userId, sessionToken, expiresAt, req = null) {
  try {
    // 🔍 Extraer información del dispositivo e IP
    let deviceInfo = {
      deviceOS: null,
      browser: null,
      deviceModel: null,
      deviceType: 'desktop',
      ipAddress: 'unknown'
    };

    if (req) {
      deviceInfo = extractDeviceAndIPInfo(req);
    }

    // Verificar cuántas sesiones activas tiene el usuario
    const activeSessions = await prisma.userSession.findMany({
      where: {
        userId: userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    // Si excede el límite, terminar las sesiones más antiguas
    if (activeSessions.length >= MAX_SESSIONS_PER_USER) {
      const sessionsToEnd = activeSessions.slice(0, activeSessions.length - MAX_SESSIONS_PER_USER + 1);
      
      for (const session of sessionsToEnd) {
        await prisma.userSession.update({
          where: { id: session.id },
          data: {
            isActive: false,
            endedAt: new Date(),
            endReason: 'MAX_SESSIONS_EXCEEDED'
          }
        });
      }
      
      console.log(`🔄 [SESSION] Terminadas ${sessionsToEnd.length} sesiones por límite de sesiones`);
    }

    // Crear nueva sesión con información del dispositivo
    const newSession = await prisma.userSession.create({
      data: {
        userId: userId,
        sessionToken: sessionToken,
        isActive: true,
        expiresAt: expiresAt,
        loginAttempts: 0,
        // 🆕 Información del dispositivo e IP
        deviceOS: deviceInfo.deviceOS,
        browser: deviceInfo.browser,
        deviceModel: deviceInfo.deviceModel,
        deviceType: deviceInfo.deviceType,
        ipAddress: deviceInfo.ipAddress,
      }
    });

    console.log(`✅ [SESSION CREATED] Usuario ${userId} desde ${deviceInfo.deviceType} (${deviceInfo.deviceOS} - ${deviceInfo.browser}) IP: ${deviceInfo.ipAddress}`);

    return newSession.id;
    
  } catch (error) {
    console.error('❌ [CREATE SESSION] Error:', error);
    throw error;
  }
}

// ============================================================================
// 🚪 FUNCIÓN PARA TERMINAR SESIÓN
// ============================================================================

async function endUserSession(sessionId, reason = 'LOGOUT') {
  try {
    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        endedAt: new Date(),
        endReason: reason
      }
    });
  } catch (error) {
    console.error('❌ [END SESSION] Error:', error);
    throw error;
  }
}

// ============================================================================
// 📊 FUNCIÓN MEJORADA PARA REGISTRAR INTENTO FALLIDO
// ============================================================================

async function registerFailedAttempt(userId, req = null) {
  try {
    // 🔍 Extraer información del dispositivo para el intento fallido
    let deviceInfo = {
      deviceOS: null,
      browser: null,
      deviceModel: null,
      deviceType: 'desktop',
      ipAddress: 'unknown'
    };

    if (req) {
      deviceInfo = extractDeviceAndIPInfo(req);
    }

    // Buscar la sesión activa más reciente para registrar el intento fallido
    const recentSession = await prisma.userSession.findFirst({
      where: {
        userId: userId,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (recentSession) {
      await prisma.userSession.update({
        where: { id: recentSession.id },
        data: {
          loginAttempts: {
            increment: 1
          }
        }
      });
    } else {
      // Si no hay sesión activa, crear un registro temporal del intento fallido
      await prisma.userSession.create({
        data: {
          userId: userId,
          sessionToken: 'FAILED_ATTEMPT_' + Date.now(),
          isActive: false,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutos
          loginAttempts: 1,
          endReason: 'FAILED_LOGIN',
          endedAt: new Date(),
          // 🆕 Información del dispositivo del intento fallido
          deviceOS: deviceInfo.deviceOS,
          browser: deviceInfo.browser,
          deviceModel: deviceInfo.deviceModel,
          deviceType: deviceInfo.deviceType,
          ipAddress: deviceInfo.ipAddress,
        }
      });
    }

    console.log(`❌ [FAILED ATTEMPT] Registrado para usuario ${userId} desde ${deviceInfo.ipAddress} (${deviceInfo.deviceOS})`);
    
  } catch (error) {
    console.error('❌ [FAILED ATTEMPT] Error registrando intento fallido:', error);
  }
}

// ============================================================================
// 🔐 FUNCIÓN PARA VERIFICAR TOKENS EN LAS APIs (mantener para compatibilidad)
// ============================================================================

export async function verifyApiToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET);
    console.log(`✅ [API TOKEN] Token válido para ${decoded.username} (${decoded.roleName})`);
    return decoded;
  } catch (error) {
    console.error('❌ [API TOKEN] Token inválido:', error.message);
    return null;
  }
}

// ============================================================================
// 🛡️ MIDDLEWARE PARA PROTEGER APIs (mantener para compatibilidad)
// ============================================================================

export function withApiAuth(handler) {
  return async (req, res) => {
    // Extraer token del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [API AUTH] No Bearer token provided');
      return res.status(401).json({ 
        error: 'Token de autorización requerido',
        message: 'Incluye el header: Authorization: Bearer <token>'
      });
    }

    const token = authHeader.substring(7); // Remover 'Bearer '
    const decoded = await verifyApiToken(token);
    
    if (!decoded) {
      return res.status(401).json({ 
        error: 'Token inválido o expirado',
        message: 'Obtén un nuevo token haciendo login'
      });
    }

    // Agregar información del usuario al request
    req.user = decoded;
    
    // Continuar con el handler original
    return handler(req, res);
  };
}

// ============================================================================
// 🔍 FUNCIONES ADICIONALES PARA REPORTES Y SEGURIDAD
// ============================================================================

// Obtener sesiones activas con información de dispositivos
export async function getActiveSessionsWithDevices(userId = null) {
  const sessions = await prisma.userSession.findMany({
    where: {
      ...(userId && { userId }),
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          nombreCompleto: true,
          email: true
        }
      }
    },
    orderBy: {
      lastActivity: 'desc'
    }
  });

  return sessions.map(session => ({
    sessionId: session.id,
    user: session.user,
    device: {
      os: session.deviceOS,
      browser: session.browser,
      model: session.deviceModel,
      type: session.deviceType,
      ipAddress: session.ipAddress
    },
    activity: {
      created: session.createdAt,
      lastActivity: session.lastActivity,
      expires: session.expiresAt
    },
    loginAttempts: session.loginAttempts
  }));
}

// Función para detectar actividad sospechosa por IP
export async function checkSuspiciousActivity(ipAddress, timeRange = 60) {
  const startTime = new Date(Date.now() - timeRange * 60 * 1000); // minutos atrás
  
  // Contar sesiones desde esta IP en el tiempo especificado
  const recentSessions = await prisma.userSession.findMany({
    where: {
      ipAddress: ipAddress,
      createdAt: {
        gte: startTime
      }
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          nombreCompleto: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Analizar patrones sospechosos
  const uniqueUsers = new Set(recentSessions.map(s => s.userId));
  const differentDevices = new Set(recentSessions.map(s => `${s.deviceOS}-${s.browser}`));
  
  const analysis = {
    ipAddress,
    timeRangeMinutes: timeRange,
    totalSessions: recentSessions.length,
    uniqueUsers: uniqueUsers.size,
    differentDevices: differentDevices.size,
    sessions: recentSessions,
    riskFactors: [],
    riskLevel: 'LOW'
  };

  // Detectar riesgos
  if (uniqueUsers.size > 3) {
    analysis.riskFactors.push('MULTIPLE_USERS_SAME_IP');
  }
  if (recentSessions.length > 5) {
    analysis.riskFactors.push('HIGH_FREQUENCY_LOGINS');
  }
  if (differentDevices.size > 3) {
    analysis.riskFactors.push('MULTIPLE_DEVICES_SAME_IP');
  }

  // Calcular nivel de riesgo
  if (analysis.riskFactors.length === 0) analysis.riskLevel = 'LOW';
  else if (analysis.riskFactors.length <= 1) analysis.riskLevel = 'MEDIUM';
  else analysis.riskLevel = 'HIGH';

  return analysis;
}

// Función para bloquear IP (marcar sesiones como terminadas)
export async function blockIPAddress(ipAddress, reason = 'ADMIN_BLOCK') {
  const result = await prisma.userSession.updateMany({
    where: {
      ipAddress: ipAddress,
      isActive: true
    },
    data: {
      isActive: false,
      endedAt: new Date(),
      endReason: reason
    }
  });

  console.log(`🚫 [BLOCK IP] Bloqueadas ${result.count} sesiones de IP: ${ipAddress}`);
  
  return {
    success: true,
    blockedSessions: result.count,
    ipAddress: ipAddress,
    reason: reason
  };
}

// Obtener estadísticas de dispositivos
export async function getDeviceStatistics(timeRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  const stats = await prisma.userSession.groupBy({
    by: ['deviceOS', 'deviceType', 'browser'],
    where: {
      createdAt: {
        gte: startDate
      }
    },
    _count: {
      id: true
    },
    orderBy: {
      _count: {
        id: 'desc'
      }
    }
  });

  return {
    totalSessions: stats.reduce((sum, item) => sum + item._count.id, 0),
    byOS: {},
    byType: {},
    byBrowser: {},
    details: stats
  };
}

// ============================================================================
// 🆕 FUNCIONES ÚTILES PARA COMPATIBILIDAD
// ============================================================================

// Función para obtener nombre del rol
export function getRoleName(roleId) {
  return ROLE_NAMES[roleId] || `ROLE_${roleId}`;
}

// Función para verificar permisos por rol
export function hasPermission(userRoleId, allowedRoles) {
  return allowedRoles.length === 0 || allowedRoles.includes(userRoleId);
}