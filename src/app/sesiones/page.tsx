"use client";

import React from "react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { FiArrowLeft, FiRefreshCw } from "react-icons/fi";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import DataTable from "@/components/DataTable";

// Types
interface UserSession {
  id: number;
  sessionToken: string;
  userId: number;
  isActive: boolean;
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
  endedAt?: string;
  endReason?: string;
  deviceOS?: string;
  browser?: string;
  deviceModel?: string;
  deviceType?: string;
  ipAddress?: string;
  user: {
    username: string;
    nombreCompleto?: string;
    role: {
      name: string;
    };
  };
}

interface User {
  roleId?: number;
}

interface Session {
  user?: User;
}

interface SessionsResponse {
  sessions: UserSession[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// Función debounce
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

// --- Helper: Toast Success Notification ---
const toastSuccess = (title: string) => {
  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "success",
    title,
    showConfirmButton: false,
    timer: 1500,
  });
};

// --- Helper: Show Error Message ---
const showError = (message?: string, defaultMsg = "Ocurrió un error") => {
  Swal.fire({
    icon: "error",
    title: "Error",
    text: message || defaultMsg,
    confirmButtonText: "Entendido",
    allowOutsideClick: false,
  });
};

// Mapeo de roles
const ROLES_MAP: { [key: string]: string } = {
  'admin': 'ADMINISTRADOR',
  'supervisor': 'SUPERVISOR',
  'operador': 'OPERADOR',
  'muellero': 'MUELLERO',
  'chequero': 'CHEQUERO',
  'auditor': 'AUDITOR_PROCESOS',
  'mantenimiento': 'SUPERVISOR_MANTENIMIENTO'
};

