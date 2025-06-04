"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSession, signIn, signOut, getSession } from "next-auth/react";
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
    console.log(`🔍 [SESSION EFFECT] Estado: ${status}, Sesión: ${!!session}`);
    
    if (status === "authenticated" && session) {
      console.log(`✅ [SESSION EFFECT] Usuario autenticado detectado:`, {
        username: session.user.username,
        roleName: session.user.roleName,
        sessionId: session.sessionId,
        hasToken: !!session.token
      });

      // 🧹 Limpiar parámetros URL problemáticos
      cleanupUrlParams();

      // 💾 Guardar información básica del usuario
      localStorage.setItem("userName", session.user.username || "");
      localStorage.setItem("userNameAll", session.user.nombreCompleto || "");
      localStorage.setItem("userRole", session.user.roleName || "");
      localStorage.setItem("userRoleId", String(session.user.roleId || ""));
      localStorage.setItem("userEmail", session.user.email || "");
      localStorage.setItem("userCodigo", session.user.codigo || "");
      
      // 💾 Guardar información de la sesión para gestión
      if (session.sessionId) {
        localStorage.setItem("sessionId", session.sessionId);
        console.log(`💾 [SESSION EFFECT] Sesión guardada: ${session.sessionId}`);
      }
      
      // 🎫 Guardar API token (campo correcto según nuestro sistema)
      if (session.token) {
        localStorage.setItem("apiToken", session.token);
        console.log(`🎫 [SESSION EFFECT] Token API guardado para uso en solicitudes`);
      }
      
      // 📊 Guardar timestamp de login para métricas
      localStorage.setItem("loginTimestamp", String(Date.now()));
      
      console.log(`✅ [SESSION EFFECT] Usuario autenticado: ${session.user.username} (${session.user.roleName})`);
      console.log(`🚀 [SESSION EFFECT] Redirigiendo a dashboard...`);
      
      // Redirigir al dashboard
      router.replace("/");
    } else if (status === "unauthenticated") {
      console.log(`❌ [SESSION EFFECT] Usuario no autenticado`);
    } else if (status === "loading") {
      console.log(`⏳ [SESSION EFFECT] Cargando estado de autenticación...`);
    }
  }, [status, session, router]);

  // 2️⃣ 🆕 Manejo de diferentes tipos de error/autorización
  useEffect(() => {
    const errorParam = params.get("error");
    const authorizeParam = params.get("authorize");
    
    // Primero revisar parámetro error (del middleware ajustado)
    if (errorParam) {
      let title, text, icon;
      
      switch (errorParam) {
        case "AuthRequired":
          title = "Autenticación requerida";
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
          
        case "Forbidden":
          title = "Acceso denegado";
          text = "No tiene permisos para acceder a esta página";
          icon = "error";
          break;
          
        default:
          title = "Error de autenticación";
          text = "Por favor inicie sesión nuevamente";
          icon = "warning";
      }

      Swal.fire({
        icon: icon,
        title: title,
        text: text,
        toast: true,
        position: "top-end",
        timer: 5000,
        showConfirmButton: false,
        timerProgressBar: true,
      }).then(() => {
        // Limpiar datos de sesión anteriores
        cleanupLocalStorage();
        console.log(`🧹 [LOGIN] LocalStorage limpiado por error: ${errorParam}`);
      });
    }
    
    // También manejar parámetro authorize (compatibilidad hacia atrás)
    else if (authorizeParam) {
      let title, text, icon;
      
      switch (authorizeParam) {
        case "SessionRequired":
          title = "Sesión requerida";
          text = "Por favor inicie sesión para continuar";
          icon = "info";
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
        cleanupLocalStorage();
        console.log(`🧹 [LOGIN] LocalStorage limpiado por authorize: ${authorizeParam}`);
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
        console.log(`⏰ [LOGIN] Reanudando bloqueo, ${30 - elapsed}s restantes`);
      } else {
        localStorage.removeItem("loginLockoutStart");
        localStorage.removeItem("loginAttempts");
        console.log(`🔓 [LOGIN] Bloqueo expirado, limpiando`);
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
            console.log(`🔓 [LOGIN] Bloqueo terminado`);
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

  // 🔄 Función para forzar actualización de sesión
  const forceSessionUpdate = async () => {
    try {
      console.log(`🔄 [FORCE SESSION] Forzando actualización de sesión NextAuth...`);
      
      // Llamar a getSession para forzar actualización
      const updatedSession = await getSession();
      
      if (updatedSession) {
        console.log(`✅ [FORCE SESSION] Sesión actualizada:`, {
          username: updatedSession.user.username,
          sessionId: updatedSession.sessionId,
          hasToken: !!updatedSession.token
        });
        
        // Verificar si ahora podemos redirigir
        if (updatedSession.user && updatedSession.sessionId) {
          console.log(`🚀 [FORCE SESSION] Sesión completa, redirigiendo...`);
          router.push('/');
          return true;
        }
      } else {
        console.log(`❌ [FORCE SESSION] No se pudo obtener sesión actualizada`);
      }
      
      return false;
    } catch (error) {
      console.error('❌ [FORCE SESSION] Error forzando actualización:', error);
      return false;
    }
  };

  // 🧹 Función para limpiar localStorage
  const cleanupLocalStorage = () => {
    const keysToRemove = [
      "userName", "userNameAll", "userRole", "userRoleId", 
      "userEmail", "userCodigo", "sessionId", "apiToken", 
      "loginTimestamp"
    ];
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  };

  // 🧹 Función para limpiar parámetros URL problemáticos
  const cleanupUrlParams = () => {
    const currentUrl = new URL(window.location.href);
    const hasErrorParams = currentUrl.searchParams.has('error') || currentUrl.searchParams.has('authorize');
    
    if (hasErrorParams) {
      console.log(`🧹 [URL CLEANUP] Limpiando parámetros problemáticos de URL`);
      currentUrl.searchParams.delete('error');
      currentUrl.searchParams.delete('authorize');
      
      // Cambiar URL sin recargar página
      window.history.replaceState({}, '', currentUrl.pathname);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (locked) return;

    setError("");
    setIsSubmitting(true);

    // Validaciones básicas
    if (!username.trim() || !password.trim()) {
      setError("Por favor complete todos los campos");
      setIsSubmitting(false);
      return;
    }

    // Iniciar barra de progreso animada
    setProgress(0);
    progressIntervalRef.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + Math.random() * 15;
        return next >= 90 ? 90 : next;
      });
    }, 300);

    console.log(`🔑 [LOGIN] Intentando login para usuario: ${username}`);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        username: username.trim(), // NO convertir a lowercase automáticamente
        password: password,
      });

      // Finalizar progreso
      clearInterval(progressIntervalRef.current);
      setProgress(100);
      setTimeout(() => setProgress(0), 400);

      setIsSubmitting(false);

      console.log(`🔍 [LOGIN] Resultado completo de signIn:`, result);
      console.log(`🔍 [LOGIN] Resultado detallado:`, { 
        ok: result?.ok, 
        error: result?.error,
        status: result?.status,
        url: result?.url,
        type: typeof result?.ok,
        errorType: typeof result?.error
      });

      if (result?.error) {
        console.log(`❌ [LOGIN] Error de autenticación: ${result.error}`);
        
        // Registramos intento fallido
        const prev = parseInt(localStorage.getItem("loginAttempts") || "0", 10) + 1;
        localStorage.setItem("loginAttempts", String(prev));

        console.log(`📊 [LOGIN] Intento fallido #${prev} para usuario: ${username}`);

        if (prev >= 5) {
          // Iniciar bloqueo de 30 s
          const now = Date.now();
          localStorage.setItem("loginLockoutStart", String(now));
          setLocked(true);
          setTimer(30);

          console.log(`🔒 [LOGIN] Cuenta bloqueada por 30s después de ${prev} intentos`);

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
          // Mostrar error específico con mejor análisis
          let errorMessage = "Credenciales inválidas";
          
          // Analizar el tipo de error de forma más específica
          const errorLower = result.error.toLowerCase();
          
          if (errorLower.includes("demasiados intentos") || errorLower.includes("rate limit")) {
            errorMessage = "Demasiados intentos. Intenta de nuevo más tarde.";
          } else if (errorLower.includes("usuario o contraseña") || errorLower.includes("invalid") || errorLower.includes("inválid")) {
            errorMessage = "Usuario o contraseña incorrectos";
          } else if (errorLower.includes("usuario no encontrado") || errorLower.includes("user not found")) {
            errorMessage = "Usuario no encontrado";
          } else if (errorLower.includes("usuario inactivo") || errorLower.includes("inactive")) {
            errorMessage = "Usuario inactivo. Contacte al administrador.";
          } else {
            // Mostrar error original si no coincide con patrones conocidos
            errorMessage = result.error;
          }
          
          setError(errorMessage);
          
          // Toast con intentos restantes
          const remaining = 5 - prev;
          Swal.fire({
            icon: "error",
            title: errorMessage,
            text: `${remaining} intentos restantes`,
            toast: true,
            position: "top-end",
            timer: 4000,
            showConfirmButton: false,
            timerProgressBar: true,
          });
          
          console.log(`⚠️ [LOGIN] Mensaje mostrado al usuario: "${errorMessage}", intentos restantes: ${remaining}`);
        }
      } else if (result?.ok) {
        // ✅ Login exitoso - limpiar intentos fallidos
        localStorage.removeItem("loginAttempts");
        localStorage.removeItem("loginLockoutStart");
        
        console.log(`✅ [LOGIN] Login exitoso para usuario: ${username}`);
        console.log(`🔄 [LOGIN] Esperando actualización de sesión NextAuth...`);
        
        // Limpiar errores
        setError("");
        
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
        
        // 🔄 Forzar actualización de sesión NextAuth
        console.log(`🔄 [LOGIN] Forzando actualización de estado de sesión...`);
        
        // Intentar forzar actualización inmediata
        const sessionUpdated = await forceSessionUpdate();
        
        if (!sessionUpdated) {
          // Si no funcionó inmediatamente, intentar después de un delay
          setTimeout(async () => {
            console.log(`🔄 [LOGIN] Segundo intento de actualización de sesión...`);
            const secondAttempt = await forceSessionUpdate();
            
            if (!secondAttempt) {
              // Si después de 3 segundos no hay redirect automático, forzarlo manualmente
              setTimeout(() => {
                console.log(`🔄 [LOGIN] Tercer intento - verificando URL actual...`);
                
                // Solo forzar si seguimos en login
                if (window.location.pathname === '/login') {
                  console.log(`🚀 [LOGIN] Forzando redirect manual a dashboard...`);
                  router.push('/');
                }
              }, 3000);
            }
          }, 1500);
        }
        
        // El redirect principal se maneja en el useEffect de sesión
      } else {
        // Caso inesperado donde no hay error ni ok
        console.warn(`⚠️ [LOGIN] Resultado inesperado de signIn:`, result);
        console.warn(`⚠️ [LOGIN] Valores: ok=${result?.ok}, error=${result?.error}, status=${result?.status}`);
        
        // Verificar si realmente fue exitoso pero result.ok es undefined
        if (!result?.error && result?.status !== 401) {
          console.log(`🤔 [LOGIN] Posible éxito con result.ok undefined, verificando sesión...`);
          
          // Intentar forzar actualización de sesión
          setTimeout(async () => {
            console.log(`🔍 [LOGIN] Intentando forzar actualización después de resultado ambiguo...`);
            
            const sessionUpdated = await forceSessionUpdate();
            
            if (!sessionUpdated) {
              // Si no hay sesión después de intentar, verificar localStorage
              setTimeout(() => {
                const storedToken = localStorage.getItem("apiToken");
                if (storedToken) {
                  console.log(`✅ [LOGIN] Token encontrado en localStorage, forzando redirect`);
                  setError("");
                  router.push('/');
                } else {
                  console.log(`❌ [LOGIN] No hay token, considerando fallo`);
                  setError("Error inesperado durante el login. Intente nuevamente.");
                }
              }, 1000);
            }
          }, 1000);
        } else {
          setError("Error inesperado durante el login. Intente nuevamente.");
        }
      }
    } catch (error) {
      console.error('❌ [LOGIN] Error durante el proceso de login:', error);
      setError("Error interno. Intente nuevamente.");
      setIsSubmitting(false);
      
      // Finalizar progreso en caso de error
      clearInterval(progressIntervalRef.current);
      setProgress(0);
    }
  };

  // 🚪 Función auxiliar para logout con limpieza completa de sesión
  const handleLogout = async () => {
    try {
      console.log('🚪 [LOGOUT] Iniciando proceso de logout...');
      
      // Obtener información de la sesión actual
      const sessionId = localStorage.getItem("sessionId");
      
      if (sessionId) {
        // Llamar a nuestra API de logout para terminar la sesión en DB
        console.log(`🔄 [LOGOUT] Terminando sesión ${sessionId} en base de datos...`);
        
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            sessionId,
            reason: 'USER_LOGOUT'
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ [LOGOUT] Sesión terminada correctamente:`, data);
        } else {
          console.warn('⚠️ [LOGOUT] Error terminando sesión en DB, continuando con logout local');
        }
      }

      // Limpiar localStorage completamente
      cleanupLocalStorage();
      
      // Hacer signOut de NextAuth
      await signOut({ redirect: false });
      
      console.log(`✅ [LOGOUT] Logout completado exitosamente`);
      
      // Mostrar confirmación
      Swal.fire({
        icon: "success",
        title: "Sesión cerrada",
        text: "Has cerrado sesión correctamente",
        toast: true,
        position: "top-end",
        timer: 2000,
        showConfirmButton: false,
      });
      
      // Redirigir al login
      router.push('/login');
      
    } catch (error) {
      console.error('❌ [LOGOUT] Error durante logout:', error);
      
      // Fallback: hacer signOut normal y limpiar todo
      try {
        await signOut({ redirect: false });
        cleanupLocalStorage();
        router.push('/login');
        
        Swal.fire({
          icon: "warning",
          title: "Sesión cerrada",
          text: "Sesión cerrada con advertencias",
          toast: true,
          position: "top-end",
          timer: 2000,
          showConfirmButton: false,
        });
      } catch (fallbackError) {
        console.error('❌ [LOGOUT] Error en fallback logout:', fallbackError);
        // Último recurso: limpiar localStorage y recargar página
        cleanupLocalStorage();
        window.location.href = '/login';
      }
    }
  };

  // 🔍 Función para verificar estado de sesión (desarrollo)
  const checkSessionStatus = async () => {
    try {
      const apiToken = localStorage.getItem("apiToken");
      const sessionId = localStorage.getItem("sessionId");
      
      if (!apiToken || !sessionId) {
        console.log("❌ No hay token API o sessionId disponible");
        Swal.fire({
          icon: "error",
          title: "Sin datos de sesión",
          text: "No se encontraron datos de sesión local",
        });
        return;
      }

      console.log(`🔍 [SESSION CHECK] Verificando estado de sesión ${sessionId}...`);

      // Probar estado de sesión usando nuestras APIs
      const response = await fetch(`/api/auth/update-activity?sessionId=${sessionId}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log("✅ Estado de sesión:", data);
        
        const sessionData = data.data;
        const timeRemainingMins = sessionData.minutesRemaining || 0;
        const lastActivityMins = sessionData.timing?.lastActivityMinutesAgo || 0;
        
        Swal.fire({
          icon: "info",
          title: "Estado de Sesión",
          html: `
            <div class="text-left space-y-2">
              <p><strong>Estado:</strong> <span class="text-green-600">${sessionData.isActive ? 'Activa' : 'Inactiva'}</span></p>
              <p><strong>Usuario:</strong> ${sessionData.user.nombreCompleto || sessionData.user.username}</p>
              <p><strong>Rol:</strong> ${sessionData.user.roleName || 'N/A'}</p>
              <p><strong>Última actividad:</strong> ${lastActivityMins}m atrás</p>
              <p><strong>Tiempo restante:</strong> ${timeRemainingMins}m</p>
              <p><strong>Dispositivo:</strong> ${sessionData.device?.type || 'N/A'}</p>
              <p><strong>IP:</strong> ${sessionData.device?.ipAddress || 'N/A'}</p>
            </div>
          `,
          showConfirmButton: true,
          confirmButtonText: "Cerrar",
          width: '400px'
        });
      } else {
        console.error("❌ Error verificando sesión:", data);
        Swal.fire({
          icon: "error",
          title: "Error de Sesión",
          text: data.error || "Error verificando estado de sesión",
          footer: `Código: ${data.code || 'UNKNOWN'}`
        });
      }
    } catch (error) {
      console.error("❌ Error en verificación:", error);
      Swal.fire({
        icon: "error",
        title: "Error de Conexión",
        text: "No se pudo verificar el estado de la sesión",
      });
    }
  };

  // 🔧 Función para debug de credenciales (solo desarrollo)
  const debugCredentials = () => {
    if (process.env.NODE_ENV !== 'development') return;
    
    const currentUrl = new URL(window.location.href);
    const hasUrlParams = currentUrl.searchParams.has('error') || currentUrl.searchParams.has('authorize');
    
    Swal.fire({
      title: '🔧 Debug de Credenciales',
      html: `
        <div class="text-left space-y-2 text-sm">
          <p><strong>Username actual:</strong> "${username}"</p>
          <p><strong>Username trimmed:</strong> "${username.trim()}"</p>
          <p><strong>Username lowercase:</strong> "${username.trim().toLowerCase()}"</p>
          <p><strong>Password length:</strong> ${password.length} caracteres</p>
          <p><strong>Intentos previos:</strong> ${localStorage.getItem("loginAttempts") || "0"}</p>
          <p><strong>Bloqueado:</strong> ${locked ? 'SÍ' : 'NO'}</p>
          <p><strong>Timer:</strong> ${timer}s</p>
          <p><strong>URL params problemáticos:</strong> ${hasUrlParams ? 'SÍ' : 'NO'}</p>
          <p><strong>Current URL:</strong> ${window.location.href}</p>
        </div>
        <br>
        <div class="text-xs text-gray-600">
          <p>Usa exactamente el username tal como está en la base de datos.</p>
          <p>El sistema intentará primero tal como escribes, luego en lowercase.</p>
          <p>Si hay params problemáticos, se limpiarán automáticamente al autenticarse.</p>
        </div>
      `,
      showConfirmButton: true,
      confirmButtonText: "Cerrar",
      width: '500px'
    });
  };

  // 🧹 Función para forzar limpieza (desarrollo)
  const forceCleanup = () => {
    if (process.env.NODE_ENV !== 'development') return;
    
    console.log(`🧹 [FORCE CLEANUP] Limpiando URL y localStorage...`);
    
    cleanupUrlParams();
    cleanupLocalStorage();
    setError("");
    
    Swal.fire({
      icon: "success",
      title: "Limpieza completa",
      text: "URL y localStorage limpiados",
      toast: true,
      position: "top-end",
      timer: 2000,
      showConfirmButton: false,
    });
    
    console.log(`✅ [FORCE CLEANUP] Limpieza completa realizada`);
  };

  // 🧪 Función para probar token API (desarrollo) - REMOVIDA PARA MANTENER DISEÑO ORIGINAL

  // Loader mientras NextAuth carga estado
  if (status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="text-center">
          <Loader />
          <p className="mt-4 text-gray-600">Verificando autenticación...</p>
        </div>
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
              <p><strong>API Token:</strong> {session.token ? '✅ Disponible' : '❌ No disponible'}</p>
              
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
                Parámetro actual: <strong>{params.get("error") || params.get("authorize") || "ninguno"}</strong>
              </p>
              
              {/* Botones de debug */}
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                <button
                  onClick={debugCredentials}
                  className="px-2 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
                  disabled={!username && !password}
                >
                  🔧 Debug
                </button>
                <button
                  onClick={forceSessionUpdate}
                  className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  🔄 Sesión
                </button>
                <button
                  onClick={forceCleanup}
                  className="px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
                >
                  🧹 Limpiar
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  🔄 Reload
                </button>
              </div>
              
              {/* Guía de debugging */}
              <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                <p className="text-blue-800 font-semibold">📋 Debug Guide:</p>
                <p className="text-blue-700">• Abre DevTools (F12) → Console</p>
                <p className="text-blue-700">• Busca logs: 🔑 [authorize], ✅ [LOGIN], 🔍 [SESSION EFFECT]</p>
                <p className="text-blue-700">• Si login OK pero no redirige → usar "🔄 Sesión"</p>
                <p className="text-blue-700">• NUEVO: 🔧 Caso especial detecta "AuthRequired" con ok=true</p>
                <p className="text-blue-700">• Middleware excluye rutas /api/auth/* completamente</p>
              </div>
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
    <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
      <div className="text-center">
        <Loader />
        <p className="mt-4 text-gray-600">Cargando formulario de login...</p>
      </div>
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