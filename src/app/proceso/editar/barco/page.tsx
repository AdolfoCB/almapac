// /app/proceso/[…]/BitacoraEditor.tsx  (o donde esté ubicado)
"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiTrash2, FiEdit } from "react-icons/fi";
import Loader from "@/components/Loader";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import dynamic from "next/dynamic";
import { EstadoBitacora } from "@/lib/estadoBitacora";

// Importar react-select y react-select/creatable de forma dinámica
const Select = dynamic(() => import("react-select"), { ssr: false });
const CreatableSelect = dynamic(
  () => import("react-select/creatable"),
  { ssr: false }
);

// =====================================================
// SISTEMA DE ESTADOS
// =====================================================

// Configuración de estados
const ESTADOS_CONFIG = {
  [EstadoBitacora.CREADA]: {
    label: "Creada",
    color: "blue",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    description: "Bitácora creada, lista para operaciones"
  },
  [EstadoBitacora.EN_PROCESO]: {
    label: "En Proceso",
    color: "yellow",
    bgColor: "bg-yellow-100", 
    textColor: "text-yellow-800",
    description: "Operaciones en curso"
  },
  [EstadoBitacora.COMPLETADA]: {
    label: "Completada",
    color: "green",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    description: "Bitácora completada exitosamente"
  },
  [EstadoBitacora.ELIMINADA]: {
    label: "Eliminada",
    color: "red",
    bgColor: "bg-red-100",
    textColor: "text-red-800",
    description: "Bitácora eliminada"
  }
} as const;

// Componente para mostrar estado
interface EstadoBadgeProps {
  estado: EstadoBitacora;
  showDescription?: boolean;
}

function EstadoBadge({ estado, showDescription = false }: EstadoBadgeProps) {
  const config = ESTADOS_CONFIG[estado];
  
  return (
    <div className="flex items-center gap-2">
      <span 
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}
        title={config.description}
      >
        <span className={`w-2 h-2 rounded-full bg-current mr-1.5`} />
        {config.label}
      </span>
      {showDescription && (
        <span className="text-sm text-gray-600">
          {config.description}
        </span>
      )}
    </div>
  );
}

// Determinar estado automáticamente
function determineStateFromContent(bitacora: {
  operaciones: any[];
  eliminado?: boolean;
  estado?: EstadoBitacora;
}): EstadoBitacora {
  if (bitacora.eliminado) return EstadoBitacora.ELIMINADA;
  // Si ya está completada, mantener ese estado
  if (bitacora.estado === EstadoBitacora.COMPLETADA) return EstadoBitacora.COMPLETADA;
  if (bitacora.operaciones.length > 0) return EstadoBitacora.EN_PROCESO;
  return EstadoBitacora.CREADA;
}

// --- Tipos ---
interface OptionType {
  value: string;
  label: string;
}

/** Estructura para una operación en la tabla */
type Operacion = {
  bodega: string;
  inicio: string;
  final: string;
  minutos: string;
  actividad: string;
};

/** Datos del Barco (snapshot) */
type BarcoData = {
  id?: number;
  bValue: string;               // muelle
  valorMuelle: string;          // vapor/barco
  arriboFecha: string;
  arriboHora: string;
  atraqueFecha: string;
  atraqueHora: string;
  recibidoFecha: string;
  recibidoHora: string;
  inicioOperacionesFecha: string;
  inicioOperacionesHora: string;
  finOperacionesFecha: string;
  finOperacionesHora: string;
  tipoCarga: string[];
  sistemaUtilizado: string[];
};

/** Datos de la Bitácora */
type BitacoraData = {
  id?: number;
  fechaInicio: string;
  fecha: string;
  fechaCierre: string;
  muellero: string;
  turnoInicio: string;
  turnoFin: string;
  operaciones: Operacion[];
  observaciones: string;
  estado: EstadoBitacora;       // Agregar campo estado
  eliminado?: boolean;          // Agregar campo eliminado
};

/** Formulario completo */
export type FormDataType = {
  barco: BarcoData;
  bitacora: BitacoraData;
};

