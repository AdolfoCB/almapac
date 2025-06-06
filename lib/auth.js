// lib/auth.js - NextAuth config optimizado para Vercel
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from '@/lib/prisma';
import bcrypt from "bcryptjs";
import { RateLimiterMemory } from "rate-limiter-flexible";
const UAParser = require("ua-parser-js");

// Rate limiter
const rateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 30,
});

// Configuración de cookies para Vercel
const isProduction = process.env.NODE_ENV === 'production';
const domain = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).hostname : undefined;

const cookieConfig = {
  sessionToken: {
    name: `${isProduction ? '__Secure-' : ''}next-auth.session-token`,
    options: {
      httpOnly: true,
      sameSite: 'lax', // Para Vercel es mejor 'lax' que 'strict'
      path: '/',
      secure: isProduction, // Solo HTTPS en producción
      domain: isProduction ? domain : undefined,
      maxAge: 24 * 60 * 60, // 24 horas
    },
  },
  callbackUrl: {
    name: `${isProduction ? '__Secure-' : ''}next-auth.callback-url`,
    options: {
      sameSite: 'lax',
      path: '/',
      secure: isProduction,
      domain: isProduction ? domain : undefined,
      maxAge: 24 * 60 * 60,
    },
  },
  csrfToken: {
    name: `${isProduction ? '__Host-' : ''}next-auth.csrf-token`,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: isProduction,
      domain: isProduction ? domain : undefined,
      maxAge: 24 * 60 * 60,
    },
  },
  pkceCodeVerifier: {
    name: `${isProduction ? '__Secure-' : ''}next-auth.pkce.code_verifier`,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: isProduction,
      domain: isProduction ? domain : undefined,
      maxAge: 15 * 60, // 15 minutos
    },
  },
  state: {
    name: `${isProduction ? '__Secure-' : ''}next-auth.state`,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: isProduction,
      domain: isProduction ? domain : undefined,
      maxAge: 15 * 60, // 15 minutos
    },
  },
  nonce: {
    name: `${isProduction ? '__Secure-' : ''}next-auth.nonce`,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: isProduction,
      domain: isProduction ? domain : undefined,
      maxAge: 15 * 60, // 15 minutos
    },
  },
};

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
               req.connection?.remoteAddress ||
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
        const ip = req.headers["x-forwarded-for"]?.split(",")[0] || 
                  req.headers["x-real-ip"] || 
                  req.socket?.remoteAddress;

        try {
          await rateLimiter.consume(ip);
        } catch {
          throw new Error("Demasiados intentos. Intenta de nuevo más tarde.");
        }

        console.log(`🔑 [authorize] Intento login: ${credentials?.username}`);

        if (!credentials?.username || !credentials?.password) {
          throw new Error("Usuario o contraseña inválidos");
        }

        const username = credentials.username.trim();
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

        // Generar sessionId único
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Extraer info del dispositivo
        const deviceInfo = extractDeviceInfo(req);
        
        return {
          id: user.id,
          username: user.username,
          roleId: user.roleId,
          roleName: user.role.name,
          codigo: user.codigo,
          nombreCompleto: user.nombreCompleto,
          sessionId,
          deviceInfo,
        };
      },
    }),
  ],

  pages: {
    signIn: "/login",
    error: "/login", // Redirigir errores al login
  },

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 horas
    updateAge: 2 * 60 * 60, // Actualizar cada 2 horas
  },

  jwt: {
    maxAge: 24 * 60 * 60, // 24 horas
    // Configuración adicional para Vercel
    encode: async ({ secret, token }) => {
      const jwtClaims = {
        ...token,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 horas
        jti: Math.random().toString(36).substring(2), // JWT ID único
      };
      
      const { encode } = await import("next-auth/jwt");
      return encode({ secret, token: jwtClaims });
    },
  },

  // Configuración de cookies optimizada para Vercel
  cookies: cookieConfig,

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // En el primer login
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.codigo = user.codigo;
        token.nombreCompleto = user.nombreCompleto;
        token.sessionId = user.sessionId;
        token.loginTime = Date.now();
        token.lastActivity = Date.now();
        
        console.log(`✅ [JWT] Token creado para ${user.username} con sessionId: ${token.sessionId}`);
      }
      
      // Actualizar actividad en cada request
      if (trigger === "update" && session) {
        token.lastActivity = Date.now();
      }
      
      // Verificar si el token ha expirado por inactividad (12 horas)
      const inactivityLimit = 12 * 60 * 60 * 1000; // 12 horas
      if (token.lastActivity && (Date.now() - token.lastActivity) > inactivityLimit) {
        console.log(`Token expirado por inactividad para ${token.username}`);
        return null; // Esto forzará un nuevo login
      }
      
      return token;
    },
    
    async session({ session, token }) {
      if (!token) return null;
      
      // Verificar si el token sigue siendo válido
      const tokenAge = Date.now() - (token.loginTime || 0);
      const maxAge = 24 * 60 * 60 * 1000; // 24 horas
      
      if (tokenAge > maxAge) {
        console.log(`Sesión expirada para ${token.username}`);
        return null;
      }
      
      session.user = {
        id: token.id,
        username: token.username,
        roleId: token.roleId,
        roleName: token.roleName,
        codigo: token.codigo,
        nombreCompleto: token.nombreCompleto,
      };
      session.sessionId = token.sessionId;
      session.loginTime = token.loginTime;
      session.lastActivity = token.lastActivity;
      
      return session;
    },
    
    async signIn({ user, account }) {
      // Solo registrar el login en la BD
      if (user && user.sessionId) {
        try {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 24); // 24 horas
          
          // Invalidar sesiones activas anteriores del mismo usuario
          await prisma.userSession.updateMany({
            where: {
              userId: user.id,
              isActive: true,
            },
            data: {
              isActive: false,
              endedAt: new Date(),
              endReason: "New_Login",
            },
          });
          
          // Crear nueva sesión
          await prisma.userSession.create({
            data: {
              userId: user.id,
              sessionToken: user.sessionId,
              isActive: true,
              expiresAt,
              deviceOS: user.deviceInfo?.deviceOS || null,
              browser: user.deviceInfo?.browser || null,
              deviceModel: user.deviceInfo?.deviceModel || null,
              deviceType: user.deviceInfo?.deviceType || "desktop",
              ipAddress: user.deviceInfo?.ipAddress || null,
            },
          });
          
          console.log(`✅ [signIn] Sesión registrada para ${user.username}`);
        } catch (error) {
          console.error("Error registrando sesión:", error);
          // No fallar el login por esto, pero log el error
        }
      }
      return true;
    },
  },

  events: {
    async signOut(message) {
      // Marcar sesión como terminada
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
          console.error("Error al terminar sesión:", error);
        }
      }
    },
    
    async session(message) {
      // Actualizar última actividad
      if (message?.token?.sessionId) {
        try {
          await prisma.userSession.updateMany({
            where: {
              sessionToken: message.token.sessionId,
              isActive: true,
            },
            data: {
              lastActivity: new Date(),
            },
          });
        } catch (error) {
          console.error("Error actualizando actividad:", error);
        }
      }
    },
    
    async error({ error, method }) {
      console.error(`[next-auth][${method}]`, error);
    },
  },

  // Configuración adicional para Vercel
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
  
  // Trust host para Vercel
  trustHost: true,
};