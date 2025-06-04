// /app/proceso/[…]/RecepcionEditor.tsx
"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiTrash2, FiEdit } from "react-icons/fi";
import Loader from "../../../../components/Loader";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import dynamic from "next/dynamic";

// Importar react-select de forma dinámica
const Select = dynamic(() => import("react-select"), { ssr: false });

// =====================================================
// SISTEMA DE ESTADOS PARA RECEPCIONES
// =====================================================

// Estados de recepción
export enum EstadoRecepcion {
  CREADA = "CREADA",
  EN_PROCESO = "EN_PROCESO", 
  COMPLETADA = "COMPLETADA",
  ELIMINADA = "ELIMINADA"
}

// Configuración de estados
const ESTADOS_CONFIG = {
  [EstadoRecepcion.CREADA]: {
    label: "Creada",
    color: "blue",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    description: "Recepción creada, lista para operaciones"
  },
  [EstadoRecepcion.EN_PROCESO]: {
    label: "En Proceso",
    color: "yellow",
    bgColor: "bg-yellow-100", 
    textColor: "text-yellow-800",
    description: "Operaciones en curso"
  },
  [EstadoRecepcion.COMPLETADA]: {
    label: "Completada",
    color: "green",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    description: "Recepción completada exitosamente"
  },
  [EstadoRecepcion.ELIMINADA]: {
    label: "Eliminada",
    color: "red",
    bgColor: "bg-red-100",
    textColor: "text-red-800",
    description: "Recepción eliminada"
  }
} as const;