// Opciones predefinidas
const bodegaOptions: OptionType[] = [
  { value: "B-1", label: "B-1" },
  { value: "B-2", label: "B-2" },
  { value: "B-3", label: "B-3" },
  { value: "B-4", label: "B-4" },
  { value: "B-5", label: "B-5" },
  { value: "", label: "N/A" },
];
const validOptions: OptionType[] = [
  { value: "Acumulando producto en bodegas", label: "Acumulando producto en bodegas" },
  { value: "Apertura de bodega", label: "Apertura de bodega" },
  { value: "Amenaza de lluvia", label: "Amenaza de lluvia" },
  { value: "Cambio de turno", label: "Cambio de turno" },
  { value: "Cierre de bodega", label: "Cierre de bodega" },
  { value: "Colocando almeja", label: "Colocando almeja" },
  { value: "Colocando equipo a bordo", label: "Colocando equipo a bordo" },
  { value: "Desperfecto de equipo", label: "Desperfecto de equipo" },
  { value: "Desperfecto de grúa de buque", label: "Desperfecto de grúa de buque" },
  { value: "Esperando instrucciones", label: "Esperando instrucciones" },
  { value: "Esperando instrucciones cepa", label: "Esperando instrucciones cepa" },
  { value: "Esperando material", label: "Esperando material" },
  { value: "Falla en bascula", label: "Falla en bascula" },
  { value: "Falla en el sistema", label: "Falla en el sistema" },
  { value: "Falta de camiones (camiones asignados por transporte insuficientes)", label: "Falta de camiones (camiones asignados por transporte insuficientes)" },
  { value: "Falta de tolveros", label: "Falta de tolveros" },
  { value: "Haciendo prueba de sistema", label: "Haciendo prueba de sistema" },
  { value: "Limpieza de tolva", label: "Limpieza de tolva" },
  { value: "Lluvia", label: "Lluvia" },
  { value: "Maniobras por marineros", label: "Maniobras por marineros" },
  { value: "Movilizando tolva", label: "Movilizando tolva" },
  { value: "Quitando almeja", label: "Quitando almeja" },
  { value: "Quitando alambres", label: "Quitando alambres" },
  { value: "Sacando equipo a bordo", label: "Sacando equipo a bordo" },
  { value: "Tiempo de comida", label: "Tiempo de comida" }
];

