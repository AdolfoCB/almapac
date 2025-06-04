"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Swal from "sweetalert2";
import dynamic from "next/dynamic";
import { FiLoader } from "react-icons/fi";

// Loader dinámico para no romper el SSR
const Loader = dynamic(() => import("./Loader"), { ssr: false });

function LoginFormContent() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const [timer, setTimer] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const lockIntervalRef = useRef(null);
  const progressIntervalRef = useRef(null);

  const { data: session, status } = useSession({ required: false });
  const router = useRouter();
  const params = useSearchParams();

  // 1️⃣ Si ya está autenticado, guardamos datos y vamos a /
  useEffect(() => {
    if (status === "authenticated") {
      localStorage.setItem("userName", session.user.username);
      localStorage.setItem("userNameAll", session.user.nombreCompleto || "");
      
      // 💾 Guardar información de la sesión para gestión
      if (session.sessionId) {
        localStorage.setItem("sessionId", session.sessionId);
        console.log(`💾 [LOGIN] Sesión guardada: ${session.sessionId}`);
      }
      
      // 🎫 Guardar API token si está disponible
      if (session.apiToken) {
        localStorage.setItem("apiToken", session.apiToken);
        console.log(`🎫 [LOGIN] Token API guardado para uso en solicitudes`);
      }
      
      router.replace("/");
    }
  }, [status, session, router]);

  // 2️⃣ 🆕 Manejo de diferentes tipos de autorización requerida
  useEffect(() => {
    const authorizeParam = params.get("authorize");
    
    if (authorizeParam) {
      let title, text, icon;
      
      switch (authorizeParam) {
        case "SessionRequired":
          title = "Sesión requerida";
          text = "Por favor inicie sesión para continuar";
          icon = "info";
          break;
          
        case "SessionRevoked":
          title = "Sesión revocada";
          text = "Su sesión ha sido revocada por seguridad. Por favor inicie sesión nuevamente";
          icon = "warning";
          break;
          
        case "SessionInvalid":
          title = "Sesión inválida";
          text = "Su sesión ya no es válida. Por favor inicie sesión nuevamente";
          icon = "warning";
          break;
          
        case "SessionError":
          title = "Error de sesión";
          text = "Hubo un problema con su sesión. Por favor inicie sesión nuevamente";
          icon = "error";
          break;
          
        case "SessionExpired":
          title = "Sesión expirada";
          text = "Su sesión ha expirado. Por favor inicie sesión nuevamente";
          icon = "warning";
          break;
          
        default:
          title = "Sesión expirada";
          text = "Por favor inicie sesión nuevamente";
          icon = "warning";
      }

      Swal.fire({
        icon: icon,
        title: title,
        text: text,
        toast: true,
        position: "top-end",
        timer: 4000,
        showConfirmButton: false,
        timerProgressBar: true,
      }).then(() => {
        // Limpiar datos de sesión anteriores
        localStorage.clear();
        console.log(`🧹 [LOGIN] LocalStorage limpiado por ${authorizeParam}`);
      });
    }
  }, [params]);

  // 3️⃣ Al montar, comprobamos si hay bloqueo en curso
  useEffect(() => {
    const attempts = parseInt(localStorage.getItem("loginAttempts") || "0", 10);
    const lockStart = parseInt(localStorage.getItem("loginLockoutStart") || "0", 10);

    if (lockStart) {
      const elapsed = Math.floor((Date.now() - lockStart) / 1000);
      if (elapsed < 30) {
        setLocked(true);
        setTimer(30 - elapsed);
      } else {
        localStorage.removeItem("loginLockoutStart");
        localStorage.removeItem("loginAttempts");
      }
    }
  }, []);

  // 4️⃣ Contador regresivo durante el bloqueo
  useEffect(() => {
    if (locked) {
      lockIntervalRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(lockIntervalRef.current);
            localStorage.removeItem("loginLockoutStart");
            localStorage.removeItem("loginAttempts");
            setLocked(false);
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
    };
  }, [locked]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (locked) return;

    setError("");
    setIsSubmitting(true);

    // Iniciar barra de progreso animada
    setProgress(0);
    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + Math.random() * 15;
        return next >= 90 ? 90 : next;
      });
    }, 300);

    const result = await signIn("credentials", {
      redirect: false,
      username,
      password,
    });

    // Finalizar progreso
    clearInterval(progressIntervalRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 400);

    setIsSubmitting(false);

    if (result?.error) {
      // Registramos intento fallido
      const prev = parseInt(localStorage.getItem("loginAttempts") || "0", 10) + 1;
      localStorage.setItem("loginAttempts", String(prev));

      if (prev >= 5) {
        // Iniciar bloqueo de 30 s
        const now = Date.now();
        localStorage.setItem("loginLockoutStart", String(now));
        setLocked(true);
        setTimer(30);

        // Swal con barra de progreso y contador
        let toastInterval;
        Swal.fire({
          icon: "error",
          title: "Demasiados intentos fallidos",
          html: 'Reintentar en <b>30</b> segundos.',
          toast: true,
          position: "top-end",
          timer: 30000,
          timerProgressBar: true,
          showConfirmButton: false,
          didOpen: (toast) => {
            const b = toast.querySelector("b");
            toastInterval = setInterval(() => {
              const remaining = Math.ceil(Swal.getTimerLeft() / 1000);
              if (b) b.textContent = String(remaining);
            }, 100);
          },
          willClose: () => {
            clearInterval(toastInterval);
          },
        });
      } else {
        setError(result.error);
      }
    } else if (result?.ok) {
      // ✅ Login exitoso - limpiar intentos fallidos
      localStorage.removeItem("loginAttempts");
      localStorage.removeItem("loginLockoutStart");
      
      // Mostrar mensaje de éxito
      Swal.fire({
        icon: "success",
        title: "¡Bienvenido!",
        text: "Inicio de sesión exitoso",
        toast: true,
        position: "top-end",
        timer: 2000,
        showConfirmButton: false,
      });
    }
  };

  // 🚪 Función auxiliar para logout con limpieza de sesión
  const handleLogout = async () => {
    try {
      // Obtener información de la sesión actual
      const sessionId = localStorage.getItem("sessionId");
      
      if (sessionId) {
        // Llamar a nuestra API de logout para terminar la sesión en DB
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });

        if (response.ok) {
          console.log(`🚪 [LOGOUT] Sesión ${sessionId} terminada correctamente`);
        } else {
          console.warn('⚠️ [LOGOUT] Error terminando sesión en DB, continuando con logout local');
        }
      }

      // Limpiar localStorage
      localStorage.clear();
      
      // Hacer signOut de NextAuth
      await signOut({ redirect: false });
      
      // Redirigir al login
      router.push('/login');
      
    } catch (error) {
      console.error('❌ [LOGOUT] Error durante logout:', error);
      // Fallback: hacer signOut normal
      await signOut({ redirect: false });
      localStorage.clear();
      router.push('/login');
    }
  };

  // 🔍 Función para verificar estado de sesión (desarrollo)
  const checkSessionStatus = async () => {
    try {
      const apiToken = localStorage.getItem("apiToken");
      const sessionId = localStorage.getItem("sessionId");
      
      if (!apiToken) {
        console.log("❌ No hay token API disponible");
        return;
      }

      // Probar estado de sesión
      const response = await fetch(`/api/auth/update-activity?sessionId=${sessionId}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log("✅ Estado de sesión:", data);
        Swal.fire({
          icon: "info",
          title: "Estado de Sesión",
          html: `
            <p><strong>Sesión:</strong> ${data.data.isActive ? 'Activa' : 'Inactiva'}</p>
            <p><strong>Usuario:</strong> ${data.data.user.nombreCompleto}</p>
            <p><strong>Última actividad:</strong> ${data.data.lastActivityAgo}s ago</p>
            <p><strong>Tiempo restante:</strong> ${data.data.timeRemaining ? Math.floor(data.data.timeRemaining / 60) + 'm' : 'N/A'}</p>
          `,
          showConfirmButton: true,
        });
      } else {
        console.error("❌ Error verificando sesión:", data);
        Swal.fire({
          icon: "error",
          title: "Error de Sesión",
          text: data.error || "Error verificando estado de sesión",
        });
      }
    } catch (error) {
      console.error("❌ Error en verificación:", error);
    }
  };

  // Loader mientras NextAuth carga estado
  if (status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <Loader />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Barra de progreso superior */}
      {isSubmitting && (
        <div
          className="fixed top-0 left-0 h-1 bg-cyan-600 z-50 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      )}

      <div className="flex justify-center items-center min-h-screen bg-gradient-to-r p-4">
        <div className="bg-white p-6 sm:p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-md border-t-8 border-orange-500">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <Image
              src="https://res.cloudinary.com/dw7txgvbh/image/upload/f_auto,q_auto/almapac-logo"
              alt="Almapac Logo"
              width={250}
              height={120}
              style={{ width: "100%", height: "auto" }}
              className="object-contain"
              priority
            />
          </div>

          {/* Título */}
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-4 text-cyan-700">
            Control de Tiempos
          </h2>

          {/* Error */}
          {error && !locked && (
            <p className="text-red-600 text-sm text-center bg-red-100 p-2 rounded-md mb-4">
              {error}
            </p>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Nombre de usuario"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={locked || isSubmitting}
            />
            <input
              type="password"
              placeholder="Contraseña"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={locked || isSubmitting}
            />
            <button
              type="submit"
              disabled={locked || isSubmitting}
              className={`w-full font-bold py-3 rounded-lg shadow-md transform active:translate-y-1 active:shadow-sm transition-all
                ${locked
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-orange-500 hover:bg-orange-600 text-white"
                }`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <FiLoader className="animate-spin text-white text-xl" />
                  <span>Procesando...</span>
                </div>
              ) : locked ? (
                `Intentar de nuevo en ${timer}s`
              ) : (
                "Iniciar Sesión"
              )}
            </button>
          </form>

          {/* 🔧 Información de sesión para desarrollo */}
          {process.env.NODE_ENV === 'development' && session && (
            <div className="mt-4 p-3 bg-gray-100 rounded-lg text-xs">
              <p><strong>Usuario:</strong> {session.user.username}</p>
              <p><strong>Rol:</strong> {session.user.roleName}</p>
              <p><strong>Sesión ID:</strong> {session.sessionId}</p>
              <p><strong>API Token:</strong> {session.apiToken ? '✅ Disponible' : '❌ No disponible'}</p>
              
              <div className="mt-2 space-x-2">
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                >
                  Logout
                </button>
                <button
                  onClick={checkSessionStatus}
                  className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                >
                  Estado Sesión
                </button>
              </div>
            </div>
          )}

          {/* 🔧 Panel de debug para desarrollo */}
          {process.env.NODE_ENV === 'development' && !session && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-xs">
              <p className="text-yellow-800 font-semibold">Modo Desarrollo</p>
              <p className="text-yellow-700">
                Las sesiones se validan automáticamente contra la base de datos
              </p>
              <p className="text-yellow-700">
                Parámetro actual: <strong>{params.get("authorize") || "ninguno"}</strong>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Componente fallback para Suspense
function LoginFormFallback() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 p-4">
      <Loader />
    </div>
  );
}

// Componente principal
export default function LoginForm() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginFormContent />
    </Suspense>
  );
}