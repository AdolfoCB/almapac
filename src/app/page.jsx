"use client";

import { useEffect, useState } from "react";
import { useSession, getSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import WeatherLoader from "@/components/WeatherLoader";
import Loader from "@/components/Loader";

import { FaPlay, FaArrowRight, FaUsers, FaUserCheck, FaCog, FaCloud, FaTimes } from "react-icons/fa";
import { PiBarnFill } from "react-icons/pi";
import { FiUsers, FiActivity, FiRefreshCw } from "react-icons/fi";
import { ImSpinner9 } from "react-icons/im";
import { HiOutlineUserCircle } from "react-icons/hi";
import { IoBoatSharp } from "react-icons/io5";
import { MdFrontLoader } from "react-icons/md";
import { HiClipboardDocumentList } from "react-icons/hi2";
import { FaUsersCog, FaUserShield } from "react-icons/fa";

const WeatherWidget = dynamic(
  () => import("@/components/WeatherWidget"),
  {
    ssr: false,
    loading: () => <WeatherLoader />,
  }
);

// Componente para las tarjetas de estadísticas con colores ALMAPAC - Optimizado para móviles
const StatsCard = ({ title, value, icon: Icon, color, trend, isLoading }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 hover:shadow-lg transition-all duration-200 h-full">
    {/* Layout móvil: título arriba, valor+icono abajo | Desktop: horizontal */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between h-full gap-2 sm:gap-3">
      
      {/* Título - arriba en móviles, izquierda en desktop */}
      <div className="order-1 sm:order-1 sm:flex-1 sm:min-w-0">
        <p className="text-xs sm:text-sm font-medium text-gray-600 mb-2 sm:mb-1 leading-relaxed">
          {title}
        </p>
        
        {/* En desktop, el valor va aquí */}
        <div className="hidden sm:flex items-center gap-2">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <ImSpinner9 className="animate-spin text-gray-400" size={16} />
              <span className="text-sm text-gray-400">Cargando...</span>
            </div>
          ) : (
            <>
              <p className="text-xl lg:text-2xl font-bold text-gray-900 leading-tight">
                {value || 0}
              </p>
              {trend && (
                <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                  trend.type === 'up' ? 'bg-green-100 text-green-800' : 
                  trend.type === 'down' ? 'bg-red-100 text-red-800' : 
                  'bg-gray-100 text-gray-800'
                }`}>
                  {trend.value}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Fila valor+icono - solo visible en móviles */}
      <div className="flex sm:hidden items-center justify-between">
        <div className="flex items-center gap-1">
          {isLoading ? (
            <div className="flex items-center gap-1">
              <ImSpinner9 className="animate-spin text-gray-400" size={14} />
              <span className="text-xs text-gray-400">Cargando...</span>
            </div>
          ) : (
            <>
              <p className="text-lg font-bold text-gray-900 leading-tight">
                {value || 0}
              </p>
              {trend && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                  trend.type === 'up' ? 'bg-green-100 text-green-800' : 
                  trend.type === 'down' ? 'bg-red-100 text-red-800' : 
                  'bg-gray-100 text-gray-800'
                }`}>
                  {trend.value}
                </span>
              )}
            </>
          )}
        </div>
        
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center shadow-sm flex-shrink-0`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      
      {/* Icono - solo visible en desktop */}
      <div className={`hidden sm:flex w-12 h-12 rounded-lg ${color} items-center justify-center shadow-sm flex-shrink-0`}>
        <Icon size={20} className="text-white lg:text-[24px]" />
      </div>
    </div>
  </div>
);

const ActionButton = ({ path, icon: Icon, label, bgColor, hoverColor, onNavigate }) => (
  <button
    onClick={() => onNavigate(path)}
    className={`
      group relative flex items-center justify-between
      px-5 py-3 rounded-xl text-white font-medium
      shadow-lg hover:shadow-xl
      transition-all duration-200
      hover:-translate-y-1
      active:translate-y-0 active:shadow-md
      ${bgColor} ${hoverColor}
      w-full
    `}
  >
    <div className="flex items-center space-x-3">
      <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm shadow-sm">
        <Icon size={18} />
      </div>
      <span className="text-base">{label}</span>
    </div>
    <FaArrowRight
      className="
        text-white/80 opacity-0 group-hover:opacity-100
        transform group-hover:translate-x-1
        transition-all duration-200
      "
    />
  </button>
);

// Define all possible actions and their allowed roles with ALMAPAC colors
const ACTIONS = [
  { path: "/proceso/iniciar", icon: FaPlay, label: "Iniciar Proceso", bgColor: "bg-gradient-to-r from-orange-600 to-red-600", hoverColor: "hover:from-orange-700 hover:to-red-700", roles: [1,2,3,5,6,7] },
  { path: "/proceso/consultar/equipo", icon: MdFrontLoader, label: "Historial de Equipos", bgColor: "bg-gradient-to-r from-blue-700 to-blue-800", hoverColor: "hover:from-blue-800 hover:to-blue-900", roles: [1,5,6] },
  { path: "/proceso/consultar/bitacora", icon: HiClipboardDocumentList, label: "Bitácoras de Barcos", bgColor: "bg-gradient-to-r from-indigo-600 to-indigo-700", hoverColor: "hover:from-indigo-700 hover:to-indigo-800", roles: [1,2,4,7] },
  { path: "/proceso/consultar/barco", icon: IoBoatSharp, label: "Barcos en Muelle", bgColor: "bg-gradient-to-r from-orange-700 to-red-700", hoverColor: "hover:from-orange-800 hover:to-red-800", roles: [1] },
  { path: "/proceso/consultar/recepcion/barcos", icon: IoBoatSharp, label: "Barcos en Recepción", bgColor: "bg-gradient-to-r from-blue-800 to-blue-900", hoverColor: "hover:from-blue-900 hover:to-indigo-900", roles: [1] },
  { path: "/proceso/consultar/recepcion", icon: PiBarnFill, label: "Recepciones & Traslados", bgColor: "bg-gradient-to-r from-cyan-600 to-blue-600", hoverColor: "hover:from-cyan-700 hover:to-blue-700", roles: [1,3,4,7] },
  { path: "/usuarios", icon: FaUsersCog, label: "Usuarios & Roles", bgColor: "bg-gradient-to-r from-gray-600 to-gray-700", hoverColor: "hover:from-gray-700 hover:to-gray-800", roles: [1] },
  { path: "/sesiones", icon: FaUserShield, label: "Sesiones Usuarios", bgColor: "bg-gradient-to-r from-slate-600 to-slate-700", hoverColor: "hover:from-slate-700 hover:to-slate-800", roles: [1] },
];

export default function Dashboard() {
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      router.replace("/login?authorize=SessionRequired");
    },
  });

  const [dashboardStats, setDashboardStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showWeatherWidget, setShowWeatherWidget] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && (!session || !session.user)) {
      signOut({ callbackUrl: "/login?authorize=SessionRequired" });
    }
  }, [status, session]);

  // Cargar estadísticas del dashboard para admin
  useEffect(() => {
    if (session?.user?.roleId === 1) {
      fetchDashboardStats();
    }
  }, [session]);

  const fetchDashboardStats = async () => {
    setStatsLoading(true);
    try {
      const response = await fetch('/api/v1/dashboard', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        setDashboardStats(result.data);
        setLastUpdated(new Date().toLocaleTimeString());
      } else {
        console.error('Error fetching dashboard stats:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  if (status === "loading") {
    return <Loader />;
  }

  const roleId = session.user.roleId;
  const isAdmin = roleId === 1;

  const handleNavigate = async (path) => {
    const fresh = await getSession();
    if (!fresh || !fresh.user) {
      signOut({ callbackUrl: "/login?authorize=SessionRequired" });
      return;
    }
    router.push(path);
  };

  // Filter actions by role
  const availableActions = ACTIONS.filter(action => action.roles.includes(roleId));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Header />

      <main className="pt-20 sm:pt-24 pb-4 sm:pb-6 lg:pb-8 w-full">
        <div className="max-w-[95%] sm:max-w-7xl 2xl:max-w-[90%] mx-auto px-3 sm:px-4 lg:px-6 space-y-6 sm:space-y-8">
          
          {/* Welcome Section sin borde colorido */}
          <section className="bg-white rounded-xl shadow-lg p-4 sm:p-6 relative overflow-hidden">
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
              <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                  <HiOutlineUserCircle size={24} className="text-white sm:text-[32px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-3">
                    <h2 className="text-lg sm:text-2xl font-bold text-gray-800 truncate">
                      ¡Bienvenido, {session.user.username}!
                    </h2>
                  </div>
                  <p className="text-sm sm:text-base text-gray-600 mt-1">Control de Tiempos - ALMAPAC</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
                {/* Botón para mostrar/ocultar widget del clima */}
                <button
                  onClick={() => setShowWeatherWidget(!showWeatherWidget)}
                  className="flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg flex-1 sm:flex-none"
                >
                  <FaCloud size={14} className="sm:text-base" />
                  <span className="text-sm sm:text-base">Clima</span>
                </button>
                
                {isAdmin && (
                  <button
                    onClick={fetchDashboardStats}
                    className="flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-md hover:shadow-lg flex-1 sm:flex-none"
                    disabled={statsLoading}
                  >
                    <FiRefreshCw className={`${statsLoading ? 'animate-spin' : ''}`} size={14} />
                    <span className="text-sm sm:text-base hidden sm:inline">Actualizar</span>
                    <span className="text-sm sm:text-base sm:hidden">Act.</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Admin Dashboard Stats con colores ALMAPAC */}
          {isAdmin && (
            <section className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Resumen del Sistema</h2>
                {lastUpdated && (
                  <p className="text-xs sm:text-sm text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm">
                    Última actualización: {lastUpdated}
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
                <StatsCard
                  title="Usuarios Registrados"
                  value={dashboardStats?.totalUsers}
                  icon={FaUsers}
                  color="bg-gradient-to-br from-blue-600 to-blue-700"
                  isLoading={statsLoading}
                />
                <StatsCard
                  title="Sesiones Activas"
                  value={dashboardStats?.activeSessions}
                  icon={FaUserCheck}
                  color="bg-gradient-to-br from-green-600 to-green-700"
                  isLoading={statsLoading}
                />
                <StatsCard
                  title="Procesos en Curso"
                  value={dashboardStats?.processesInProgress}
                  icon={FaCog}
                  color="bg-gradient-to-br from-orange-500 to-red-500"
                  isLoading={statsLoading}
                />
                <StatsCard
                  title="Barcos en Muelle"
                  value={dashboardStats?.barcosInMuelle}
                  icon={IoBoatSharp}
                  color="bg-gradient-to-br from-cyan-600 to-blue-600"
                  isLoading={statsLoading}
                />
                <StatsCard
                  title="Barcos en Recepción"
                  value={dashboardStats?.barcosInRecepcion}
                  icon={IoBoatSharp}
                  color="bg-gradient-to-br from-indigo-600 to-purple-600"
                  isLoading={statsLoading}
                />
              </div>
            </section>
          )}

          {/* Quick Actions con diseño mejorado */}
          <section className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Acciones Rápidas</h2>
              <div className="w-16 sm:w-20 h-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-6">
              {availableActions.map(({ path, icon, label, bgColor, hoverColor }) => (
                <ActionButton
                  key={path}
                  path={path}
                  icon={icon}
                  label={label}
                  bgColor={bgColor}
                  hoverColor={hoverColor}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Widget del clima desplegable con blur */}
      {showWeatherWidget && (
        <>
          {/* Overlay con blur */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-40 transition-all duration-300"
            onClick={() => setShowWeatherWidget(false)}
          />
          
          {/* Modal del widget */}
          <div className="fixed inset-2 sm:inset-4 md:inset-6 lg:inset-8 xl:inset-12 2xl:inset-16 z-50 flex items-center justify-center p-2 sm:p-0">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-6xl max-h-full overflow-hidden relative">
              {/* Botón cerrar */}
              <button
                onClick={() => setShowWeatherWidget(false)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 p-2 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-gray-50"
              >
                <FaTimes className="text-gray-600 hover:text-gray-800" size={14} />
              </button>
              
              {/* Header del modal */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 sm:p-4">
                <h3 className="text-lg sm:text-xl font-bold">Información Meteorológica</h3>
                <p className="text-blue-100 text-sm sm:text-base">Condiciones actuales y pronóstico - ALMAPAC</p>
              </div>
              
              {/* Widget del clima */}
              <div className="max-h-[calc(100vh-8rem)] sm:max-h-[calc(100vh-12rem)] overflow-y-auto">
                <WeatherWidget />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}