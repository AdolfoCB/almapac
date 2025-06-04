// lib/auth.js - Configuración ajustada al esquema Prisma
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "./prisma";
import bcrypt from "bcryptjs";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { UAParser } from 'ua-parser-js';
import { encode, decode } from "next-auth/jwt";

// Configuración del rate limiter: 5 intentos cada 30 segundos
const rateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 30,
});

// Límite máximo de sesiones activas por usuario
const MAX_SESSIONS_PER_USER = 3;

// 🆕 Cache para roles (se actualiza dinámicamente)
let ROLE_CACHE = null;
let ROLE_CACHE_TIMESTAMP = 0;
const ROLE_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// ============================================================================
// 🎭 FUNCIONES PARA MANEJO DINÁMICO DE ROLES
// ============================================================================

// Obtener roles dinámicamente desde la base de datos
async function getRolesFromDB() {
  const now = Date.now();
  
  // Verificar si el cache es válido
  if (ROLE_CACHE && (now - ROLE_CACHE_TIMESTAMP) < ROLE_CACHE_TTL) {
    return ROLE_CACHE;
  }
  
  try {
    const roles = await prisma.role.findMany({
      select: {
        id: true,
        name: true // En el esquema se mapea a 'nombre' en la DB
      }
    });
    
    // Crear mapeo de ID a nombre
    const roleMap = {};
    roles.forEach(role => {
      roleMap[role.id] = role.name;
    });
    
    // Actualizar cache
    ROLE_CACHE = roleMap;
    ROLE_CACHE_TIMESTAMP = now;
    
    console.log('🎭 [ROLES] Cache actualizado:', roleMap);
    return roleMap;
    
  } catch (error) {
    console.error('❌ [ROLES] Error obteniendo roles:', error);
    // Fallback a roles por defecto si hay error
    return {
      1: 'ADMINISTRADOR',
      2: 'MUELLERO', 
      3: 'CHEQUERO',
      4: 'AUDITOR_PROCESOS',
      5: 'OPERADOR',
      6: 'SUPERVISOR_MANTENIMIENTO',
      7: 'MUELLERO_CHEQUERO'
    };
  }
}

