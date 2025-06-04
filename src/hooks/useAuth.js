// hooks/useAuth.js - Hook personalizado para gestión de autenticación y sesiones
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

// Definición de roles (sincronizado con middleware)
const ROLES = {
  ADMINISTRADOR: 1,
  MUELLERO: 2,
  CHEQUERO: 3,
  AUDITOR_PROCESOS: 4,
  OPERADOR: 5,
  SUPERVISOR_MANTENIMIENTO: 6,
  MUELLERO_CHEQUERO: 7,
};

// Nombres de roles para display
const ROLE_NAMES = {
  1: 'ADMINISTRADOR',
  2: 'MUELLERO', 
  3: 'CHEQUERO',
  4: 'AUDITOR_PROCESOS',
  5: 'OPERADOR',
  6: 'SUPERVISOR_MANTENIMIENTO',
  7: 'MUELLERO_CHEQUERO'
};

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 🔐 Función para hacer llamadas a APIs protegidas con Bearer token
  const callProtectedAPI = useCallback(async (url, options = {}) => {
    if (!session?.apiToken) {
      throw new Error('No hay token de API disponible');
    }

    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${session.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const response = await fetch(url, { ...options, ...defaultOptions });

    if (response.status === 401) {
      // Token expirado o inválido
      console.warn('🚨 [API] Token expirado, redirigiendo al login...');
      await handleLogout();
      throw new Error('Token expirado');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }, [session]);

  // 🚪 Función para logout con limpieza de sesión
  const handleLogout = useCallback(async (allDevices = false) => {
    try {
      const sessionId = localStorage.getItem("sessionId");
      
      if (sessionId) {
        // Llamar a nuestra API de logout para terminar la sesión en DB
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId, allDevices }),
        });

        if (response.ok) {
          console.log(`🚪 [LOGOUT] Sesión terminada correctamente`);
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
  }, [router]);

  // 📱 Función para obtener sesiones del usuario
  const getSessions = useCallback(async (includeInactive = false) => {
    if (!session) return null;

    try {
      const response = await fetch(`/api/auth/sessions?includeInactive=${includeInactive}`);
      
      if (response.ok) {
        return await response.json();
      }
      
      throw new Error('Error obteniendo sesiones');
    } catch (error) {
      console.error('❌ [GET SESSIONS] Error:', error);
      return null;
    }
  }, [session]);

  // 🔚 Función para terminar una sesión específica
  const terminateSession = useCallback(async (sessionId) => {
    if (!session || !sessionId) return false;

    try {
      const response = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      if (response.ok) {
        console.log(`🔚 [TERMINATE] Sesión ${sessionId} terminada`);
        return true;
      }
      
      throw new Error('Error terminando sesión');
    } catch (error) {
      console.error('❌ [TERMINATE SESSION] Error:', error);
      return false;
    }
  }, [session]);

  // 🛡️ Funciones de verificación de permisos
  const hasRole = useCallback((roleId) => {
    return session?.user?.roleId === roleId;
  }, [session]);

  const hasAnyRole = useCallback((roleIds) => {
    return roleIds.includes(session?.user?.roleId);
  }, [session]);

  const isAdmin = useCallback(() => {
    return hasRole(ROLES.ADMINISTRADOR);
  }, [hasRole]);

  const isMuellero = useCallback(() => {
    return hasAnyRole([ROLES.MUELLERO, ROLES.MUELLERO_CHEQUERO]);
  }, [hasAnyRole]);

  const canAccessEquipos = useCallback(() => {
    return hasAnyRole([
      ROLES.ADMINISTRADOR, 
      ROLES.OPERADOR, 
      ROLES.SUPERVISOR_MANTENIMIENTO
    ]);
  }, [hasAnyRole]);

  const canAccessRecepcion = useCallback(() => {
    return hasAnyRole([
      ROLES.ADMINISTRADOR,
      ROLES.CHEQUERO,
      ROLES.AUDITOR_PROCESOS,
      ROLES.MUELLERO_CHEQUERO
    ]);
  }, [hasAnyRole]);

  // 📊 Función para obtener información del rol
  const getRoleInfo = useCallback(() => {
    const roleId = session?.user?.roleId;
    if (!roleId) return null;

    return {
      id: roleId,
      name: ROLE_NAMES[roleId] || `ROLE_${roleId}`,
      permissions: getPermissionsForRole(roleId)
    };
  }, [session]);

  const getPermissionsForRole = (roleId) => {
    const permissions = [];
    
    if (roleId === ROLES.ADMINISTRADOR) {
      permissions.push('admin', 'usuarios', 'equipos', 'recepcion', 'bitacoras', 'export');
    }
    
    if ([ROLES.MUELLERO, ROLES.MUELLERO_CHEQUERO, ROLES.AUDITOR_PROCESOS].includes(roleId)) {
      permissions.push('bitacoras');
      if ([ROLES.ADMINISTRADOR, ROLES.AUDITOR_PROCESOS].includes(roleId)) {
        permissions.push('export-bitacoras');
      }
    }
    
    if ([ROLES.OPERADOR, ROLES.SUPERVISOR_MANTENIMIENTO].includes(roleId)) {
      permissions.push('equipos');
      if ([ROLES.ADMINISTRADOR, ROLES.SUPERVISOR_MANTENIMIENTO].includes(roleId)) {
        permissions.push('export-equipos');
      }
    }
    
    if ([ROLES.CHEQUERO, ROLES.MUELLERO_CHEQUERO, ROLES.AUDITOR_PROCESOS].includes(roleId)) {
      permissions.push('recepcion');
      if ([ROLES.ADMINISTRADOR, ROLES.AUDITOR_PROCESOS].includes(roleId)) {
        permissions.push('export-recepcion');
      }
    }
    
    return permissions;
  };

  return {
    // Estado de autenticación
    session,
    user: session?.user,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    
    // Información de la sesión
    sessionId: session?.sessionId,
    apiToken: session?.apiToken,
    
    // Funciones principales
    callProtectedAPI,
    logout: handleLogout,
    getSessions,
    terminateSession,
    
    // Verificaciones de roles específicos
    isAdmin,
    isMuellero,
    canAccessEquipos,
    canAccessRecepcion,
    hasRole,
    hasAnyRole,
    getRoleInfo,
    
    // Constantes de roles para uso en componentes
    ROLES,
    ROLE_NAMES,
    
    // Información del usuario actual
    currentRole: session?.user?.roleId,
    currentRoleName: ROLE_NAMES[session?.user?.roleId] || 'UNKNOWN',
    username: session?.user?.username,
    nombreCompleto: session?.user?.nombreCompleto,
    codigo: session?.user?.codigo,
  };
}

