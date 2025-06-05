// components/SessionManager.jsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { FiMonitor, FiSmartphone, FiTablet, FiX } from "react-icons/fi";

export default function SessionManager() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/v1/sessions");
      const data = await res.json();
      setSessions(data);
    } catch (error) {
      console.error("Error al cargar sesiones:", error);
    } finally {
      setLoading(false);
    }
  };

  const revokeSession = async (sessionId) => {
    if (!confirm("¿Estás seguro de revocar esta sesión?")) return;
    
    try {
      const res = await fetch("/api/v1/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      
      if (res.ok) {
        fetchSessions();
      }
    } catch (error) {
      console.error("Error al revocar sesión:", error);
    }
  };

  const extendCurrentSession = async () => {
    try {
      const res = await fetch("/api/v1/sessions/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: 24 }),
      });
      
      if (res.ok) {
        alert("Sesión extendida por 24 horas más");
        fetchSessions();
      }
    } catch (error) {
      console.error("Error al extender sesión:", error);
    }
  };

  const getDeviceIcon = (type) => {
    switch (type) {
      case "mobile": return <FiSmartphone />;
      case "tablet": return <FiTablet />;
      default: return <FiMonitor />;
    }
  };

  if (loading) return <div>Cargando sesiones...</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Sesiones Activas</h2>
      
      <button
        onClick={extendCurrentSession}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Extender sesión actual
      </button>
      
      <div className="grid gap-4">
        {sessions.map((sess) => (
          <div
            key={sess.id}
            className={`border p-4 rounded-lg ${
              sess.isActive ? "border-green-500" : "border-gray-300"
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                {getDeviceIcon(sess.deviceType)}
                <div>
                  <p className="font-semibold">
                    {sess.browser} en {sess.deviceOS}
                  </p>
                  <p className="text-sm text-gray-600">
                    IP: {sess.ipAddress || "Desconocida"}
                  </p>
                  <p className="text-sm text-gray-600">
                    Última actividad: {new Date(sess.lastActivity).toLocaleString()}
                  </p>
                  {sess.sessionToken === session?.sessionId && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      Sesión actual
                    </span>
                  )}
                </div>
              </div>
              
              {sess.isActive && sess.sessionToken !== session?.sessionId && (
                <button
                  onClick={() => revokeSession(sess.id)}
                  className="text-red-500 hover:text-red-700"
                  title="Revocar sesión"
                >
                  <FiX size={20} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}