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