export default function SessionsPage() {
  const router = useRouter();
  const { data: session } = useSession() as { data: Session | null };
  const roleId: number | null = session?.user?.roleId || null;

  // Estados para el listado de sesiones, paginación y búsqueda
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Estados para filtros
  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFinal, setFechaFinal] = useState<string>("");
  const [filterActive, setFilterActive] = useState<string>("true");
  const [filterUserId, setFilterUserId] = useState<string>("");
  
  // Estados para loading de exportación y refresco
  const [refreshLoading, setRefreshLoading] = useState<boolean>(false);

  // Estados para el modal de detalles
  const [showViewModal, setShowViewModal] = useState<boolean>(false);
  const [viewData, setViewData] = useState<UserSession | null>(null);

  // Verificar permisos de administrador
  useEffect(() => {
    if (roleId !== null && roleId !== 1) {
      router.push('/403');
      return;
    }
  }, [roleId, router]);

  // Función para obtener sesiones de la API
  async function fetchSessions() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filterActive && { isActive: filterActive }),
        ...(filterUserId && { userId: filterUserId }),
      });

      const res = await fetch(`/api/v1/sessions?${params}`);
      const data: SessionsResponse = await res.json();
      
      if (res.ok) {
        setSessions(data.sessions || []);
        setTotalCount(data.pagination?.total || 0);
      } else {
        showError("Error al cargar sesiones");
      }
    } catch(error) {
      console.log(error);
      showError("No se pudieron cargar las sesiones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (roleId === 1) { // Solo cargar si es administrador
      fetchSessions();
    }
  }, [page, limit, filterActive, filterUserId, roleId]);

  // Filtrar sesiones por fecha
  const filteredSessions = sessions.filter((session) => {
    const fechaSession = new Date(session.createdAt);
    const inicio = fechaInicio ? new Date(fechaInicio) : null;
    const fin = fechaFinal ? new Date(fechaFinal) : null;

    if (inicio && fin) {
      return fechaSession >= inicio && fechaSession <= fin;
    } else if (inicio) {
      return fechaSession >= inicio;
    } else if (fin) {
      return fechaSession <= fin;
    }
    return true;
  });

  // Función para Actualizar la lista de sesiones
  const refreshData = async (): Promise<void> => {
    try {
      setRefreshLoading(true);
      await fetchSessions();
      toastSuccess("Datos actualizados");
    } catch(error) {
      console.log(error);
      showError("No se pudieron actualizar los datos");
    } finally {
      setRefreshLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  // Función para formatear fechas
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('es-SV', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Función para calcular duración
  const formatDuration = (start: string, end?: string): string => {
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Abre el modal con los detalles de la sesión seleccionada
  const handleViewDetails = (session: UserSession): void => {
    setViewData(session);
    setShowViewModal(true);
  }
  // Configuración de columnas y acciones para DataTable
  const columns = [
    {
      key: "user",
      label: "Usuario",
      render: (_: any, row: UserSession) => (
        <div>
          <div className="font-medium">{row.user.username}</div>
          <div className="text-sm text-gray-500">{row.user.nombreCompleto}</div>
        </div>
      )
    },
    {
      key: "role",
      label: "Rol",
      render: (_: any, row: UserSession) => (
        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
          {row.user.role.name}
        </span>
      )
    },
    {
      key: "device",
      label: "Dispositivo",
      render: (_: any, row: UserSession) => (
        <div className="text-sm">
          <div>{row.deviceOS}</div>
          <div className="text-gray-500">{row.browser}</div>
          <div className="text-gray-500">{row.deviceType}</div>
        </div>
      )
    },
    {
      key: "ipAddress",
      label: "IP",
      render: (_: any, row: UserSession) => (
        <span className="text-sm">{row.ipAddress}</span>
      )
    },
    {
      key: "createdAt",
      label: "Inicio",
      render: (_: any, row: UserSession) => (
        <span className="text-sm">{formatDate(row.createdAt)}</span>
      )
    },
    {
      key: "lastActivity",
      label: "Última Actividad",
      render: (_: any, row: UserSession) => (
        <span className="text-sm">
          {formatDate(row.lastActivity || row.createdAt)}
        </span>
      )
    },
    {
      key: "duration",
      label: "Duración",
      render: (_: any, row: UserSession) => (
        <span className="text-sm">
          {formatDuration(row.createdAt, row.endedAt)}
        </span>
      )
    },
    {
      key: "status",
      label: "Estado",
      render: (_: any, row: UserSession) => (
        <span className={`text-sm px-2 py-1 rounded ${
          row.isActive 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {row.isActive ? 'Activa' : 'Terminada'}
        </span>
      )
    }
  ];

  const actions = [
    {
      type: "view" as const,
      onClick: handleViewDetails,
      title: "Ver detalles"
    }
  ];
  // Si no es administrador, mostrar acceso denegado
  if (roleId !== null && roleId !== 1) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600 mb-4">No tiene permisos para acceder a esta página.</p>
          <button
            onClick={() => router.push("/")}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Encabezado */}
      <header className="bg-[#003E9B] text-white shadow-lg md:sticky md:top-0 z-50">
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
              <h1 className="text-xl font-bold">Sesiones Usuarios</h1>
            </div>
            <div className="grid grid-cols-2 md:flex md:flex-row items-center mt-4 md:mt-0 gap-3">
              <button
                onClick={refreshData}
                title="Actualizar"
                className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded flex items-center gap-1 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
              >
                {refreshLoading ? (
                  <span className="inline-block animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4"></span>
                ) : (
                  <FiRefreshCw size={20} />
                )}
                <span className="md:inline">Actualizar</span>
              </button>
            </div>
          </div>
          
          {/* Filtros */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex flex-col">
              <label className="text-sm">Fecha Inicio</label>
              <input
                type="date"
                className="border text-black p-1 w-full rounded"
                value={fechaInicio}
                onChange={(e) => {
                  setFechaInicio(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm">Fecha Final</label>
              <input
                type="date"
                className="border text-black p-1 w-full rounded"
                value={fechaFinal}
                onChange={(e) => {
                  setFechaFinal(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm">Estado</label>
              <select
                value={filterActive}
                onChange={(e) => {
                  setFilterActive(e.target.value);
                  setPage(1);
                }}
                className="border text-black p-1 w-full rounded"
              >
                <option value="">Todas</option>
                <option value="true">Activas</option>
                <option value="false">Terminadas</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-sm">Usuario ID</label>
              <input
                type="number"
                placeholder="ID del usuario"
                value={filterUserId}
                onChange={(e) => {
                  setFilterUserId(e.target.value);
                  setPage(1);
                }}
                className="border text-black p-1 w-full rounded"
              />
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="container mx-auto px-4 py-6">
        {/* Contenido principal */}
        <section className="bg-white p-4 rounded-lg shadow space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
            <h2 className="text-lg font-semibold mb-2 md:mb-0">
              Sesiones de Usuario ({totalCount} total)
            </h2>
          </div>
          <div>
            <DataTable<UserSession>
              data={filteredSessions}
              columns={columns}
              actions={actions}
              loading={loading}
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={limit}
              onPageChange={setPage}
              onPageSizeChange={size => { setLimit(size); setPage(1); }}
              pageSizeOptions={[20, 50, 100, 200]}
              emptyMessage="No hay sesiones registradas"
              tableId="sessions-table"
              tableClassName="min-w-full border text-sm bg-white rounded-lg shadow"
              headerClassName="bg-gray-200"
              showPagination={true}
            />
          </div>
        </section>
      </div>

      {/* Modal de ver detalles */}
      {showViewModal && viewData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white w-full max-w-4xl shadow-lg p-6 relative max-h-[98vh] overflow-y-auto rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Detalles de la Sesión</h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Información del Usuario */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Información del Usuario</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Usuario</label>
                  <input
                    type="text"
                    value={viewData.user.username}
                    readOnly
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                  <input
                    type="text"
                    value={viewData.user.nombreCompleto || "N/A"}
                    readOnly
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Rol</label>
                  <input
                    type="text"
                    value={viewData.user.role.name}
                    readOnly
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  />
                </div>
              </div>

              {/* Información de la Sesión */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Información de la Sesión</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Token de Sesión</label>
                  <input
                    type="text"
                    value={viewData.sessionToken}
                    readOnly
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Estado</label>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    viewData.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {viewData.isActive ? 'Activa' : 'Terminada'}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Inicio de Sesión</label>
                  <input
                    type="text"
                    value={formatDate(viewData.createdAt)}
                    readOnly
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Última Actividad</label>
                  <input
                    type="text"
                    value={formatDate(viewData.lastActivity || viewData.createdAt)}
                    readOnly
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Duración</label>
                  <input
                    type="text"
                    value={formatDuration(viewData.createdAt, viewData.endedAt)}
                    readOnly
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  />
                </div>
              </div>

              {/* Información del Dispositivo */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Información del Dispositivo</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sistema Operativo</label>
                  <input
                    type="text"
                    value={viewData.deviceOS || "N/A"}
                    readOnly
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Navegador</label>
                  <input
                    type="text"
                    value={viewData.browser || "N/A"}
                    readOnly
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tipo de Dispositivo</label>
                  <input
                    type="text"
                    value={viewData.deviceType || "N/A"}
                    readOnly
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dirección IP</label>
                  <input
                    type="text"
                    value={viewData.ipAddress || "N/A"}
                    readOnly
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  />
                </div>
              </div>

              {/* Información de Terminación */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Información de Terminación</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha de Expiración</label>
                  <input
                    type="text"
                    value={viewData.expiresAt ? formatDate(viewData.expiresAt) : "N/A"}
                    readOnly
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  />
                </div>
                {viewData.endedAt && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fecha de Terminación</label>
                    <input
                      type="text"
                      value={formatDate(viewData.endedAt)}
                      readOnly
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                    />
                  </div>
                )}
                {viewData.endReason && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Razón de Terminación</label>
                    <input
                      type="text"
                      value={viewData.endReason}
                      readOnly
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-4">
              <button
                onClick={() => setShowViewModal(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}