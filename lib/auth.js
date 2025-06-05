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

  callbacks: {
    async jwt({ token, user }) {
      console.log(`🔄 [JWT] Callback - user presente: ${!!user}, token existente: ${!!token.id}`);
      
      // SOLO en el primer login cuando viene el user del authorize
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
        
        console.log(`🔄 [JWT] Creando sesión en DB para ${user.username}`);
        
        // Crear sesión en DB (proceso asíncrono pero no bloqueante)
        setImmediate(async () => {
          try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 12);
            
            // Cerrar sesiones previas
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
            
            // Crear nueva sesión
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
        roleId: token.roleId
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
      console.log(`✅ [signIn] Callback ejecutado para ${user.username}`);
      // CRÍTICO: Siempre retornar true para permitir el login
      return true;
    },

    // ELIMINADO: callback redirect que estaba causando problemas
    // El redirect por defecto de NextAuth funciona mejor
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
  
  // Configuración simple para producción
  debug: false,
};