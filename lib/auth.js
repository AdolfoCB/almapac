import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
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
  // CRÍTICO: Remover el adapter que puede estar causando problemas con cookies
  // adapter: PrismaAdapter(prisma), // ← COMENTADO TEMPORALMENTE

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
    updateAge: 24 * 60 * 60, // 24 horas
  },

  jwt: {
    maxAge: 12 * 60 * 60, // 12 horas
  },

  // NUEVO: Configuración explícita de cookies para producción
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production', // HTTPS en producción
        domain: process.env.NODE_ENV === 'production' ? '.vercel.app' : undefined, // Dominio para Vercel
      }
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NODE_ENV === 'production' ? '.vercel.app' : undefined,
      }
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NODE_ENV === 'production' ? '.vercel.app' : undefined,
      }
    }
  },

  callbacks: {
    async jwt({ token, user, trigger }) {
      console.log(`🔄 [JWT] Callback ejecutado - user: ${!!user}, trigger: ${trigger}`);
      
      if (user && !token.sessionId) {
        console.log(`🆕 [JWT] Primer login para ${user.username}`);
        
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        token.id = user.id;
        token.username = user.username;
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.codigo = user.codigo;
        token.nombreCompleto = user.nombreCompleto;
        token.sessionId = sessionId;
        token.sessionReady = false;
        
        console.log(`🔄 [JWT] Creando sesión para ${user.username} con sessionId: ${sessionId}`);
        
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
          
          token.sessionReady = true;
          console.log(`✅ [JWT] Sesión creada exitosamente en DB para ${user.username}`);
          
          const verifySession = await prisma.userSession.findFirst({
            where: {
              sessionToken: sessionId,
              isActive: true,
            }
          });
          
          if (!verifySession) {
            console.error(`❌ [JWT] ERROR: Sesión no encontrada después de crear`);
            token.sessionReady = false;
          } else {
            console.log(`✅ [JWT] Sesión verificada en DB`);
          }
          
        } catch (error) {
          console.error("❌ [JWT] Error al crear sesión en DB:", error);
          token.sessionReady = false;
        }
      }
      
      // Log del token para debugging
      console.log(`📊 [JWT] Token actual:`, {
        username: token.username,
        sessionId: token.sessionId,
        sessionReady: token.sessionReady,
        iat: token.iat,
        exp: token.exp
      });
      
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
            console.log(`❌ [JWT] Sesión revocada para ${token.username}`);
            return null;
          }
        } catch (error) {
          console.error("❌ [JWT] Error validando sesión:", error);
        }
      }
      
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
        session.sessionReady = token.sessionReady;
        
        console.log(`🕒 [session] Sesión generada para ${token.username} - sessionReady: ${token.sessionReady}`);
      } else {
        console.log(`❌ [session] No hay token disponible`);
      }
      
      return session;
    },
    
    async signIn({ user, account, profile, email, credentials }) {
      console.log(`✅ [signIn] Login completado para ${user.username}`);
      return true;
    },

    // NUEVO: Callback para debugging de redirects
    async redirect({ url, baseUrl }) {
      console.log(`🔄 [redirect] url: ${url}, baseUrl: ${baseUrl}`);
      
      // Asegurar redirección correcta después del login
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
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
    
    // NUEVO: Event para debugging
    async session({ session, token }) {
      console.log(`📅 [event-session] Sesión activa para ${session?.user?.username}`);
    },
    
    async jwt({ token, user, account, profile, isNewUser }) {
      console.log(`📅 [event-jwt] JWT event - isNewUser: ${isNewUser}`);
    },
  },

  // CRÍTICO: Configuración para producción
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development' || process.env.NEXTAUTH_DEBUG === 'true',
  
  // NUEVO: Logger para debugging en producción
  logger: {
    error(code, metadata) {
      console.error(`🚨 [NextAuth Error] ${code}:`, metadata);
    },
    warn(code) {
      console.warn(`⚠️ [NextAuth Warning] ${code}`);
    },
    debug(code, metadata) {
      if (process.env.NEXTAUTH_DEBUG === 'true') {
        console.log(`🐛 [NextAuth Debug] ${code}:`, metadata);
      }
    }
  }
};