// Componente para mostrar estado
interface EstadoBadgeProps {
  estado: EstadoRecepcion;
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
function determineStateFromContent(recepcion: {
  bitacoras: any[];
  eliminado?: boolean;
  estado?: EstadoRecepcion;
}): EstadoRecepcion {
  if (recepcion.eliminado) return EstadoRecepcion.ELIMINADA;
  // Si ya está completada, mantener ese estado
  if (recepcion.estado === EstadoRecepcion.COMPLETADA) return EstadoRecepcion.COMPLETADA;
  if (recepcion.bitacoras.length > 0) return EstadoRecepcion.EN_PROCESO;
  return EstadoRecepcion.CREADA;
}

// --- Tipos ---
interface OptionType {
  value: string | number;
  label: string;
}

/** Estructura para una operación en la tabla */
type Operacion = {
  ticket: string;
  transporte: string;
  placa: string;
  motorista: string;
  horaInicio: string;
  horaFinal: string;
  tiempoTotal: string;
  observaciones: string;
};

/** Datos de la Recepción */
type RecepcionData = {
  id?: number;
  fechaInicio: string;
  fecha: string;
  fechaCierre: string;
  producto: string;
  nombreBarco: string;
  chequero: string;
  turnoInicio: string;
  turnoFin: string;
  puntoCarga: string;
  puntoDescarga: string;
  bitacoras: Operacion[];
  estado: EstadoRecepcion;
  eliminado?: boolean;
};

/** Datos del Barco de Recepción (snapshot) */
type BarcoRecepcionData = {
  id?: number;
  vaporBarco: string;
  productos: string[];
  puntosDescarga: string[];
  transportes: Array<{
    id: number;
    nombre: string;
    motoristas: { placa: string; nombre: string }[];
  }>;
};

/** Formulario completo */
export type FormDataType = {
  barcoRecepcion: BarcoRecepcionData;
  recepcion: RecepcionData;
};

// Helpers para duración
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length >= 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

function calcularDuracion(inicio: string, final: string): string {
  const startMinutes = parseTimeToMinutes(inicio);
  const endMinutes = parseTimeToMinutes(final);
  if (startMinutes && endMinutes >= startMinutes) {
    const diffMinutes = endMinutes - startMinutes;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  }
  return "00:00";
}

function actualizarDuracion(op: Operacion): Operacion {
  return { ...op, tiempoTotal: calcularDuracion(op.horaInicio, op.horaFinal) };
}

export default function RecepcionEditor() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormDataType>({
    barcoRecepcion: {
      vaporBarco: "",
      productos: [],
      puntosDescarga: [],
      transportes: [],
    },
    recepcion: {
      id: undefined,
      fechaInicio: "",
      fecha: "",
      fechaCierre: "",
      producto: "",
      nombreBarco: "",
      chequero: "",
      turnoInicio: "",
      turnoFin: "",
      puntoCarga: "",
      puntoDescarga: "",
      bitacoras: [],
      estado: EstadoRecepcion.CREADA,
      eliminado: false,
    },
  });
  const [loading, setLoading] = useState(true);
  const [newOperacion, setNewOperacion] = useState<Operacion>({
    ticket: "",
    transporte: "",
    placa: "",
    motorista: "",
    horaInicio: "",
    horaFinal: "",
    tiempoTotal: "",
    observaciones: "",
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Estados para opciones
  const [optsProductos, setOptsProductos] = useState<OptionType[]>([]);
  const [optsPuntos, setOptsPuntos] = useState<OptionType[]>([]);
  const [optsTransportes, setOptsTransportes] = useState<OptionType[]>([]);
  const [optsPlacas, setOptsPlacas] = useState<OptionType[]>([]);
  const [currentMotoristas, setCurrentMotoristas] = useState<Array<{ nombre: string; placa: string }>>([]);

  // Verificar si la recepción es editable
  const isEditable = formData.recepcion.estado !== EstadoRecepcion.COMPLETADA && 
                     formData.recepcion.estado !== EstadoRecepcion.ELIMINADA;

  // Carga inicial: cargar la recepción específica
  useEffect(() => {
    const id = localStorage.getItem("recepcionId");
    if (!id) {
      router.push("/proceso/consultar/recepcion");
      return;
    }
    fetch(`/api/v1/recepcion/${id}`)
      .then(r => r.json())
      .then(res => {
        if (!res.data) {
          throw new Error("Recepción no encontrada");
        }
        
        const rd = res.data;
        const br = rd.barcoRecepcion;
        
        // Asegurar que el estado existe y es válido
        let estado = rd.estado;
        if (!estado || !Object.values(EstadoRecepcion).includes(estado)) {
          estado = EstadoRecepcion.CREADA;
        }
        
        setFormData({
          barcoRecepcion: {
            id: br?.id,
            vaporBarco: br?.vaporBarco || "",
            productos: br?.productos ? JSON.parse(br.productos) : [],
            puntosDescarga: br?.puntosDescarga ? JSON.parse(br.puntosDescarga) : [],
            transportes: br?.transportes ? JSON.parse(br.transportes) : [],
          },
          recepcion: {
            id: rd.id,
            fechaInicio: rd.fechaInicio,
            fecha: rd.fecha,
            fechaCierre: rd.fechaCierre || "",
            producto: rd.producto,
            nombreBarco: rd.nombreBarco,
            chequero: rd.chequero,
            turnoInicio: rd.turnoInicio,
            turnoFin: rd.turnoFin,
            puntoCarga: rd.puntoCarga,
            puntoDescarga: rd.puntoDescarga,
            bitacoras: Array.isArray(rd.bitacoras) ? rd.bitacoras : [],
            estado: estado,
            eliminado: rd.eliminado || false,
          },
        });

        // Configurar opciones si hay barco
        if (br) {
          const productos = br.productos ? JSON.parse(br.productos) : [];
          const puntosDescarga = br.puntosDescarga ? JSON.parse(br.puntosDescarga) : [];
          const transportes = br.transportes ? JSON.parse(br.transportes) : [];

          setOptsProductos(productos.map((p: string) => ({ value: p, label: p })));
          setOptsPuntos([...puntosDescarga, "NO APLICA"].map((p: string) => ({ value: p, label: p })));
          setOptsTransportes(transportes.map((t: any) => ({ value: t.id, label: t.nombre })));
        }
      })
      .catch(() => {
        Swal.fire("Error", "No se pudo cargar la recepción", "error").then(() =>
          router.push("/proceso/consultar/recepcion")
        );
      })
      .finally(() => setLoading(false));
  }, [router]);

  // Helpers para actualizar estado
  const updateBarcoRecepcion = (b: Partial<BarcoRecepcionData>) =>
    setFormData(f => ({ ...f, barcoRecepcion: { ...f.barcoRecepcion, ...b } }));
  
  const updateRecepcion = (r: Partial<RecepcionData>) => {
    setFormData(f => {
      const updatedRecepcion = { ...f.recepcion, ...r };
      // Determinar estado automáticamente al actualizar
      const nuevoEstado = determineStateFromContent(updatedRecepcion);
      return { 
        ...f, 
        recepcion: { 
          ...updatedRecepcion, 
          estado: nuevoEstado 
        } 
      };
    });
  };

  const handleOperacionChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const upd = { ...newOperacion, [name]: value } as Operacion;
    setNewOperacion(actualizarDuracion(upd));
  };

  // Cambio de transporte en operación
  const onOpTransporteChange = (opt: OptionType | null) => {
    if (!opt) {
      setNewOperacion(o => ({ ...o, transporte: "", placa: "", motorista: "" }));
      setOptsPlacas([]);
      setCurrentMotoristas([]);
      return;
    }
    const tId = Number(opt.value);
    const trans = formData.barcoRecepcion.transportes.find((t) => t.id === tId);
    if (trans) {
      setCurrentMotoristas(trans.motoristas);
      setOptsPlacas(trans.motoristas.map((m) => ({ value: m.placa, label: m.placa })));
      setNewOperacion(o => ({ ...o, transporte: trans.nombre, placa: "", motorista: "" }));
    }
  };

  // Cambio de placa en operación
  const onOpPlacaChange = (opt: OptionType | null) => {
    const placa = (opt?.value as string) || "";
    const m = currentMotoristas.find((x) => x.placa === placa);
    setNewOperacion(o => ({ ...o, placa, motorista: m?.nombre || "" }));
  };

  const addOrUpdateOperacion = () => {
    if (!isEditable) {
      Swal.fire("Error", "No se puede editar una recepción completada o eliminada", "error");
      return;
    }
    
    if (!newOperacion.ticket || !newOperacion.transporte || !newOperacion.placa || 
        !newOperacion.horaInicio || !newOperacion.horaFinal) {
      Swal.fire("Error", "Complete todos los campos requeridos", "error");
      return;
    }
    
    if (parseTimeToMinutes(newOperacion.horaFinal) < parseTimeToMinutes(newOperacion.horaInicio)) {
      Swal.fire("Error", "La hora final no puede ser menor que la hora de inicio", "error");
      return;
    }
    
    const ops = [...formData.recepcion.bitacoras];
    if (editingIndex !== null) {
      ops[editingIndex] = newOperacion;
      setEditingIndex(null);
      Swal.fire({ icon: "success", title: "Operación actualizada", showConfirmButton: false, timer: 1200 });
    } else {
      ops.push(newOperacion);
    }
    updateRecepcion({ bitacoras: ops });
    setNewOperacion({
      ticket: "",
      transporte: "",
      placa: "",
      motorista: "",
      horaInicio: "",
      horaFinal: "",
      tiempoTotal: "",
      observaciones: "",
    });
  };

  const handleEditOp = (i: number) => {
    if (!isEditable) {
      Swal.fire("Error", "No se puede editar una recepción completada o eliminada", "error");
      return;
    }
    setNewOperacion(formData.recepcion.bitacoras[i]);
    setEditingIndex(i);
  };
  
  const handleDeleteOp = (i: number) => {
    if (!isEditable) {
      Swal.fire("Error", "No se puede editar una recepción completada o eliminada", "error");
      return;
    }
    
    Swal.fire({
      title: "¿Eliminar operación?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3838b0",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "No, cancelar",
    }).then(r => {
      if (r.isConfirmed) {
        updateRecepcion({
          bitacoras: formData.recepcion.bitacoras.filter((_, idx) => idx !== i),
        });
        Swal.fire({
          icon: "success",
          title: "Operación eliminada",
          showConfirmButton: false,
          timer: 1200,
        });
      }
    });
  };

  // Guardar: envía TODOS los campos que el endpoint PUT espera
  const handleSave = async () => {
    if (!isEditable) {
      Swal.fire("Error", "No se puede guardar una recepción completada o eliminada", "error");
      return;
    }
    
    const res = await Swal.fire({
      icon: "question",
      title: "¿Desea guardar los cambios?",
      showCancelButton: true,
      confirmButtonText: "Sí, guardar",
      cancelButtonText: "No, cancelar",
    });
    if (!res.isConfirmed || !formData.recepcion.id) return;

    Swal.fire({ title: "Procesando...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    // Determinar estado final
    const estadoFinal = determineStateFromContent(formData.recepcion);

    // Construimos el body EXACTAMENTE con los campos del schema:
    const payload = {
      fechaInicio: formData.recepcion.fechaInicio,
      fecha: formData.recepcion.fecha,
      fechaCierre: formData.recepcion.fechaCierre || null,
      producto: formData.recepcion.producto,
      nombreBarco: formData.recepcion.nombreBarco,
      chequero: formData.recepcion.chequero,
      turnoInicio: formData.recepcion.turnoInicio || null,
      turnoFin: formData.recepcion.turnoFin || null,
      puntoCarga: formData.recepcion.puntoCarga || null,
      puntoDescarga: formData.recepcion.puntoDescarga || null,
      bitacoras: formData.recepcion.bitacoras,
      estado: estadoFinal,
      eliminado: formData.recepcion.eliminado || false,
    };

    fetch(`/api/v1/recepcion/${formData.recepcion.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(r => {
        Swal.close();
        if (r.ok) {
          localStorage.removeItem("recepcionId");
          Swal.fire("Listo", "Recepción actualizada correctamente", "success").then(() =>
            router.push("/proceso/consultar/recepcion")
          );
        } else {
          Swal.fire("Error", "No se guardó la recepción", "error");
        }
      })
      .catch(() => Swal.fire("Error", "No se guardó la recepción", "error"));
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
        localStorage.removeItem("recepcionId");
        router.push("/proceso/consultar/recepcion");
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
          Recepción y Traslado de Cereales - Edición
        </h1>
      </header>

      {/* Estado de la recepción */}
      <section className="max-w-5xl mx-auto bg-white shadow-md mt-4 p-4 mb-4 rounded-md">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Estado de la Recepción</h2>
            <EstadoBadge estado={formData.recepcion.estado} showDescription={true} />
          </div>
          <div className="text-right text-sm text-gray-600">
            <div>ID: {formData.recepcion.id}</div>
            {formData.recepcion.fechaCierre && (
              <div>Cerrada: {new Date(formData.recepcion.fechaCierre).toLocaleString('es-ES')}</div>
            )}
          </div>
        </div>
        {!isEditable && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-yellow-800 text-sm font-medium">
              ⚠️ Esta recepción no se puede editar porque está {formData.recepcion.estado.toLowerCase()}
            </p>
          </div>
        )}
      </section>

      {/* Información del Barco (solo lectura) */}
      <section className="max-w-5xl mx-auto bg-white shadow-md mt-4 p-4 mb-4 rounded-md">
        <h2 className="text-xl font-bold mb-4">Información del Barco</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
          <div>
            <label className="block text-sm font-semibold mb-1">VAPOR / BARCO</label>
            <input
              type="text"
              value={formData.barcoRecepcion.vaporBarco}
              className="w-full h-9 border border-gray-300 rounded-md px-2 py-1"
              readOnly
            />
          </div>
        </div>
      </section>

      {/* Datos de la Recepción */}
      <section className="max-w-5xl mx-auto bg-white shadow-md mt-4 p-4 mb-4 rounded-md">
        <h2 className="text-xl font-bold mb-4">Recepción</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">FECHA</label>
            <input
              type="date"
              value={formData.recepcion.fecha}
              onChange={e => updateRecepcion({ fecha: e.target.value })}
              className="w-full h-9 border border-gray-300 rounded-md px-2 py-1"
              disabled={!isEditable}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">FECHA CIERRE</label>
            <input
              type="date"
              value={formData.recepcion.fechaCierre}
              onChange={e => updateRecepcion({ fechaCierre: e.target.value })}
              className="w-full h-9 border border-gray-300 rounded-md px-2 py-1"
              disabled={!isEditable}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">
              Chequero
            </label>
            <input
              type="text"
              value={formData.recepcion.chequero}
              onChange={e => updateRecepcion({ chequero: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-2 py-1"
              disabled={!isEditable}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Producto</label>
            <Select
              options={optsProductos}
              value={optsProductos.find(o => o.value === formData.recepcion.producto) || null}
              onChange={opt => updateRecepcion({ producto: (opt as OptionType)?.value as string || "" })}
              isDisabled={!isEditable}
              placeholder="Selecciona producto..."
              classNamePrefix="react-select"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Inicio Turno</label>
            <input
              type="time"
              value={formData.recepcion.turnoInicio}
              onChange={e => updateRecepcion({ turnoInicio: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-2 py-1"
              disabled={!isEditable}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Termina Turno</label>
            <input
              type="time"
              value={formData.recepcion.turnoFin}
              onChange={e => updateRecepcion({ turnoFin: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-2 py-1"
              disabled={!isEditable}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Punto de Carga</label>
            <input
              type="text"
              value={formData.recepcion.puntoCarga}
              onChange={e => updateRecepcion({ puntoCarga: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-2 py-1"
              disabled={!isEditable}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Punto de Descarga</label>
            <Select
              options={optsPuntos}
              value={optsPuntos.find(o => o.value === formData.recepcion.puntoDescarga) || null}
              onChange={opt => updateRecepcion({ puntoDescarga: (opt as OptionType)?.value as string || "" })}
              isDisabled={!isEditable}
              placeholder="Selecciona punto..."
              classNamePrefix="react-select"
            />
          </div>
        </div>

        {/* Nueva Operación - Solo mostrar si es editable */}
        {isEditable && (
          <section className="mb-6 border rounded-md p-4">
            <h2 className="text-lg font-semibold mb-2">Operaciones</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold">TICKET</label>
                <input
                  type="text"
                  name="ticket"
                  value={newOperacion.ticket}
                  onChange={handleOperacionChange}
                  className="w-full h-10 border rounded-sm px-2"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold">TRANSPORTE</label>
                <Select
                  options={optsTransportes}
                  value={optsTransportes.find(o => o.label === newOperacion.transporte) || null}
                  onChange={onOpTransporteChange}
                  classNamePrefix="react-select"
                  placeholder="Selecciona transporte..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold">PLACA</label>
                <Select
                  options={optsPlacas}
                  value={optsPlacas.find(o => o.value === newOperacion.placa) || null}
                  onChange={onOpPlacaChange}
                  isDisabled={!optsPlacas.length}
                  classNamePrefix="react-select"
                  placeholder={optsPlacas.length ? "Selecciona placa..." : "Seleccione transporte primero"}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold">MOTORISTA</label>
                <input
                  type="text"
                  name="motorista"
                  value={newOperacion.motorista}
                  readOnly
                  className="w-full h-10 border rounded-sm px-2 bg-gray-50"
                  placeholder="Se carga al elegir placa"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold">Hora Inicio</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    name="horaInicio"
                    value={newOperacion.horaInicio}
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
                      setNewOperacion(p => actualizarDuracion({ ...p, horaInicio: hora }));
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md whitespace-nowrap"
                  >
                    Ahora
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold">Hora Final</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    name="horaFinal"
                    value={newOperacion.horaFinal}
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
                      setNewOperacion(p => actualizarDuracion({ ...p, horaFinal: hora }));
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md whitespace-nowrap"
                  >
                    Ahora
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold">Tiempo Total</label>
                <input
                  type="text"
                  name="tiempoTotal"
                  value={newOperacion.tiempoTotal}
                  readOnly
                  className="w-full h-10 border rounded-sm px-2 bg-gray-50"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold">Observaciones</label>
                <textarea
                  name="observaciones"
                  value={newOperacion.observaciones}
                  onChange={handleOperacionChange}
                  rows={2}
                  className="w-full border rounded p-2"
                  placeholder="Observaciones..."
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
                    setNewOperacion({
                      ticket: "",
                      transporte: "",
                      placa: "",
                      motorista: "",
                      horaInicio: "",
                      horaFinal: "",
                      tiempoTotal: "",
                      observaciones: "",
                    });
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
              {formData.recepcion.bitacoras.length} operaciones registradas
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-2 border whitespace-nowrap">TICKET</th>
                  <th className="p-2 border whitespace-nowrap">TRANSPORTE</th>
                  <th className="p-2 border whitespace-nowrap">PLACA</th>
                  <th className="p-2 border whitespace-nowrap">MOTORISTA</th>
                  <th className="p-2 border whitespace-nowrap">INICIO</th>
                  <th className="p-2 border whitespace-nowrap">FINAL</th>
                  <th className="p-2 border whitespace-nowrap">TIEMPO</th>
                  <th className="p-2 border whitespace-nowrap">OBSERVACIONES</th>
                  {isEditable && <th className="p-2 border whitespace-nowrap">ACCIÓN</th>}
                </tr>
              </thead>
              <tbody>
                {formData.recepcion.bitacoras.map((op, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2 border whitespace-nowrap">{op.ticket}</td>
                    <td className="p-2 border whitespace-nowrap">{op.transporte}</td>
                    <td className="p-2 border whitespace-nowrap">{op.placa}</td>
                    <td className="p-2 border whitespace-nowrap">{op.motorista}</td>
                    <td className="p-2 border whitespace-nowrap">{op.horaInicio}</td>
                    <td className="p-2 border whitespace-nowrap">{op.horaFinal}</td>
                    <td className="p-2 border whitespace-nowrap">{op.tiempoTotal}</td>
                    <td className="p-2 border whitespace-nowrap">{op.observaciones}</td>
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
                    <td colSpan={isEditable ? 9 : 8} className="p-4 text-center text-gray-500">
                      No hay operaciones registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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