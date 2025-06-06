"use client";

import { useEffect, useState } from "react";
import { useSession, getSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Header from "../../../components/Header";
import { FiArrowLeft } from "react-icons/fi";
import { PiBarnFill } from "react-icons/pi";
import { MdFrontLoader } from "react-icons/md";
import { IoBoatSharp } from "react-icons/io5";
import Loader from "../../../components/Loader";

import Swal from "sweetalert2";

// 1) Definimos toda la configuración de procesos con colores ALMAPAC
const PROCESOS = [
  { 
    key: "barco", 
    name: "Barco en Muelle", 
    path: "/proceso/iniciar/barco", 
    icon: IoBoatSharp, 
    bgColor: "bg-gradient-to-r from-blue-700 to-blue-800", 
    hoverColor: "hover:from-blue-800 hover:to-blue-900", 
    roles: [1, 2, 7],
    description: "Bitácora de barcos en muelle"
  },
  { 
    key: "equipo", 
    name: "Inspección de Equipo", 
    path: "/proceso/iniciar/equipo", 
    icon: MdFrontLoader, 
    bgColor: "bg-gradient-to-r from-orange-600 to-red-600", 
    hoverColor: "hover:from-orange-700 hover:to-red-700", 
    roles: [1, 5, 6],
    description: "Inspección de equipos frontales"
  },
  { 
    key: "recepcion", 
    name: "Recepción/Traslado", 
    path: "/proceso/iniciar/recepcion", 
    icon: PiBarnFill, 
    bgColor: "bg-gradient-to-r from-cyan-600 to-blue-600", 
    hoverColor: "hover:from-cyan-700 hover:to-blue-700", 
    roles: [1, 3, 7],
    description: "Bitácoras de recepción o traslado"
  },
  { 
    key: "back", 
    name: "Regresar al Dashboard", 
    onClick: (router) => router.push("/"), 
    icon: FiArrowLeft, 
    bgColor: "bg-gradient-to-r from-gray-600 to-gray-700", 
    hoverColor: "hover:from-gray-700 hover:to-gray-800", 
    roles: [1,2,3,5,6,7],
    description: "Volver al panel principal"
  },
];

// 2) Componente genérico de botón de proceso con diseño ALMAPAC
const ProcessButton = ({
  icon: Icon,
  label,
  description,
  onClick,
  bgColor,
  hoverColor,
  small = false,
}) => (
  <button
    onClick={onClick}
    className={`
      group relative flex items-center
      w-full
      ${small ? "py-3 px-4 rounded-lg" : "py-4 px-6 rounded-xl"}
      ${bgColor} ${hoverColor}
      text-white font-semibold
      shadow-lg hover:shadow-xl
      transition-all duration-200
      hover:-translate-y-1
      active:translate-y-0 active:shadow-md
      border border-white/10
    `}
  >
    <div className={`
      ${small ? "w-8 h-8" : "w-12 h-12"} 
      flex items-center justify-center 
      rounded-full bg-white/20 backdrop-blur-sm 
      shadow-sm mr-4
    `}>
      <Icon size={small ? 18 : 24} />
    </div>
    <div className="flex-1 text-left">
      <div className={small ? "text-sm font-medium" : "text-base font-bold"}>
        {label}
      </div>
      {description && !small && (
        <div className="text-xs text-white/80 mt-1">
          {description}
        </div>
      )}
    </div>
    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <FiArrowLeft className="rotate-180" size={20} />
    </div>
  </button>
);

export default function Proceso() {
  const router = useRouter();
  const [openMolido, setOpenMolido] = useState(false);

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      signOut({ callbackUrl: "/login?authorize=SessionRequired" });
    },
  });

  // Hook para forzar logout si session.user falla
  useEffect(() => {
    if (status === "authenticated" && (!session || !session.user)) {
      signOut({ callbackUrl: "/login?authorize=SessionRequired" });
    }
  }, [status, session]);

  if (status === "loading") {
    return <Loader />;
  }

  const roleId = session.user.roleId;

  // Confirmación + revalidación de sesión antes de navegar con estilo ALMAPAC
  const handleProcessConfirm = (path, name) => {
    Swal.fire({
      title: "¿Está seguro?",
      text: `Está a punto de iniciar el proceso de ${name}. ¿Desea continuar?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ea580c", // Orange-600 ALMAPAC
      cancelButtonColor: "#dc2626", // Red-600
      confirmButtonText: "Sí, continuar",
      cancelButtonText: "Cancelar",
      background: '#ffffff',
      color: '#1f2937',
      iconColor: '#f59e0b',
      customClass: {
        popup: 'rounded-xl shadow-2xl',
        confirmButton: 'rounded-lg font-semibold px-6 py-2',
        cancelButton: 'rounded-lg font-semibold px-6 py-2'
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        const fresh = await getSession();
        if (!fresh || !fresh.user) {
          signOut({ callbackUrl: "/login?authorize=SessionRequired" });
        } else {
          router.push(path);
        }
      }
    });
  };

  // Filtrar procesos según rol
  const available = PROCESOS.filter((p) =>
    p.roles.includes(roleId)
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-blue-50">
      <Header />

      <main className="flex-grow flex items-center justify-center mt-12 px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Header de la página */}
          <div className="bg-white rounded-xl shadow-lg border border-orange-100 p-6 mb-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-red-500 to-blue-700"></div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-lg mx-auto mb-4">
                <PiBarnFill size={32} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                Iniciar Proceso
              </h1>
              <p className="text-gray-600">
                Seleccione el tipo de proceso que desea iniciar
              </p>
              <div className="mt-3 text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                Usuario: <span className="font-medium text-gray-700">{session.user.username}</span>
              </div>
            </div>
          </div>

          {/* Botones de procesos */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 space-y-4">
            {available.map((proc) =>
              proc.children ? (
                <div key={proc.key} className="relative">
                  <ProcessButton
                    icon={proc.icon}
                    label={proc.name}
                    description={proc.description}
                    onClick={() => setOpenMolido((o) => !o)}
                    bgColor={proc.bgColor}
                    hoverColor={proc.hoverColor}
                  />
                  {openMolido && (
                    <div className="mt-3 bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 shadow-lg rounded-xl p-4 space-y-3">
                      <div className="text-sm font-medium text-emerald-800 mb-2 text-center">
                        Opciones disponibles:
                      </div>
                      {proc.children.map((child) => (
                        <ProcessButton
                          key={child.key}
                          icon={child.icon}
                          label={child.name}
                          small
                          bgColor="bg-gradient-to-r from-emerald-500 to-green-500"
                          hoverColor="hover:from-emerald-600 hover:to-green-600"
                          onClick={() => {
                            setOpenMolido(false);
                            handleProcessConfirm(child.path, child.name);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <ProcessButton
                  key={proc.key}
                  icon={proc.icon}
                  label={proc.name}
                  description={proc.description}
                  bgColor={proc.bgColor}
                  hoverColor={proc.hoverColor}
                  onClick={
                    proc.key === "back"
                      ? () => proc.onClick(router)
                      : () => handleProcessConfirm(proc.path, proc.name)
                  }
                />
              )
            )}
          </div>

          {/* Footer con información adicional */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Control de Tiempos - ALMAPAC
            </p>
            <div className="w-12 h-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full mx-auto mt-2"></div>
          </div>
        </div>
      </main>
    </div>
  );
}