// Obtener nombre de rol por ID
async function getRoleName(roleId) {
  const roles = await getRolesFromDB();
  return roles[roleId] || `UNKNOWN_ROLE_${roleId}`;
}

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

        // 🔍 DEBUGGING: Preparar variantes del username
        const originalUsername = credentials.username.trim();
        const lowercaseUsername = originalUsername.toLowerCase();
        const password = credentials.password;

        console.log(`🔍 [authorize] Buscando usuario: "${originalUsername}" (también probará: "${lowercaseUsername}")`);

        // 🔍 Buscar usuario - intentar ambas variantes en una sola consulta
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: originalUsername },
              { username: lowercaseUsername }
            ]
          },
          include: { 
            role: {
              select: {
                id: true,
                name: true // Campo correcto según el esquema
              }
            }
          },
        });

        console.log(`🔍 [authorize] Usuario encontrado: ${user ? 'SÍ' : 'NO'}`);
        
        if (user) {
          console.log(`🔍 [authorize] Usuario BD: "${user.username}", activo: ${user.activo}, eliminado: ${user.eliminado}`);
        }

        const hash = user
          ? user.password
          : "$2a$10$C6UzMDM.H6dfI/f/IKcEeO";

        console.log(`🔍 [authorize] Verificando contraseña...`);

        const valid = await bcrypt.compare(password, hash);
        
        console.log(`🔍 [authorize] Contraseña válida: ${valid}`);

        if (!user || user.eliminado || !user.activo || !valid) {
          console.log(`❌ [authorize] Credenciales inválidas para ${originalUsername}`);
          console.log(`❌ [authorize] Razón del fallo:`, {
            userExists: !!user,
            userActive: user?.activo,
            userNotDeleted: !user?.eliminado,
            passwordValid: valid
          });
          
          // Registrar intento fallido si el usuario existe
          if (user) {
            await registerFailedAttempt(user.id, req);
          }
          
          throw new Error("Usuario o contraseña inválidos");
        }

        // 🎭 Obtener nombre del rol
        const roleName = user.role?.name || await getRoleName(user.roleId);

        console.log(`✅ [authorize] Login OK: ${originalUsername} → ${user.username} (Rol: ${roleName})`);
        await rateLimiter.delete(ip);

        // 🆕 Pasar el request al usuario para usar en jwt callback
        return {
          id: user.id,
          username: user.username, // Usar el username original de la BD
          roleId: user.roleId,
          roleName: roleName,
          codigo: user.codigo,
          nombreCompleto: user.nombreCompleto,
          email: user.email, // Incluir email si está disponible
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
    async jwt({ token, user, req }) {
      if (user) {
        console.log(`🎫 [JWT CALLBACK] Procesando usuario:`, user.username);
        
        token.id = user.id;
        token.username = user.username;
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.codigo = user.codigo;
        token.nombreCompleto = user.nombreCompleto;
        token.email = user.email;
        
        // 💾 CREAR SESIÓN EN BASE DE DATOS CON TOKEN DE NEXTAUTH
        try {
          const expirationTime = new Date(Date.now() + (12 * 60 * 60 * 1000)); // 12 horas
          
          // 🎫 GENERAR TOKEN NEXTAUTH PARA ALMACENAR EN DB
          const nextAuthToken = await encode({
            token: {
              id: user.id,
              username: user.username,
              roleId: user.roleId,
              roleName: user.roleName,
              codigo: user.codigo,
              nombreCompleto: user.nombreCompleto,
              email: user.email,
              iat: Math.floor(Date.now() / 1000),
              exp: Math.floor(expirationTime.getTime() / 1000)
            },
            secret: process.env.NEXTAUTH_SECRET,
            maxAge: 12 * 60 * 60
          });

          const sessionId = await createUserSession(
            user.id, 
            nextAuthToken, 
            expirationTime,
            user._requestInfo // Pasar el request para extraer device info
          );
          
          token.sessionId = sessionId;
          token.dbToken = nextAuthToken; // Almacenar el token para validaciones posteriores
          
          console.log(`✅ [JWT CALLBACK] Token y sesión generados para ${user.username}`);
          
          // 🔑 MOSTRAR TOKEN EN CONSOLA PARA POSTMAN (solo en desarrollo)
          if (process.env.NODE_ENV === 'development') {
            console.log('🎫 ========================================');
            console.log('🎫 TOKEN PARA POSTMAN/APIs:');
            console.log('🎫 ========================================');
            console.log(`🎫 Usuario: ${user.username} (${user.roleName})`);
            console.log(`🎫 Token: ${nextAuthToken}`);
            console.log('🎫 ========================================');
          }
          
        } catch (error) {
          console.error('❌ [JWT CALLBACK] Error creando sesión:', error);
          // NO lanzar error aquí, continuar sin la sesión en DB
          // return null; // NO hacer esto, causaría que el login falle
        }
      }
      
      console.log(`✅ [JWT CALLBACK] Token retornado para ${token.username}`);
      return token;
    },
    
    async session({ session, token }) {
      console.log(`🕒 [SESSION CALLBACK] Procesando sesión para ${token.username}`);
      
      session.user = {
        id: token.id,
        username: token.username,
        roleId: token.roleId,
        roleName: token.roleName,
        codigo: token.codigo,
        nombreCompleto: token.nombreCompleto,
        email: token.email,
      };
      
      // Incluir sessionId en la sesión
      session.sessionId = token.sessionId;
      session.token = token.dbToken; // Token para usar en APIs
      
      console.log(`✅ [SESSION CALLBACK] Sesión completada para ${token.username} (${token.roleName})`);
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
// 🔐 FUNCIÓN PARA VERIFICAR TOKENS NEXTAUTH CON VALIDACIÓN EN DB
// ============================================================================

export async function verifyApiToken(token) {
  try {
    // 🔓 DECODIFICAR TOKEN NEXTAUTH
    const decoded = await decode({
      token: token,
      secret: process.env.NEXTAUTH_SECRET
    });

    if (!decoded) {
      console.error('❌ [API TOKEN] Token NextAuth inválido');
      return null;
    }

    // 🔍 VERIFICAR SESIÓN EN BASE DE DATOS
    const dbSession = await prisma.userSession.findFirst({
      where: {
        sessionToken: token,
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
            roleId: true,
            codigo: true,
            nombreCompleto: true,
            email: true,
            activo: true,
            eliminado: true,
            role: {
              select: {
                id: true,
                name: true // Campo correcto según el esquema
              }
            }
          }
        }
      }
    });

    if (!dbSession) {
      console.error('❌ [API TOKEN] Sesión no encontrada o inactiva en DB');
      return null;
    }

    // Verificar que el usuario sigue activo
    if (!dbSession.user.activo || dbSession.user.eliminado) {
      console.error('❌ [API TOKEN] Usuario inactivo o eliminado');
      // Terminar la sesión en DB
      await endUserSession(dbSession.id, 'USER_INACTIVE');
      return null;
    }

    // 🔄 ACTUALIZAR ÚLTIMA ACTIVIDAD
    await prisma.userSession.update({
      where: { id: dbSession.id },
      data: { lastActivity: new Date() }
    });

    // 🎭 Obtener nombre del rol (dinámico o desde la relación)
    const roleName = dbSession.user.role?.name || await getRoleName(dbSession.user.roleId);

    // Construir objeto de usuario con información completa
    const userInfo = {
      id: dbSession.user.id,
      username: dbSession.user.username,
      roleId: dbSession.user.roleId,
      roleName: roleName,
      codigo: dbSession.user.codigo,
      nombreCompleto: dbSession.user.nombreCompleto,
      email: dbSession.user.email,
      sessionId: dbSession.id,
      // Info adicional del token original
      ...decoded
    };

    console.log(`✅ [API TOKEN] Token válido para ${userInfo.username} (${userInfo.roleName})`);
    return userInfo;
    
  } catch (error) {
    console.error('❌ [API TOKEN] Error verificando token:', error.message);
    return null;
  }
}