// Helpers para fecha y duración
function getFechaInicio() {
  const now = new Date();
  return now.toLocaleString("en-CA", {
    timeZone: "America/El_Salvador",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
function getFecha() {
  const now = new Date();
  return now.toLocaleDateString("en-CA", { timeZone: "America/El_Salvador" });
}
function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 3600 + parts[1] * 60;
  }
  return 0;
}
function calcularDuracion(inicio: string, final: string): string {
  const startSeconds = parseTimeToSeconds(inicio);
  const endSeconds = parseTimeToSeconds(final);
  if (startSeconds && endSeconds >= startSeconds) {
    const diffSeconds = endSeconds - startSeconds;
    const totalMinutes = Math.floor(diffSeconds / 60);
    return totalMinutes.toString();
  }
  return "0";
}
function actualizarDuracion(op: Operacion): Operacion {
  return { ...op, minutos: calcularDuracion(op.inicio, op.final) };
}

export default function BitacoraEditor() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormDataType>({
    barco: {
      bValue: "",
      valorMuelle: "",
      arriboFecha: "",
      arriboHora: "",
      atraqueFecha: "",
      atraqueHora: "",
      recibidoFecha: "",
      recibidoHora: "",
      inicioOperacionesFecha: "",
      inicioOperacionesHora: "",
      finOperacionesFecha: "",
      finOperacionesHora: "",
      tipoCarga: [],
      sistemaUtilizado: [],
    },
    bitacora: {
      id: undefined,
      fechaInicio: getFechaInicio(),
      fecha: getFecha(),
      fechaCierre: "",
      muellero: "",
      turnoInicio: "",
      turnoFin: "",
      operaciones: [],
      observaciones: "",
      estado: EstadoBitacora.CREADA,    // Estado inicial
      eliminado: false,                 // Campo eliminado
    },
  });
  const [loading, setLoading] = useState(true);
  const [actividadOptions, setActividadOptions] = useState<OptionType[]>(validOptions);
  const [newOperacion, setNewOperacion] = useState<Operacion>({
    bodega: "",
    inicio: "",
    final: "",
    minutos: "",
    actividad: "",
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Verificar si la bitácora es editable
  const isEditable = formData.bitacora.estado !== EstadoBitacora.COMPLETADA && 
                     formData.bitacora.estado !== EstadoBitacora.ELIMINADA;

  // Carga inicial: solo la bitácora (que incluye barcoSnapshot)
  useEffect(() => {
    const id = localStorage.getItem("bitacoraId");
    if (!id) {
      router.push("/proceso/consultar/bitacora");
      return;
    }
    fetch(`/api/v1/bitacoras/${id}`)
      .then(r => r.json())
      .then(res => {
        const bs = res.data.barco; // barco como relación
        const bd = res.data;
        
        // Asegurar que el estado existe y es válido
        let estado = bd.estado;
        if (!estado || !Object.values(EstadoBitacora).includes(estado)) {
          estado = EstadoBitacora.CREADA;
        }
        
        setFormData({
          barco: {
            id: bs.id,
            bValue: bs.muelle,
            valorMuelle: bs.vaporBarco,
            arriboFecha: bs.fechaArribo,
            arriboHora: bs.horaArribo,
            atraqueFecha: bs.fechaAtraque,
            atraqueHora: bs.horaAtraque,
            recibidoFecha: bs.fechaRecibido,
            recibidoHora: bs.horaRecibido,
            inicioOperacionesFecha: bs.fechaInicioOperaciones,
            inicioOperacionesHora: bs.horaInicioOperaciones,
            finOperacionesFecha: bs.fechaFinOperaciones,
            finOperacionesHora: bs.horaFinOperaciones,
            tipoCarga: JSON.parse(bs.tipoCarga),
            sistemaUtilizado: JSON.parse(bs.sistemaUtilizado),
          },
          bitacora: {
            id: bd.id,
            fechaInicio: bd.fechaInicio,
            fecha: bd.fecha,
            fechaCierre: bd.fechaCierre || "",
            muellero: bd.muellero,
            turnoInicio: bd.turnoInicio,
            turnoFin: bd.turnoFin,
            operaciones: bd.operaciones,
            observaciones: bd.observaciones,
            estado: estado,                         // Estado desde BD
            eliminado: bd.eliminado || false,       // Campo eliminado
          },
        });
      })
      .catch(() => {
        Swal.fire("Error", "No se pudo cargar la bitácora", "error").then(() =>
          router.push("/proceso/consultar/bitacora")
        );
      })
      .finally(() => setLoading(false));
  }, [router]);

  // Helpers para actualizar estado
  const updateBarco = (b: Partial<BarcoData>) =>
    setFormData(f => ({ ...f, barco: { ...f.barco, ...b } }));
  
  const updateBitacora = (b: Partial<BitacoraData>) => {
    setFormData(f => {
      const updatedBitacora = { ...f.bitacora, ...b };
      // Determinar estado automáticamente al actualizar
      const nuevoEstado = determineStateFromContent(updatedBitacora);
      return { 
        ...f, 
        bitacora: { 
          ...updatedBitacora, 
          estado: nuevoEstado 
        } 
      };
    });
  };

  // Persistir nueva operación en localStorage
  useEffect(() => {
    const st = localStorage.getItem("newOperacion");
    if (st) setNewOperacion(JSON.parse(st));
  }, []);
  useEffect(() => {
    localStorage.setItem("newOperacion", JSON.stringify(newOperacion));
  }, [newOperacion]);

  const handleOperacionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const upd = { ...newOperacion, [name]: value } as Operacion;
    setNewOperacion(actualizarDuracion(upd));
  };

  const addOrUpdateOperacion = () => {
    if (!isEditable) {
      Swal.fire("Error", "No se puede editar una bitácora completada o eliminada", "error");
      return;
    }
    
    if (!newOperacion.inicio || !newOperacion.final || !newOperacion.actividad) {
      Swal.fire("Error", "Complete todos los campos de operación", "error");
      return;
    }
    
    if (parseTimeToSeconds(newOperacion.final) < parseTimeToSeconds(newOperacion.inicio)) {
      Swal.fire("Error", "La hora final no puede ser menor que la hora de inicio", "error");
      return;
    }
    
    const ops = [...formData.bitacora.operaciones];
    if (editingIndex !== null) {
      ops[editingIndex] = newOperacion;
      setEditingIndex(null);
      Swal.fire({ icon: "success", title: "Actividad actualizada", showConfirmButton: false, timer: 1200 });
    } else {
      ops.push(newOperacion);
    }
    updateBitacora({ operaciones: ops });
    setNewOperacion({ bodega: "", inicio: "", final: "", minutos: "", actividad: "" });
    localStorage.removeItem("newOperacion");
  };

  const handleEditOp = (i: number) => {
    if (!isEditable) {
      Swal.fire("Error", "No se puede editar una bitácora completada o eliminada", "error");
      return;
    }
    setNewOperacion(formData.bitacora.operaciones[i]);
    setEditingIndex(i);
  };
  
  const handleDeleteOp = (i: number) => {
    if (!isEditable) {
      Swal.fire("Error", "No se puede editar una bitácora completada o eliminada", "error");
      return;
    }
    
    Swal.fire({
      title: "¿Eliminar actividad?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3838b0",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "No, cancelar",
    }).then(r => {
      if (r.isConfirmed) {
        updateBitacora({
          operaciones: formData.bitacora.operaciones.filter((_, idx) => idx !== i),
        });
        Swal.fire({
          icon: "success",
          title: "Actividad eliminada",
          showConfirmButton: false,
          timer: 1200,
        });
      }
    });
  };

  // Guardar: envía TODOS los campos que el endpoint PUT espera
  const handleSave = async () => {
    if (!isEditable) {
      Swal.fire("Error", "No se puede guardar una bitácora completada o eliminada", "error");
      return;
    }
    
    const res = await Swal.fire({
      icon: "question",
      title: "¿Desea guardar los cambios?",
      showCancelButton: true,
      confirmButtonText: "Sí, guardar",
      cancelButtonText: "No, cancelar",
    });
    if (!res.isConfirmed || !formData.bitacora.id) return;

    Swal.fire({ title: "Procesando...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    // Determinar estado final
    const estadoFinal = determineStateFromContent(formData.bitacora);

    // Construimos el body EXACTAMENTE con los campos del schema:
    const payload = {
      fechaInicio: formData.bitacora.fechaInicio,
      fecha: formData.bitacora.fecha,
      fechaCierre: formData.bitacora.fechaCierre || null,
      muellero: formData.bitacora.muellero,
      turnoInicio: formData.bitacora.turnoInicio || null,
      turnoFin: formData.bitacora.turnoFin || null,
      observaciones: formData.bitacora.observaciones || null,
      operaciones: formData.bitacora.operaciones,
      estado: estadoFinal,                                    // Incluir estado
      eliminado: formData.bitacora.eliminado || false,        // Incluir eliminado
    };

    fetch(`/api/v1/bitacoras/${formData.bitacora.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(r => {
        Swal.close();
        if (r.ok) {
          localStorage.removeItem("bitacoraId");
          Swal.fire("Listo", "Bitácora actualizada correctamente", "success").then(() =>
            router.push("/proceso/consultar/bitacora")
          );
        } else {
          Swal.fire("Error", "No se guardó la bitácora", "error");
        }
      })
      .catch(() => Swal.fire("Error", "No se guardó la bitácora", "error"));
  };

  const handleCancel = () => {
    Swal.fire({
      title: "¿Cancelar edición?",
      text: "Se perderán los cambios.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3838b0",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, salir",
      cancelButtonText: "No, cancelar",
    }).then(r => {
      if (r.isConfirmed) {
        localStorage.removeItem("bitacoraId");
        router.push("/proceso/consultar/bitacora");
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-[#003E9B] px-4 md:px-40 py-4 text-white flex flex-col items-center">
        <img src="/logo.png" alt="ALMAPAC" className="h-16 object-contain mb-2" />
        <h1 className="text-2xl font-bold uppercase text-center">
          Bitácora de Operaciones en Muelle y A Bordo
        </h1>
      </header>

      {/* Estado de la bitácora */}
      <section className="max-w-5xl mx-auto bg-white shadow-md mt-4 p-4 mb-4 rounded-md">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Estado de la Bitácora</h2>
            <EstadoBadge estado={formData.bitacora.estado} showDescription={true} />
          </div>
          <div className="text-right text-sm text-gray-600">
            <div>ID: {formData.bitacora.id}</div>
            {formData.bitacora.fechaCierre && (
              <div>Cerrada: {new Date(formData.bitacora.fechaCierre).toLocaleString('es-ES')}</div>
            )}
          </div>
        </div>
        {!isEditable && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-yellow-800 text-sm font-medium">
              ⚠️ Esta bitácora no se puede editar porque está {formData.bitacora.estado.toLowerCase()}
            </p>
          </div>
        )}
      </section>

      {/* Barco (snapshot editable solo si es editable) */}
      <section className="max-w-5xl mx-auto bg-white shadow-md mt-4 p-4 mb-4 rounded-md">
        <h2 className="text-xl font-bold mb-4">Barco</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
          <div>
            <label className="block text-sm font-semibold mb-1">MUELLE</label>
            <input
              type="text"
              value={formData.barco.bValue}
              onChange={e => updateBarco({ bValue: e.target.value })}
              className="w-full h-9 border border-gray-300 rounded-md px-2 py-1"
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">VAPOR / BARCO</label>
            <input
              type="text"
              value={formData.barco.valorMuelle}
              onChange={e => updateBarco({ valorMuelle: e.target.value })}
              className="w-full h-9 border border-gray-300 rounded-md px-2 py-1"
              readOnly
            />
          </div>
        </div>

        {/* Tipo de Carga & Sistema Utilizado */}
        <div className="sm:col-span-2 mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="border rounded-md">
            <div className="bg-gray-200 text-center py-2">
              <h3 className="text-sm font-semibold uppercase text-gray-700">TIPO DE CARGA</h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {["CEREALES","AZÚCAR CRUDA","CARBÓN","MELAZA","GRASA AMARILLA","YESO"].map(tipo => (
                <label key={tipo} className="inline-flex items-center space-x-1">
                  <input
                    type="checkbox"
                    checked={formData.barco.tipoCarga.includes(tipo)}
                    onChange={e => {
                      const arr = formData.barco.tipoCarga;
                      updateBarco({
                        tipoCarga: e.target.checked ? [...arr, tipo] : arr.filter(t => t !== tipo),
                      });
                    }}
                    className="h-4 w-4"
                    disabled={!isEditable}
                  />
                  <span className="text-xs">{tipo}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="border rounded-md">
            <div className="bg-gray-200 text-center py-2">
              <h3 className="text-sm font-semibold uppercase text-gray-700">SISTEMA UTILIZADO</h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {["UNIDAD DE CARGA","SUCCIONADORA","ALMEJA","CHINGUILLOS","EQUIPO BULHER","ALAMBRE"].map(s => (
                <label key={s} className="inline-flex items-center space-x-1">
                  <input
                    type="checkbox"
                    checked={formData.barco.sistemaUtilizado.includes(s)}
                    onChange={e => {
                      const arr = formData.barco.sistemaUtilizado;
                      updateBarco({
                        sistemaUtilizado: e.target.checked ? [...arr, s] : arr.filter(x => x !== s),
                      });
                    }}
                    className="h-4 w-4"
                    disabled={!isEditable}
                  />
                  <span className="text-xs">{s}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Fechas y horas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {[
            { label: "ARRIBO", fecha: "arriboFecha", hora: "arriboHora" },
            { label: "ATRAQUE", fecha: "atraqueFecha", hora: "atraqueHora" },
            { label: "RECIBIDO", fecha: "recibidoFecha", hora: "recibidoHora" },
            { label: "INICIO OPERACIONES", fecha: "inicioOperacionesFecha", hora: "inicioOperacionesHora" },
            { label: "FIN OPERACIONES", fecha: "finOperacionesFecha", hora: "finOperacionesHora" },
          ].map((sec) => (
            <div key={sec.label} className="border rounded-md p-4">
              <label className="block text-base font-semibold mb-2 uppercase">{sec.label}</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">Fecha</label>
                  <input
                    type="date"
                    value={(formData.barco as any)[sec.fecha]}
                    onChange={e => updateBarco({ [sec.fecha]: e.target.value })}
                    className="w-full border rounded-md px-2 py-1"
                    disabled={!isEditable}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Hora</label>
                  <input
                    type="time"
                    value={(formData.barco as any)[sec.hora]}
                    onChange={e => updateBarco({ [sec.hora]: e.target.value })}
                    className="w-full border rounded-md px-2 py-1"
                    disabled={!isEditable}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bitácora de Operaciones */}
      <section className="max-w-5xl mx-auto bg-white shadow-md mt-4 p-4 mb-4 rounded-md">
        <h2 className="text-xl font-bold mb-4">Bitácora</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">FECHA INICIO</label>
            <input
              type="text"
              value={formData.bitacora.fechaInicio}
              onChange={e => updateBitacora({ fecha: e.target.value })}
              className="w-full h-9 border border-gray-300 rounded-md px-2 py-1"
              disabled={!isEditable}
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">FECHA CIERRE</label>
            <input
              type="text"
              value={formData.bitacora.fechaCierre}
              onChange={e => updateBitacora({ fechaCierre: e.target.value })}
              className="w-full h-9 border border-gray-300 rounded-md px-2 py-1"
              disabled={!isEditable}
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">
              Muellero
            </label>
            <input
              type="text"
              value={formData.bitacora.muellero}
              onChange={e => updateBitacora({ muellero: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-2 py-1"
              disabled={!isEditable}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Inicio Turno</label>
            <input
              type="time"
              value={formData.bitacora.turnoInicio}
              onChange={e => updateBitacora({ turnoInicio: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-2 py-1"
              disabled={!isEditable}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Termina Turno</label>
            <input
              type="time"
              value={formData.bitacora.turnoFin}
              onChange={e => updateBitacora({ turnoFin: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-2 py-1"
              disabled={!isEditable}
            />
          </div>
        </div>

        {/* Nueva Operación - Solo mostrar si es editable */}
        {isEditable && (
          <section className="mb-6 border rounded-md p-4">
            <h2 className="text-lg font-semibold mb-2">Operaciones</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold">BODEGA</label>
                <Select
                  options={bodegaOptions}
                  value={bodegaOptions.find(o => o.value === newOperacion.bodega) || null}
                  onChange={opt => setNewOperacion(p => ({ ...p, bodega: (opt as OptionType).value }))}
                  classNamePrefix="react-select"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold">Inicio</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    name="inicio"
                    value={newOperacion.inicio}
                    onChange={handleOperacionChange}
                    className="w-full h-10 border rounded-sm px-2"
                    step="1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const hora = new Date().toLocaleTimeString("en-GB", {
                        hour12: false,
                        timeZone: "America/El_Salvador",
                      });
                      setNewOperacion(p => actualizarDuracion({ ...p, inicio: hora }));
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md whitespace-nowrap"
                  >
                    Ahora
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold">Final</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    name="final"
                    value={newOperacion.final}
                    onChange={handleOperacionChange}
                    className="w-full h-10 border rounded-sm px-2"
                    step="1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const hora = new Date().toLocaleTimeString("en-GB", {
                        hour12: false,
                        timeZone: "America/El_Salvador",
                      });
                      setNewOperacion(p => actualizarDuracion({ ...p, final: hora }));
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md whitespace-nowrap"
                  >
                    Ahora
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold">Minutos</label>
                <input
                  type="text"
                  name="minutos"
                  value={newOperacion.minutos}
                  readOnly
                  className="w-full h-10 border rounded-sm px-2 bg-gray-50"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold">Actividad</label>
                <CreatableSelect
                  options={actividadOptions}
                  value={actividadOptions.find(o => o.value === newOperacion.actividad) || null}
                  onChange={opt => setNewOperacion(p => ({ ...p, actividad: (opt as OptionType).value }))}
                  onCreateOption={inputValue => {
                    const newOpt = { value: inputValue, label: inputValue };
                    setActividadOptions(prev => [...prev, newOpt]);
                    setNewOperacion(p => ({ ...p, actividad: inputValue }));
                  }}
                  classNamePrefix="react-select"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                type="button"
                onClick={addOrUpdateOperacion}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                {editingIndex !== null ? <FiEdit size={20} /> : <FiPlus size={20} />}
                {editingIndex !== null ? "Actualizar" : "Agregar"}
              </button>
              {editingIndex !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setNewOperacion({ bodega: "", inicio: "", final: "", minutos: "", actividad: "" });
                    setEditingIndex(null);
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
                >
                  Cancelar
                </button>
              )}
            </div>
          </section>
        )}

        {/* Tabla de Operaciones */}
        <section className="mb-6 border rounded-md p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold uppercase">Bitácora de Operaciones</h2>
            <div className="text-sm text-gray-600">
              {formData.bitacora.operaciones.length} operaciones registradas
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-2 border whitespace-nowrap">BODEGA</th>
                  <th className="p-2 border whitespace-nowrap">INICIO</th>
                  <th className="p-2 border whitespace-nowrap">FINAL</th>
                  <th className="p-2 border whitespace-nowrap">MINUTOS</th>
                  <th className="p-2 border whitespace-nowrap">ACTIVIDAD</th>
                  {isEditable && <th className="p-2 border whitespace-nowrap">ACCIÓN</th>}
                </tr>
              </thead>
              <tbody>
                {formData.bitacora.operaciones.map((op, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2 border whitespace-nowrap">{op.bodega}</td>
                    <td className="p-2 border whitespace-nowrap">{op.inicio}</td>
                    <td className="p-2 border whitespace-nowrap">{op.final}</td>
                    <td className="p-2 border whitespace-nowrap">{op.minutos}</td>
                    <td className="p-2 border whitespace-nowrap">{op.actividad}</td>
                    {isEditable && (
                      <td className="p-2 border text-center flex items-center justify-center gap-2 whitespace-nowrap">
                        <button onClick={() => handleEditOp(idx)} title="Actualizar" className="text-green-500 hover:text-green-700">
                          <FiEdit size={23} />
                        </button>
                        <button onClick={() => handleDeleteOp(idx)} title="Eliminar" className="text-red-500 hover:text-red-700">
                          <FiTrash2 size={23} />
                        </button>
                      </td>
                    )}
                  </tr>
                )) || (
                  <tr>
                    <td colSpan={isEditable ? 6 : 5} className="p-4 text-center text-gray-500">
                      No hay operaciones registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Observaciones */}
        <section className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Observaciones</label>
          <textarea
            rows={3}
            value={formData.bitacora.observaciones}
            onChange={e => updateBitacora({ observaciones: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-2 py-1 resize-y"
            disabled={!isEditable}
            placeholder={!isEditable ? "Esta bitácora no se puede editar" : "Escriba sus observaciones aquí..."}
          />
        </section>

        {/* Botones */}
        <div className="px-4 pb-4 flex justify-between">
          <button
            onClick={handleCancel}
            className="bg-white border border-blue-600 text-blue-600 px-4 py-2 rounded-md hover:bg-blue-50"
          >
            {isEditable ? "Cancelar" : "Volver"}
          </button>
          {isEditable && (
            <button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Guardar
            </button>
          )}
        </div>
      </section>
    </div>
  );
}