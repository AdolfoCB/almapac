"use client";

import React, {
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { 
  FiArrowLeft, 
  FiRefreshCw, 
  FiShield, 
  FiMonitor,
  FiSmartphone,
  FiTablet,
  FiUsers,
  FiActivity,
  FiAlertTriangle
} from "react-icons/fi";
import { FaEye, FaTrash, FaBan, FaPlay } from "react-icons/fa";
import Swal from "sweetalert2";
import DataTable from "@/components/DataTable";
import DetailModal from "@/components/DetailModal";

// debounce helper
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

interface UserSession {
  id: string;
  userId: number;
  isActive: boolean;
  createdAt: string;
  lastActivity: string;
  expiresAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  deviceOS: string | null;
  browser: string | null;
  deviceModel: string | null;
  deviceType: string | null;
  ipAddress: string | null;
  loginAttempts: number;
  user: {
    id: number;
    username: string;
    nombreCompleto: string;
    email: string;
    roleId: number;
    role: {
      name: string;
    };
  };
}

interface SessionStats {
  summary: {
    totalSessions: number;
    activeSessions: number;
    recentSessions: number;
    uniqueActiveUsers: number;
    timeRangeDays: number;
  };
  deviceTypes: Array<{ type: string; count: number }>;
  operatingSystems: Array<{ os: string; count: number }>;
  browsers: Array<{ browser: string; count: number }>;
  topIPs: Array<{ ip: string; count: number }>;
}

interface Session {
  user?: User;
}

interface User {
  roleId?: number;
}

interface SessionResponse {
  data: {
    sessions: UserSession[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function SessionsManagementPage() {
  const { data: session } = useSession() as { data: Session | null };
  const roleId: number | null = session?.user?.roleId || null;

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Filtros
  const [filterUserId, setFilterUserId] = useState<string>("");
  const [filterIsActive, setFilterIsActive] = useState<string>("");
  const [filterDeviceType, setFilterDeviceType] = useState<string>("");
  const [filterIpAddress, setFilterIpAddress] = useState<string>("");
  const [refreshLoading, setRefreshLoading] = useState<boolean>(false);

  // Modal
  const [showViewModal, setShowViewModal] = useState<boolean>(false);
  const [viewData, setViewData] = useState<UserSession | null>(null);

  const debouncedSetSearch = useCallback(
    debounce((v: string) => setSearch(v), 500),
    []
  );

  const router = useRouter();

  async function fetchSessions() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filterUserId) params.append('userId', filterUserId);
      if (filterIsActive) params.append('isActive', filterIsActive);
      if (filterDeviceType) params.append('deviceType', filterDeviceType);
      if (filterIpAddress) params.append('ipAddress', filterIpAddress);

      const res = await fetch(`/api/v1/sessions?${params}`);
      const data: SessionResponse = await res.json();
      
      if (res.ok) {
        setSessions(data.data.sessions);
        setTotalCount(data.data.totalCount);
      } else {
        throw new Error('Error al obtener sesiones');
      }

    } catch (error) {
      console.error("Error al listar sesiones:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo obtener la lista de sesiones",
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/v1/sessions/stats?timeRange=7');
      const data = await res.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Error al obtener estadísticas:", error);
    } finally {
      setStatsLoading(false);
    }
  }

  useEffect(() => {
    fetchSessions();
  }, [search, page, limit, filterUserId, filterIsActive, filterDeviceType, filterIpAddress]);

  useEffect(() => {
    fetchStats();
  }, []);

  const refreshData = async () => {
    setRefreshLoading(true);
    await Promise.all([fetchSessions(), fetchStats()]);
    setRefreshLoading(false);
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Datos actualizados",
      showConfirmButton: false,
      timer: 1500,
    });
  };

  const handleViewDetails = (item: UserSession) => {
    setViewData(item);
    setShowViewModal(true);
  };

  const handleRevokeSession = async (sessionId: string) => {
    const result = await Swal.fire({
      title: '¿Revocar sesión?',
      text: 'Esta acción terminará la sesión del usuario inmediatamente.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, revocar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/v1/sessions/${sessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'revoke',
            reason: 'ADMIN_REVOKE'
          })
        });

        const data = await res.json();
        
        if (data.success) {
          Swal.fire('Revocada', 'La sesión ha sido revocada correctamente.', 'success');
          fetchSessions();
        } else {
          throw new Error(data.message);
        }
      } catch (error) {
        Swal.fire('Error', 'No se pudo revocar la sesión.', 'error');
      }
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    const result = await Swal.fire({
      title: '¿Eliminar sesión?',
      text: 'Esta acción eliminará permanentemente el registro de la sesión.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/v1/sessions/${sessionId}`, {
          method: 'DELETE'
        });

        const data = await res.json();
        
        if (data.success) {
          Swal.fire('Eliminada', 'La sesión ha sido eliminada correctamente.', 'success');
          fetchSessions();
        } else {
          throw new Error(data.message);
        }
      } catch (error) {
        Swal.fire('Error', 'No se pudo eliminar la sesión.', 'error');
      }
    }
  };

  const handleRevokeAllUserSessions = async (userId: number, username: string) => {
    const result = await Swal.fire({
      title: `¿Revocar todas las sesiones de ${username}?`,
      text: 'Esta acción terminará todas las sesiones activas del usuario.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, revocar todas',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch('/api/v1/sessions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'revoke-user',
            userId,
            reason: 'ADMIN_REVOKE_ALL_USER'
          })
        });

        const data = await res.json();
        
        if (data.success) {
          Swal.fire('Revocadas', `${data.data.revokedSessions} sesiones revocadas correctamente.`, 'success');
          fetchSessions();
        } else {
          throw new Error(data.message);
        }
      } catch (error) {
        Swal.fire('Error', 'No se pudieron revocar las sesiones.', 'error');
      }
    }
  };

  const handleRevokeAllSessions = async () => { 
    const result = await Swal.fire({
        title: '¿Revocar TODAS las sesiones?',
        text: 'Esta acción terminará todas las sesiones activas del sistema. ¡Incluye la tuya!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3838b0',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, revocar',
        cancelButtonText: 'No, cancelar'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch('/api/v1/sessions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'revoke-all',
            reason: 'ADMIN_REVOKE_ALL_SYSTEM'
          })
        });

        const data = await res.json();
        
        if (data.success) {
          Swal.fire('Revocadas', `${data.data.revokedSessions} sesiones revocadas. Serás redirigido al login.`, 'success')
            .then(() => {
              window.location.href = '/login';
            });
        } else {
          throw new Error(data.message);
        }
      } catch (error) {
        Swal.fire('Error', 'No se pudieron revocar las sesiones.', 'error');
      }
    }
  };

  const handleDeleteAllSessions = async () => { 
    const result = await Swal.fire({
        title: '¿ELIMINAR TODAS las sesiones?',
        text: 'Esta acción eliminará físicamente TODOS los registros de sesiones de la base de datos. ¡Esta acción es IRREVERSIBLE!',
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, ELIMINAR TODO',
        cancelButtonText: 'No, cancelar',
        input: 'text',
        inputPlaceholder: 'Escribe "ELIMINAR" para confirmar',
        inputValidator: (value) => {
          if (value !== 'ELIMINAR') {
            return 'Debes escribir "ELIMINAR" exactamente para confirmar';
          }
        }
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch('/api/v1/sessions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete-all',
            reason: 'ADMIN_DELETE_ALL_SYSTEM'
          })
        });

        const data = await res.json();
        
        if (data.success) {
          Swal.fire('Eliminadas', `${data.data.deletedSessions} sesiones eliminadas permanentemente de la base de datos.`, 'success');
          fetchSessions();
          fetchStats();
        } else {
          throw new Error(data.message);
        }
      } catch (error) {
        Swal.fire('Error', 'No se pudieron eliminar las sesiones.', 'error');
      }
    }
  };

  // Función para obtener el color del estado
  const getStatusBadgeClass = (isActive: boolean, expiresAt: string | null) => {
    if (!isActive) return "bg-red-200 text-red-800 font-bold";
    if (expiresAt && new Date(expiresAt) < new Date()) return "bg-orange-200 text-orange-800 font-bold";
    return "bg-green-200 text-green-800 font-bold";
  };

  // Función para obtener el icono del dispositivo
  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType) {
      case 'mobile': return <FiSmartphone size={16} />;
      case 'tablet': return <FiTablet size={16} />;
      default: return <FiMonitor size={16} />;
    }
  };

  // Función para formatear fecha
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Función para calcular tiempo transcurrido
  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  const totalPages = Math.ceil(totalCount / limit);

  // Configuración del modal para las sesiones
  const getModalSections = (sessionData: UserSession) => [
    {
      title: "Usuario",
      icon: <FiUsers className="mr-2" />,
      fields: [
        { label: "Username", value: sessionData.user.username },
        { label: "Nombre Completo", value: sessionData.user.nombreCompleto },
        { label: "Email", value: sessionData.user.email },
        { label: "Rol", value: sessionData.user.role.name }
      ]
    },
    {
      title: "Dispositivo",
      icon: getDeviceIcon(sessionData.deviceType),
      fields: [
        { label: "Sistema Operativo", value: sessionData.deviceOS || 'Desconocido' },
        { label: "Navegador", value: sessionData.browser || 'Desconocido' },
        { label: "Modelo", value: sessionData.deviceModel || 'No disponible' },
        { label: "Tipo", value: sessionData.deviceType ? sessionData.deviceType.charAt(0).toUpperCase() + sessionData.deviceType.slice(1) : 'Desktop' },
        { label: "Dirección IP", value: sessionData.ipAddress || 'No disponible', className: "font-mono" }
      ]
    },
    {
      title: "Sesión",
      icon: <FiActivity className="mr-2" />,
      fields: [
        { 
          label: "Estado", 
          value: (
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(
                sessionData.isActive,
                sessionData.expiresAt
              )}`}
            >
              {!sessionData.isActive ? 'Inactiva' : 
               sessionData.expiresAt && new Date(sessionData.expiresAt) < new Date() ? 'Expirada' : 'Activa'}
            </span>
          )
        },
        { label: "Creada", value: formatDate(sessionData.createdAt) },
        { label: "Última Actividad", value: formatDate(sessionData.lastActivity) },
        { label: "Expira", value: sessionData.expiresAt ? formatDate(sessionData.expiresAt) : 'Nunca' },
        ...(sessionData.endedAt ? [{ label: "Terminada", value: formatDate(sessionData.endedAt) }] : []),
        ...(sessionData.endReason ? [{ label: "Razón", value: sessionData.endReason }] : [])
      ]
    },
    {
      title: "Seguridad",
      icon: <FiShield className="mr-2" />,
      fields: [
        { label: "ID de Sesión", value: sessionData.id, className: "font-mono text-xs" },
        { 
          label: "Intentos de Login Fallidos", 
          value: (
            <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
              sessionData.loginAttempts > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
            }`}>
              {sessionData.loginAttempts}
            </span>
          )
        }
      ]
    }
  ];

  const getModalButtons = (sessionData: UserSession) => [
    ...(sessionData.isActive ? [{
      label: "Revocar Sesión",
      onClick: () => {
        setShowViewModal(false);
        handleRevokeSession(sessionData.id);
      },
      className: "flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md",
      icon: <FaBan className="w-4 h-4" />,
      condition: () => roleId === 1 || roleId === 6
    }] : []),
    {
      label: "Eliminar",
      onClick: () => {
        setShowViewModal(false);
        handleDeleteSession(sessionData.id);
      },
      className: "flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md",
      icon: <FaTrash className="w-4 h-4" />,
      condition: () => roleId === 1 || roleId === 6
    }
  ];

  // Definición de columnas para DataTable
  const columns = [
    {
      key: "user",
      label: "Usuario",
      render: (_: any, row: UserSession) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.user.nombreCompleto}</span>
        </div>
      ),
      className: "whitespace-nowrap",
      noWrap: true,
    },
    {
      key: "device",
      align: "left" as const,
      label: "Dispositivo",
      render: (_: any, row: UserSession) => (
        <div className="flex items-center space-x-2">
          {getDeviceIcon(row.deviceModel)}
          <div className="flex flex-col">
            <span className="text-sm">{row.deviceModel || 'Desconocido'}</span>
          </div>
        </div>
      ),
      className: "whitespace-nowrap",
      noWrap: true,
    },
    {
      key: "ipAddress",
      label: "IP",
      render: (_: any, row: UserSession) => (
        <span className="font-mono text-sm">{row.ipAddress || 'N/A'}</span>
      ),
      className: "whitespace-nowrap",
      align: "center" as const,
      noWrap: true,
    },
    {
      key: "status",
      label: "Estado",
      render: (_: any, row: UserSession) => (
        <span
          className={`px-2 py-1 rounded-md text-sm font-medium ${getStatusBadgeClass(
            row.isActive,
            row.expiresAt
          )}`}
        >
          {!row.isActive ? 'Inactiva' : 
           row.expiresAt && new Date(row.expiresAt) < new Date() ? 'Expirada' : 'Activa'}
        </span>
      ),
      noWrap: true,
      align: "center" as const,
    },
    {
      key: "lastActivity",
      label: "Última Actividad",
      render: (_: any, row: UserSession) => (
        <div className="flex flex-col">
          <span className="text-sm">{formatDate(row.lastActivity)}</span>
          <span className="text-xs text-gray-500">hace {getTimeAgo(row.lastActivity)}</span>
        </div>
      ),
      className: "whitespace-nowrap",
      noWrap: true,
    },
    {
      key: "loginAttempts",
      label: "Intentos",
      render: (_: any, row: UserSession) => (
        <div className="flex items-center justify-center">
          {row.loginAttempts > 0 && (
            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
              {row.loginAttempts}
            </span>
          )}
        </div>
      ),
      align: "center" as const,
      noWrap: true,
    },
  ];

  // Acciones (botones) para cada fila
  const actions = [
    {
      type: "view" as const,
      onClick: handleViewDetails,
      title: "Ver detalles",
    },
    {
      onClick: (item: UserSession) => handleRevokeSession(item.id),
      title: "Revocar sesión",
      className: "bg-orange-500 hover:bg-orange-600 text-white p-2 rounded ml-2 transition-all duration-300 transform hover:scale-105 text-xs",
      icon: <FaBan size={18} />,
      condition: (item: UserSession) => item.isActive
    },
    {
      onClick: (item: UserSession) => handleRevokeAllUserSessions(item.userId, item.user.username),
      title: "Revocar todas del usuario",
      className: "bg-amber-500 hover:bg-amber-600 text-white p-2 rounded ml-2 transition-all duration-300 transform hover:scale-105 text-xs",
      icon: <FiAlertTriangle size={18} />
    },
    {
      type: "delete" as const,
      onClick: (item: UserSession) => handleDeleteSession(item.id),
      title: "Eliminar registro",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Encabezado */}
      <header className="bg-[#110885] text-white shadow-lg md:sticky md:top-0 z-50">
        <div className="mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between">
            <div className="flex items-center">
              <button
                onClick={() => router.push("/")}
                className="bg-white hover:bg-gray-200 text-blue-600 p-2 rounded-full mr-3 transition-all duration-300 transform hover:scale-105"
                title="Volver"
              >
                <FiArrowLeft size={20} />
              </button>
              <h1 className="text-xl font-bold">Gestión de Sesiones</h1>
            </div>
            <div className="grid grid-cols-2 md:flex md:flex-row items-center mt-4 md:mt-0 gap-3">
              {(roleId === 1 || roleId === 6) && (
                <button
                  onClick={handleDeleteAllSessions}
                  className="bg-red-900 hover:bg-red-950 text-white px-3 py-2 rounded flex items-center gap-1 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
                >
                  <FaTrash size={18} />
                  <span>Eliminar Todas</span>
                </button>
              )}
              <button
                onClick={handleRevokeAllSessions}
                className="bg-red-700 hover:bg-red-800 text-white px-3 py-2 rounded flex items-center gap-1 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
              >
                <FiAlertTriangle size={20} />
                <span>Revocar Todas</span>
              </button>
              <button
                onClick={refreshData}
                className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded flex items-center gap-1 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
                disabled={refreshLoading}
              >
                {refreshLoading ? (
                  <span className="inline-block animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4"></span>
                ) : (
                  <FiRefreshCw size={20} />
                )}
                <span>Actualizar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="container mx-auto px-4 py-6">
        {/* Estadísticas */}
        {stats && (
          <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FiActivity className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Sesiones Activas</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.summary.activeSessions}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <FiUsers className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Usuarios Únicos</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.summary.uniqueActiveUsers}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FiShield className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Sesiones</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.summary.totalSessions}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <FiRefreshCw className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Recientes (7d)</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.summary.recentSessions}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Contenido principal */}
        <section className="bg-white p-4 rounded-lg shadow space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
            <h2 className="text-lg font-semibold mb-2 md:mb-0">Sesiones Activas</h2>
          </div>

          {/* Tabla con DataTable */}
          <DataTable<UserSession>
            data={sessions}
            columns={columns}
            actions={actions}
            loading={loading}
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={limit}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setLimit(size);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            emptyMessage="No hay sesiones registradas"
            tableId="sessions-table"
            tableClassName="min-w-full border text-sm bg-white rounded-lg shadow"
            headerClassName="bg-gray-200"
            rowClassName={(row: UserSession) => !row.isActive ? "bg-gray-100 text-gray-500" : ""}
            showPagination={true}
          />
        </section>
      </div>

      {/* Modal de detalles usando el componente reutilizable */}
      {viewData && (
        <DetailModal
          isOpen={showViewModal}
          onClose={() => setShowViewModal(false)}
          title="Detalle de Sesión"
          subtitle={`Usuario: ${viewData.user.username}`}
          icon={<FiShield className="w-5 h-5" />}
          sections={getModalSections(viewData)}
          buttons={getModalButtons(viewData)}
          roleId={roleId}
        />
      )}
    </div>
  );
}