// ============================================================================
// 🛡️ MIDDLEWARE PARA PROTEGER APIs CON VALIDACIÓN EN DB
// ============================================================================

export function withApiAuth(handler, allowedRoles = []) {
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
    const userInfo = await verifyApiToken(token);
    
    if (!userInfo) {
      return res.status(401).json({ 
        error: 'Token inválido o expirado',
        message: 'Obtén un nuevo token haciendo login'
      });
    }

    // 🔐 VERIFICAR PERMISOS POR ROL
    if (allowedRoles.length > 0 && !allowedRoles.includes(userInfo.roleId)) {
      console.log(`❌ [API AUTH] Permisos insuficientes para ${userInfo.username} (Rol: ${userInfo.roleId})`);
      
      // Obtener nombres de roles permitidos dinámicamente
      const roles = await getRolesFromDB();
      const allowedRoleNames = allowedRoles.map(id => roles[id] || `ROLE_${id}`).join(', ');
      
      return res.status(403).json({ 
        error: 'Permisos insuficientes',
        message: `Se requiere uno de estos roles: ${allowedRoleNames}`
      });
    }

    // Agregar información del usuario al request
    req.user = userInfo;
    
    console.log(`✅ [API AUTH] Acceso autorizado para ${userInfo.username} (${userInfo.roleName})`);
    
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
          email: true,
          role: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    },
    orderBy: {
      lastActivity: 'desc'
    }
  });

  return sessions.map(session => ({
    sessionId: session.id,
    user: {
      ...session.user,
      roleName: session.user.role?.name
    },
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

// Función para limpiar sesiones expiradas
export async function cleanupExpiredSessions() {
  const result = await prisma.userSession.updateMany({
    where: {
      isActive: true,
      expiresAt: {
        lt: new Date()
      }
    },
    data: {
      isActive: false,
      endedAt: new Date(),
      endReason: 'EXPIRED'
    }
  });

  console.log(`🧹 [CLEANUP] ${result.count} sesiones expiradas marcadas como inactivas`);
  return result.count;
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
          nombreCompleto: true,
          role: {
            select: {
              name: true
            }
          }
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
    sessions: recentSessions.map(s => ({
      ...s,
      user: {
        ...s.user,
        roleName: s.user.role?.name
      }
    })),
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

  const totals = {
    totalSessions: stats.reduce((sum, item) => sum + item._count.id, 0),
    byOS: {},
    byType: {},
    byBrowser: {}
  };

  // Agrupar estadísticas
  stats.forEach(stat => {
    const count = stat._count.id;
    
    if (stat.deviceOS) {
      totals.byOS[stat.deviceOS] = (totals.byOS[stat.deviceOS] || 0) + count;
    }
    if (stat.deviceType) {
      totals.byType[stat.deviceType] = (totals.byType[stat.deviceType] || 0) + count;
    }
    if (stat.browser) {
      totals.byBrowser[stat.browser] = (totals.byBrowser[stat.browser] || 0) + count;
    }
  });

  return {
    ...totals,
    details: stats
  };
}

// ============================================================================
// 🆕 FUNCIONES ÚTILES PARA COMPATIBILIDAD
// ============================================================================

// Función para verificar permisos por rol
export function hasPermission(userRoleId, allowedRoles) {
  return allowedRoles.length === 0 || allowedRoles.includes(userRoleId);
}

// Función para terminar todas las sesiones de un usuario
export async function terminateAllUserSessions(userId, reason = 'ADMIN_TERMINATE') {
  const result = await prisma.userSession.updateMany({
    where: {
      userId: userId,
      isActive: true
    },
    data: {
      isActive: false,
      endedAt: new Date(),
      endReason: reason
    }
  });

  console.log(`🚫 [TERMINATE USER] Terminadas ${result.count} sesiones del usuario ${userId}`);
  
  return {
    success: true,
    terminatedSessions: result.count,
    userId: userId,
    reason: reason
  };
}

// Función para obtener información de una sesión específica
export async function getSessionInfo(sessionId) {
  try {
    const session = await prisma.userSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nombreCompleto: true,
            email: true,
            activo: true,
            eliminado: true,
            role: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      user: {
        ...session.user,
        roleName: session.user.role?.name
      },
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
        expires: session.expiresAt,
        ended: session.endedAt,
        endReason: session.endReason
      },
      status: {
        isActive: session.isActive,
        loginAttempts: session.loginAttempts
      }
    };
  } catch (error) {
    console.error('❌ [GET SESSION INFO] Error:', error);
    return null;
  }
}