// Hook especializado solo para llamadas a API
export function useApiCall() {
  const { callProtectedAPI, isAuthenticated, apiToken } = useAuth();
  
  return {
    callAPI: callProtectedAPI,
    isAuthenticated,
    hasToken: !!apiToken,
  };
}

// Hook especializado para logout
export function useLogout() {
  const { logout } = useAuth();
  
  const logoutCurrentDevice = useCallback(() => logout(false), [logout]);
  const logoutAllDevices = useCallback(() => logout(true), [logout]);
  
  return {
    logoutCurrentDevice,
    logoutAllDevices,
  };
}

// Hook para verificaciones de permisos específicas del negocio
export function usePermissions() {
  const { 
    isAdmin, 
    isMuellero, 
    canAccessEquipos, 
    canAccessRecepcion,
    hasRole,
    hasAnyRole,
    ROLES 
  } = useAuth();
  
  return {
    isAdmin,
    isMuellero,
    canAccessEquipos,
    canAccessRecepcion,
    hasRole,
    hasAnyRole,
    ROLES,
    
    // Funciones específicas de tu negocio
    canExportBitacoras: () => hasAnyRole([ROLES.ADMINISTRADOR, ROLES.AUDITOR_PROCESOS]),
    canExportEquipos: () => hasAnyRole([ROLES.ADMINISTRADOR, ROLES.SUPERVISOR_MANTENIMIENTO]),
    canExportRecepcion: () => hasAnyRole([ROLES.ADMINISTRADOR, ROLES.AUDITOR_PROCESOS]),
    canEditBitacora: () => hasRole(ROLES.ADMINISTRADOR),
    canEditRecepcion: () => hasRole(ROLES.ADMINISTRADOR),
    canManageUsers: () => hasRole(ROLES.ADMINISTRADOR),
    canViewSessions: () => hasRole(ROLES.ADMINISTRADOR),
  };
}