// app/health/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  FiDatabase,
  FiServer,
  FiCloud,
  FiLoader,
  FiArrowLeft,
  FiRefreshCw,
} from "react-icons/fi";
import { FaServer } from "react-icons/fa";

interface ServiceData {
  status: string;
  statusCode?: number;
  responseTime?: number;
  lastUpdate?: string;
  message?: string;
  description?: string;
}

interface HealthData {
  apis?: Record<string, ServiceData>;
  timestamp: string;
  database: ServiceData;
  authentication: ServiceData;
  cache: ServiceData;
  reportServices?: Record<string, ServiceData>;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

const steps = [
  { text: "Consultando base de datos", Icon: FiDatabase },
  { text: "Consultando servidor", Icon: FiServer },
  { text: "Consultando servicios en la nube", Icon: FiCloud },
  { text: "Procesando datos", Icon: FiLoader },
];

function LoadingAnimation() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % steps.length);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const { text, Icon } = steps[index];
  const isSpinner = Icon === FiLoader;

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-8 rounded-lg shadow-md">
      <div
        className={`text-6xl text-blue-500 ${
          isSpinner ? "animate-spin" : "animate-bounce"
        }`}
      >
        <Icon />
      </div>
      <p className="text-lg font-medium animate-pulse">{text}</p>
      <div className="flex space-x-2">
        {steps.map((_, i) => (
          <span
            key={i}
            className={`h-2 transition-all duration-300 rounded-full ${
              i === index ? "bg-green-500 w-6" : "bg-gray-300 w-2"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function StatusIndicator({ status }: { status: string }) {
  return status === "Activo" ? (
    <div className="relative flex items-center">
      <span className="absolute inline-flex h-3 w-3 rounded-full bg-green-400 animate-ping"></span>
      <span className="relative inline-flex h-3 w-3 rounded-full bg-green-600"></span>
    </div>
  ) : (
    <div className="relative flex items-center">
      <span className="inline-flex h-3 w-3 rounded-full bg-red-600"></span>
    </div>
  );
}

export default function HealthStatusPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowLoader(false), 3000);
    return () => clearTimeout(t);
  }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 1000);
  };

  const fetchHealthData = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/v1/health");
      if (res.status === 401) {
        setHealthData({
          database: {
            status: "Activo",
            description: "Servicio de base de datos funcionando correctamente.",
          },
          authentication: {
            status: "Inactivo",
            description: "No autenticado. Servicio de autenticación inalcanzable.",
          },
          cache: {
            status: "Activo",
            description: "Servicio de caché funcionando correctamente.",
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        const data: HealthData = await res.json();
        setHealthData(data);
      }
    } catch {
      showToast("Error al actualizar la información.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  useEffect(() => {
    if (!healthData) return;
    const msgs: string[] = [];
    if (healthData.database.status !== "Activo")
      msgs.push(`Base de Datos: ${healthData.database.description}`);
    if (healthData.authentication.status !== "Activo")
      msgs.push(`Autenticación: ${healthData.authentication.description}`);
    if (healthData.cache.status !== "Activo")
      msgs.push(`Caché: ${healthData.cache.description}`);
    healthData.apis &&
      Object.entries(healthData.apis).forEach(([k, svc]) => {
        if (svc.status !== "Activo") msgs.push(`${k}: ${svc.message}`);
      });
    healthData.reportServices &&
      Object.entries(healthData.reportServices).forEach(([k, svc]) => {
        if (svc.status !== "Activo") msgs.push(`${k}: ${svc.message}`);
      });
    if (msgs.length)
      showToast(msgs.join(" | "), "error");
    else
      showToast(
        `Información actualizada a las ${new Date().toLocaleTimeString("es-ES")}`,
        "success"
      );
  }, [healthData]);

  const computeGlobalStatus = (data: HealthData) => {
    const ok = [data.database, data.authentication, data.cache].every(
      (c) => c.status === "Activo"
    );
    return ok
      ? "Todos los Servicios Funcionando"
      : "Interrupción Parcial del Sistema";
  };

  if (showLoader) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingAnimation />
      </div>
    );
  }

  if (loading || !healthData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <FaServer className="animate-pulse text-gray-500" size={48} />
        <p className="mt-4 text-gray-600">
          Cargando información del sistema...
        </p>
      </div>
    );
  }

  const globalStatus = computeGlobalStatus(healthData);

  return (
    <div className="min-h-screen p-4 md:p-6">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded shadow text-sm font-medium ${
            toast.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={() => (window.location.href = "/")}
            className="bg-blue-600 hover:bg-blue-900 text-white p-2 rounded-full mr-3 transition transform hover:scale-105"
          >
            <FiArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Estado del Sistema</h1>
        </div>
        <div className="flex items-center mt-4 md:mt-0">
          <button
            onClick={fetchHealthData}
            className="mr-4 flex items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            {refreshing ? (
              <FiLoader className="animate-spin mr-1" size={20} />
            ) : (
              <FiRefreshCw className="mr-1" size={20} />
            )}
            Actualizar
          </button>
          <span
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              globalStatus === "Todos los Servicios Funcionando"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {globalStatus}
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Última actualización:{" "}
        {new Date(healthData.timestamp).toLocaleString("es-ES")}
      </p>

      <div className="rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Componentes Principales
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["database", "authentication", "cache"] as const).map((key) => {
            const svc = healthData[key];
            return (
              <div key={key} className="p-4 border rounded-lg flex flex-col">
                <span className="text-gray-600 font-medium capitalize">
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </span>
                <div className="mt-2 flex items-center space-x-2">
                  <StatusIndicator status={svc.status} />
                  <span
                    className={
                      svc.status === "Activo" ? "text-green-700" : "text-red-700"
                    }
                  >
                    {svc.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {svc.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
