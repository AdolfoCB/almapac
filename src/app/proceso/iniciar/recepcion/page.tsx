"use client";

// =====================================================
// IMPORTS Y DEPENDENCIAS
// =====================================================
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { FiTrash2, FiEdit, FiPlus } from "react-icons/fi";
import { showErrorAlert } from "@/lib/errorAlert";
import { getFechaInicio, getFecha, nowTime, diffTime } from '@/utils/dateTimeUtils';
import { 
  showError, 
  showWarning, 
  showModal, 
  showLoading, 
  closeAlert, 
  showSuccessToast, 
  showSuccess 
} from '@/utils/alertUtils';
import Loader from "@/components/Loader";
import PageHeader from '@/components/PageHeader';
import PageActions from '@/components/PageActions';

const Select = dynamic(() => import("react-select"), { ssr: false });

// =====================================================
// TIPOS E INTERFACES (Single Responsibility)
// =====================================================
interface OptionType {
  value: string | number;
  label: string;
}

interface Operacion {
  ticket: string;
  transporte: string;
  placa: string;
  motorista: string;
  horaInicio: string;
  horaFinal: string;
  tiempoTotal: string;
  observaciones: string;
}

interface BitacoraData {
  id: number | null;
  nombreBarco: string;
  producto: string;
  fechaInicio: string;
  fecha: string;
  fechaCierre?: string;
  chequero: string;
  turnoInicio: string;
  turnoFin: string;
  puntoCarga: string;
  puntoDescarga: string;
  bitacoras: Operacion[];
  estado: EstadoRecepcion; // Ensure this is the full enum type
  isCreated?: boolean;
  eliminado?: boolean;
}

interface BarcoDetail {
  id: number;
  vaporBarco: string;
  productos: string[];
  puntosDescarga: string[];
  transportes: {
    id: number;
    nombre: string;
    motoristas: { placa: string; nombre: string }[];
  }[];
}

// =====================================================
// SISTEMA DE ESTADOS (Open/Closed Principle)
// =====================================================
enum EstadoRecepcion {
  CREADA = "CREADA",
  EN_PROCESO = "EN PROCESO", 
  COMPLETADA = "COMPLETADA",
  ELIMINADA = "ELIMINADA"
}

interface EstadoConfig {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  description: string;
}

// Abstract factory para estados (Open/Closed)
abstract class EstadoFactory {
  abstract createConfig(): EstadoConfig;
}

class EstadoCreadaFactory extends EstadoFactory {
  createConfig(): EstadoConfig {
    return {
      label: "Creada",
      color: "blue",
      bgColor: "bg-blue-100",
      textColor: "text-blue-800",
      description: "Recepción creada, lista para operaciones"
    };
  }
}

class EstadoEnProcesoFactory extends EstadoFactory {
  createConfig(): EstadoConfig {
    return {
      label: "En Proceso",
      color: "yellow",
      bgColor: "bg-yellow-100", 
      textColor: "text-yellow-800",
      description: "Operaciones en curso"
    };
  }
}

class EstadoCompletadaFactory extends EstadoFactory {
  createConfig(): EstadoConfig {
    return {
      label: "Completada",
      color: "green",
      bgColor: "bg-green-100",
      textColor: "text-green-800",
      description: "Recepción completada exitosamente"
    };
  }
}

class EstadoEliminadaFactory extends EstadoFactory {
  createConfig(): EstadoConfig {
    return {
      label: "Eliminada",
      color: "red",
      bgColor: "bg-red-100",
      textColor: "text-red-800",
      description: "Recepción eliminada"
    };
  }
}

// Factory registry
const ESTADO_FACTORIES: Record<EstadoRecepcion, EstadoFactory> = {
  [EstadoRecepcion.CREADA]: new EstadoCreadaFactory(),
  [EstadoRecepcion.EN_PROCESO]: new EstadoEnProcesoFactory(),
  [EstadoRecepcion.COMPLETADA]: new EstadoCompletadaFactory(),
  [EstadoRecepcion.ELIMINADA]: new EstadoEliminadaFactory(),
};

// =====================================================
// SERVICIOS (Dependency Inversion Principle)
// =====================================================

// Interface para servicios de almacenamiento
interface IStorageService {
  load<T>(key: string, defaultValue: T): T;
  save<T>(key: string, value: T): void;
  remove(key: string): void;
}

// Interface para servicios de API
interface IApiService {
  fetchBarcos(): Promise<BarcoDetail[]>;
  fetchBarcoDetail(id: number): Promise<any>;
  createRecepcion(barcoId: number, data: BitacoraData): Promise<number | null>;
  updateRecepcion(id: number, data: BitacoraData, forceState?: EstadoRecepcion): Promise<boolean>;
  deleteRecepcion(id: number): Promise<boolean>;
}

// Interface para manejo de alertas
interface IAlertService {
  showError(message?: string, defaultMsg?: string): void;
  showSuccess(message: string, title?: string): void;
  showWarning(message: string, title?: string): void;
  showConfirmModal(
    title: string, 
    text: string, 
    onConfirm: () => void, 
    onCancel?: () => void,
    onDeny?: () => void
  ): void;
  showLoading(title?: string): void;
  closeAlert(): void;
  showSuccessToast(message: string, timer?: number): void;
}

// Interface para servicios utilitarios
interface IUtilsService {
  determineStateFromContent(recepcion: {
    isCreated?: boolean;
    bitacoras: any[];
    eliminado?: boolean;
    estado?: EstadoRecepcion;
  }): EstadoRecepcion;
}

// Interface para generación de reportes
interface IReportService {
  generateTextReport(bitacora: BitacoraData, op?: Operacion, editIdx?: number | null): void;
}

// =====================================================
// TYPE GUARDS AND VALIDATION HELPERS
// =====================================================

function isValidEstadoRecepcion(value: any): value is EstadoRecepcion {
  return Object.values(EstadoRecepcion).includes(value);
}

function ensureValidEstado(estado: any, defaultValue: EstadoRecepcion = EstadoRecepcion.CREADA): EstadoRecepcion {
  if (isValidEstadoRecepcion(estado)) {
    return estado;
  }
  console.warn('Invalid estado value:', estado, 'using default:', defaultValue);
  return defaultValue;
}

// =====================================================
// FUNCIONES UTILITARIAS GLOBALES
// =====================================================

function createDefaultBitacora(storageService: IStorageService): BitacoraData {
  const storedChequero = 
    storageService.load<string>("chequero", "") ||
    storageService.load<string>("userNameAll", "") ||
    "";

  return {
    id: null,
    nombreBarco: "",
    producto: "",
    fechaInicio: getFechaInicio(),
    fecha: getFecha(),
    fechaCierre: "",
    chequero: storedChequero,
    turnoInicio: "",
    turnoFin: "",
    puntoCarga: "",
    puntoDescarga: "NO APLICA",
    bitacoras: [],
    estado: EstadoRecepcion.CREADA, // Remove the "as EstadoRecepcion" cast
    isCreated: false,
    eliminado: false,
  };
}

// Funciones utilitarias para el estado del Select
function isSelectDisabled(
  loadingBoat: boolean,
  isCreated: boolean,
  estado: EstadoRecepcion
): boolean {
  const currentEstado = ensureValidEstado(estado);
  return (
    loadingBoat ||
    isCreated ||
    currentEstado === EstadoRecepcion.ELIMINADA ||
    currentEstado === EstadoRecepcion.COMPLETADA
  );
}

function getSelectPlaceholder(
  estado: EstadoRecepcion,
  isCreated: boolean,
  barcosLength: number,
  isRefreshing: boolean
): string {
  const currentEstado = ensureValidEstado(estado);
  
  switch (currentEstado) {
    case EstadoRecepcion.ELIMINADA:
      return "Recepción eliminada";
    case EstadoRecepcion.COMPLETADA:
      return "Recepción completada";
    default:
      if (isCreated) {
        return "Barco seleccionado (no se puede cambiar)";
      }
      if (barcosLength === 0) {
        return "Cargando barcos...";
      }
      if (isRefreshing) {
        return "Procesando solicitud...";
      }
      return "Seleccione barco";
  }
}

function shouldShowHelpText(
  isCreated: boolean,
  estado: EstadoRecepcion
): boolean {
  const currentEstado = ensureValidEstado(estado);
  return (
    isCreated &&
    currentEstado !== EstadoRecepcion.ELIMINADA &&
    currentEstado !== EstadoRecepcion.COMPLETADA
  );
}

function shouldShowFormSection(estado: EstadoRecepcion): boolean {
  const currentEstado = ensureValidEstado(estado);
  return (
    currentEstado !== EstadoRecepcion.ELIMINADA &&
    currentEstado !== EstadoRecepcion.COMPLETADA
  );
}

function shouldShowOperationsSection(estado: EstadoRecepcion): boolean {
  return shouldShowFormSection(estado);
}

// =====================================================
// IMPLEMENTACIONES CONCRETAS
// =====================================================

class LocalStorageService implements IStorageService {
  load<T>(key: string, defaultValue: T): T {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return defaultValue;
      try {
        const parsed = JSON.parse(stored) as T;
        
        // Special handling for BitacoraData to ensure enum is properly typed
        if (key === "bitacora" && parsed && typeof parsed === 'object' && 'estado' in parsed) {
          const bitacoraData = parsed as any;
          // Ensure estado is a valid enum value
          bitacoraData.estado = ensureValidEstado(bitacoraData.estado, EstadoRecepcion.CREADA);
          return bitacoraData as T;
        }
        
        return parsed;
      } catch {
        return stored as T;
      }
    } catch (error) {
      console.error(`Error al cargar ${key} del localStorage:`, error);
      return defaultValue;
    }
  }

  save<T>(key: string, value: T): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error al guardar ${key} en localStorage:`, error);
    }
  }

  remove(key: string): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(key);
    }
  }
}

class ApiService implements IApiService {
  async fetchBarcos(): Promise<BarcoDetail[]> {
    try {
      const res = await fetch("/api/v1/recepcion/barcos?activo=true");
      if (!res.ok) {
        await showErrorAlert(res, "No se pudo obtener la lista de barcos");
        return [];
      }
      const { data } = await res.json();
      return data.barcos || [];
    } catch (error) {
      console.error("Error fetching barcos:", error);
      await showErrorAlert(null, "Error de conexión al obtener la lista de barcos");
      return [];
    }
  }

  async fetchBarcoDetail(id: number): Promise<any> {
    try {
      const res = await fetch(`/api/v1/recepcion/bitacoras/${id}`);
      if (!res.ok) {
        await showErrorAlert(res, "Error al obtener información del barco");
        throw new Error("No se pudo cargar datos del barco");
      }
      const { data } = await res.json();
      return data;
    } catch (error) {
      console.error("Error fetching barco detail:", error);
      throw error;
    }
  }

  async createRecepcion(barcoId: number, recepcionData: BitacoraData): Promise<number | null> {
    try {
      const requestData = {
        barcoId,
        fechaInicio: recepcionData.fechaInicio,
        fecha: recepcionData.fecha,
        producto: recepcionData.producto,
        nombreBarco: recepcionData.nombreBarco,
        chequero: recepcionData.chequero,
        turnoInicio: recepcionData.turnoInicio,
        turnoFin: recepcionData.turnoFin,
        puntoCarga: recepcionData.puntoCarga,
        puntoDescarga: recepcionData.puntoDescarga,
        bitacoras: recepcionData.bitacoras,
        estado: EstadoRecepcion.CREADA,
        eliminado: false
      };

      const res = await fetch("/api/v1/recepcion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData)
      });

      if (!res.ok) {
        await showErrorAlert(res, "Error al crear recepción en la base de datos");
        return null;
      }

      const data = await res.json();
      console.log(`Recepción creada con ID: ${data.data.id}, Estado: ${EstadoRecepcion.CREADA}`);
      return data.data.id;
    } catch (error) {
      console.error("Error creating recepción:", error);
      await showErrorAlert(null, "Error de conexión al crear la recepción");
      return null;
    }
  }

  async updateRecepcion(
    recepcionId: number, 
    recepcionData: BitacoraData, 
    forceState?: EstadoRecepcion
  ): Promise<boolean> {
    try {
      const utilsService = new UtilsService();
      const estado = forceState || utilsService.determineStateFromContent(recepcionData);
      
      const requestData = {
        fechaInicio: recepcionData.fechaInicio,
        fechaCierre: recepcionData.fechaCierre,
        fecha: recepcionData.fecha,
        producto: recepcionData.producto,
        nombreBarco: recepcionData.nombreBarco,
        chequero: recepcionData.chequero,
        turnoInicio: recepcionData.turnoInicio,
        turnoFin: recepcionData.turnoFin,
        puntoCarga: recepcionData.puntoCarga,
        puntoDescarga: recepcionData.puntoDescarga,
        bitacoras: recepcionData.bitacoras,
        estado: estado,
        eliminado: recepcionData.eliminado || false
      };

      const res = await fetch(`/api/v1/recepcion/${recepcionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData)
      });

      if (!res.ok) {
        await showErrorAlert(res, "Error al actualizar recepción en la base de datos");
        throw new Error("Error al actualizar recepción");
      }

      console.log(`Recepción ${recepcionId} actualizada con estado: ${estado}`);
      return true;
    } catch (error) {
      console.error("Error updating recepción:", error);
      throw error;
    }
  }

  async deleteRecepcion(recepcionId: number): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/recepcion/${recepcionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });

      if (!res.ok) {
        await showErrorAlert(res, "Error al eliminar recepción de la base de datos");
        throw new Error("Error al eliminar recepción");
      }

      console.log(`Recepción ${recepcionId} marcada como eliminada`);
      return true;
    } catch (error) {
      console.error("Error deleting recepción:", error);
      throw error;
    }
  }
}

class AlertService implements IAlertService {
  showError(message?: string, defaultMsg = "Ocurrió un error"): void {
    showError(message, defaultMsg);
  }

  showSuccess(message: string, title = "Éxito"): void {
    showSuccess(message, title);
  }

  showWarning(message: string, title = "Advertencia"): void {
    showWarning(message, title);
  }

  showConfirmModal(
    title: string, 
    text: string, 
    onConfirm: () => void, 
    onCancel?: () => void,
    onDeny?: () => void
  ): void {
    showModal(
      title,
      text,
      "warning",
      onConfirm,
      onCancel,
      !!onDeny,
      "Generar Nota",
      onDeny
    );
  }

  showLoading(title = "Procesando solicitud..."): void {
    showLoading(title);
  }

  closeAlert(): void {
    closeAlert();
  }

  showSuccessToast(message: string, timer = 1500): void {
    showSuccessToast(message, timer);
  }
}

class UtilsService implements IUtilsService {
  determineStateFromContent(recepcion: {
    isCreated?: boolean;
    bitacoras: any[];
    eliminado?: boolean;
    estado?: EstadoRecepcion;
  }): EstadoRecepcion {
    if (recepcion.eliminado) return EstadoRecepcion.ELIMINADA;
    
    // Validate the provided estado
    if (recepcion.estado && isValidEstadoRecepcion(recepcion.estado)) {
      if (recepcion.estado === EstadoRecepcion.COMPLETADA) {
        return EstadoRecepcion.COMPLETADA;
      }
    }
    
    if (recepcion.bitacoras.length > 0) return EstadoRecepcion.EN_PROCESO;
    return EstadoRecepcion.CREADA;
  }
}

class ReportService implements IReportService {
  generateTextReport(bitacora: BitacoraData, op?: Operacion, editIdx?: number | null): void {
    const validEstado = ensureValidEstado(bitacora.estado);
    const config = ESTADO_FACTORIES[validEstado].createConfig();
    const lines: string[] = [];
    
    lines.push("===== RESUMEN DE RECEPCIÓN =====");
    lines.push(`Estado        : ${config.label}`);
    lines.push(`Fecha         : ${bitacora.fecha}`);
    lines.push(`Barco         : ${bitacora.nombreBarco} (ID: ${bitacora.id ?? "-"})`);
    lines.push(`Chequero      : ${bitacora.chequero}`);
    lines.push(`Turno         : ${bitacora.turnoInicio} → ${bitacora.turnoFin}`);
    lines.push(`Producto      : ${bitacora.producto}`);
    lines.push(`Pto. Carga    : ${bitacora.puntoCarga}`);
    lines.push(`Pto. Descarga : ${bitacora.puntoDescarga}`);
    lines.push("");
    lines.push("----- Operaciones -----");
    
    bitacora.bitacoras.forEach((it, i) => {
      lines.push(` ${i + 1}) Ticket       : ${it.ticket}`);
      lines.push(`    Transporte   : ${it.transporte}`);
      lines.push(`    Placa        : ${it.placa}`);
      lines.push(`    Motorista    : ${it.motorista}`);
      lines.push(`    Horas        : ${it.horaInicio} → ${it.horaFinal}  [Total: ${it.tiempoTotal}]`);
      lines.push(`    Observaciones: ${it.observaciones}`);
      lines.push("");
    });
    
    if (editIdx !== null && op) {
      lines.push("----- Operación en edición -----");
      lines.push(` Ticket       : ${op.ticket}`);
      lines.push(` Transporte   : ${op.transporte}`);
      lines.push(` Placa        : ${op.placa}`);
      lines.push(` Motorista    : ${op.motorista}`);
      lines.push(` Horas        : ${op.horaInicio} → ${op.horaFinal}  [Total: ${op.tiempoTotal}]`);
      lines.push(` Observaciones: ${op.observaciones}`);
      lines.push("");
    }
    
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `recepcion_${bitacora.fecha}_${bitacora.nombreBarco || "nota"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

// =====================================================
// COMPONENTES REUTILIZABLES (Single Responsibility)
// =====================================================

interface EstadoBadgeProps {
  estado: EstadoRecepcion;
  showDescription?: boolean;
}

function EstadoBadge({ estado, showDescription = false }: EstadoBadgeProps) {
  const validEstado = ensureValidEstado(estado);
  const config = ESTADO_FACTORIES[validEstado].createConfig();
  
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

// =====================================================
// HOOKS PERSONALIZADOS (Single Responsibility)
// =====================================================

function useBitacoraState(
  storageService: IStorageService,
  alertService: IAlertService
) {
  const [bitacora, setBitacora] = useState<BitacoraData>(() => createDefaultBitacora(storageService));
  const [isInitialized, setIsInitialized] = useState(false);

  const initializeBitacora = () => {
    if (typeof window === "undefined" || isInitialized) return;

    const storedChequero = 
      storageService.load<string>("chequero", "") ||
      storageService.load<string>("userNameAll", "") ||
      "";

    const savedBitacora = storageService.load<BitacoraData | null>("bitacora", null);
    let initialBitacora: BitacoraData;
    
    if (savedBitacora && typeof savedBitacora === 'object' && savedBitacora.id) {
      // Ensure proper enum typing when loading from storage
      const validEstado = ensureValidEstado(savedBitacora.estado, EstadoRecepcion.CREADA);
      
      initialBitacora = {
        ...savedBitacora,
        chequero: storedChequero,
        estado: validEstado,
      } as BitacoraData; // Explicit cast to ensure proper typing
      
      console.log("Cargando recepción existente:", initialBitacora);
    } else {
      initialBitacora = createDefaultBitacora(storageService);
      storageService.save("bitacora", initialBitacora);
      console.log("Creando nueva recepción:", initialBitacora);
    }
    
    setBitacora(initialBitacora);
    setIsInitialized(true);
  };

  const updateBitacora = (updates: Partial<BitacoraData>) => {
    setBitacora(prev => {
      const updated: BitacoraData = { ...prev, ...updates };
      
      // Ensure estado is properly typed when updating
      if (updates.estado !== undefined) {
        updated.estado = ensureValidEstado(updates.estado, prev.estado);
      }
      
      if (isInitialized) {
        storageService.save("bitacora", updated);
      }
      return updated;
    });
  };

  return {
    bitacora,
    setBitacora,
    updateBitacora,
    initializeBitacora,
    isInitialized
  };
}

function useOperacionState(storageService: IStorageService) {
  const defaultOp: Operacion = {
    ticket: "",
    transporte: "",
    placa: "",
    motorista: "",
    horaInicio: "",
    horaFinal: "",
    tiempoTotal: "",
    observaciones: "",
  };

  const [op, setOp] = useState<Operacion>(defaultOp);
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const initializeOperacion = () => {
    const savedOp = storageService.load<Operacion>("op", defaultOp);
    setOp(savedOp);
    
    const savedEditIdx = storageService.load<number | null>("editIdx", null);
    setEditIdx(savedEditIdx);
  };

  const updateOperacion = (updates: Partial<Operacion>) => {
    setOp(prev => {
      const updated = { ...prev, ...updates };
      storageService.save("op", updated);
      return updated;
    });
  };

  const setEditIndex = (index: number | null) => {
    setEditIdx(index);
    storageService.save("editIdx", index);
  };

  const resetOperacion = () => {
    setOp(defaultOp);
    setEditIdx(null);
    storageService.save("op", defaultOp);
    storageService.save("editIdx", null);
  };

  return {
    op,
    editIdx,
    setOp,
    updateOperacion,
    setEditIndex,
    resetOperacion,
    initializeOperacion,
    defaultOp
  };
}

// =====================================================
// BUSINESS LOGIC SERVICE (Single Responsibility)
// =====================================================
class BitacoraBusinessLogic {
  constructor(
    private apiService: IApiService,
    private alertService: IAlertService,
    private reportService: IReportService
  ) {}

  async validateAndCreateRecepcion(barcoId: number, bitacora: BitacoraData): Promise<number | null> {
    try {
      const recepcionId = await this.apiService.createRecepcion(barcoId, bitacora);
      if (recepcionId) {
        console.log(`Recepción creada con ID: ${recepcionId}`);
        return recepcionId;
      }
      return null;
    } catch (error) {
      console.error("Error en validateAndCreateRecepcion:", error);
      // El error ya fue mostrado por showErrorAlert en ApiService
      return null;
    }
  }

  async updateRecepcionIfCreated(bitacora: BitacoraData, updates: Partial<BitacoraData>): Promise<boolean> {
    if (bitacora.isCreated && bitacora.id !== null) {
      try {
        const updatedBitacora = { ...bitacora, ...updates };
        return await this.apiService.updateRecepcion(bitacora.id, updatedBitacora);
      } catch (error) {
        console.error("Error en updateRecepcionIfCreated:", error);
        // El error ya fue mostrado por showErrorAlert en ApiService
        return false;
      }
    }
    return true;
  }

  validateOperacion(op: Operacion): string | null {
    const { ticket, transporte, placa, horaInicio, horaFinal } = op;
    
    if (!ticket || !transporte || !placa) {
      return "Rellena Ticket, Transporte y Placa";
    }
    if (!horaInicio || !horaFinal) {
      return "Completa horas";
    }
    if (horaFinal < horaInicio) {
      return "La hora final no puede ser menor que la de inicio";
    }
    return null;
  }

  validateTurnoEnd(bitacora: BitacoraData): string | null {
    const { id, producto, turnoInicio, turnoFin, bitacoras, puntoDescarga, puntoCarga } = bitacora;
    
    if (puntoDescarga === "NO APLICA" && !puntoCarga) {
      return "Selecciona un punto de descarga";
    }
    if (!id) return "Selecciona un barco";
    if (!producto) return "Selecciona un producto";
    if (!turnoInicio || !turnoFin) {
      return "Define Inicio Turno y fin";
    }
    if (bitacoras.length === 0) {
      return "Agrega al menos una operación";
    }
    if (!bitacora.isCreated) {
      return "Primero debe seleccionar un barco para crear la recepción";
    }
    return null;
  }

  generateReport(bitacora: BitacoraData, op?: Operacion, editIdx?: number | null): void {
    this.reportService.generateTextReport(bitacora, op, editIdx);
  }
}

// =====================================================
// COMPONENTE PRINCIPAL REFACTORIZADO
// =====================================================

export default function Bitacora() {
  const router = useRouter();
  
  // Dependency Injection
  const storageService = new LocalStorageService();
  const apiService = new ApiService();
  const alertService = new AlertService();
  const reportService = new ReportService();
  const businessLogic = new BitacoraBusinessLogic(apiService, alertService, reportService);

  // Custom hooks
  const {
    bitacora,
    updateBitacora,
    initializeBitacora,
    isInitialized
  } = useBitacoraState(storageService, alertService);

  const {
    op,
    editIdx,
    setOp,
    updateOperacion,
    setEditIndex,
    resetOperacion,
    initializeOperacion
  } = useOperacionState(storageService);

  // Estados locales simplificados
  const [barcos, setBarcos] = useState<BarcoDetail[]>([]);
  const [selectedBarco, setSelectedBarco] = useState<BarcoDetail | null>(null);
  const [optsProductos, setOptsProductos] = useState<OptionType[]>([]);
  const [optsPuntos, setOptsPuntos] = useState<OptionType[]>([]);
  const [optsTransportes, setOptsTransportes] = useState<OptionType[]>([]);
  const [optsPlacas, setOptsPlacas] = useState<OptionType[]>([]);
  const [currentMotoristas, setCurrentMotoristas] = useState<Array<{ nombre: string; placa: string }>>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadingBoat, setLoadingBoat] = useState<boolean>(false);

  // =====================================================
  // FUNCIONES DE API Y DATOS
  // =====================================================

  const fetchBarcos = async (): Promise<BarcoDetail[]> => {
    try {
      const lista = await apiService.fetchBarcos();
      setBarcos(lista);
      return lista;
    } catch (error) {
      console.error("Error en fetchBarcos:", error);
      // El error ya fue mostrado por showErrorAlert en ApiService
      return [];
    }
  };

  const fetchBarcoDetail = async (id: number, keepLogs: boolean) => {
    try {
      const data = await apiService.fetchBarcoDetail(id);
      const detalle: BarcoDetail = {
        id: data.id,
        vaporBarco: data.vaporBarco,
        productos: data.productos,
        puntosDescarga: data.puntosDescarga,
        transportes: data.transportes,
      };
      
      setSelectedBarco(detalle);
      setOptsProductos(detalle.productos.map((p) => ({ value: p, label: p })));
      setOptsPuntos(
        [...detalle.puntosDescarga, "NO APLICA"].map((p) => ({
          value: p,
          label: p,
        }))
      );
      setOptsTransportes(
        detalle.transportes.map((t) => ({ value: t.id, label: t.nombre }))
      );
      
      if (!keepLogs) {
        resetOperacion();
      }
      
      setOptsPlacas([]);
      setCurrentMotoristas([]);
      
      updateBitacora({
        id: detalle.id,
        nombreBarco: detalle.vaporBarco,
        producto: keepLogs ? bitacora.producto : data.producto || "",
        turnoInicio: keepLogs ? bitacora.turnoInicio : data.turnoInicio || "",
        turnoFin: keepLogs ? bitacora.turnoFin : data.turnoFin || "",
        puntoCarga: keepLogs ? bitacora.puntoCarga : data.puntoCarga || "",
        puntoDescarga: keepLogs ? bitacora.puntoDescarga : data.puntoDescarga || "NO APLICA",
        bitacoras: keepLogs ? bitacora.bitacoras : data.bitacoras || [],
      });
    } catch (error) {
      console.error("Error en fetchBarcoDetail:", error);
      // El error ya fue mostrado por showErrorAlert en ApiService
    }
  };

  // =====================================================
  // HANDLERS DEL FORMULARIO PRINCIPAL
  // =====================================================

  const onBarcoChange = async (opt: OptionType | null) => {
    const newId = opt ? Number(opt.value) : null;
    
    if (!newId) {
      updateBitacora({ id: null, bitacoras: [] });
      setSelectedBarco(null);
      setOptsProductos([]);
      setOptsPuntos([]);
      setOptsTransportes([]);
      setOptsPlacas([]);
      setCurrentMotoristas([]);
      return;
    }

    if (bitacora.id != null && newId !== bitacora.id && bitacora.isCreated) {
      return alertService.showWarning(
        "No se puede cambiar el barco una vez creada la recepción.",
        "Barco ya seleccionado"
      );
    }

    // Si hay operaciones sin guardar, preguntar si conservar
    if (bitacora.id != null && newId !== bitacora.id && bitacora.bitacoras.length > 0) {
      return alertService.showConfirmModal(
        "¿Desea conservar las bitácoras?",
        "Si las conserva, deberá actualizarlas manualmente.",
        async () => {
          // Conservar logs
          updateBitacora({ id: newId, isCreated: false });
          alertService.showLoading("Cargando datos...");
          
          await fetchBarcoDetail(newId, true);
          alertService.closeAlert();
          alertService.showWarning("Actualice las bitácoras existentes");
        },
        async () => {
          // No conservar logs
          updateBitacora({ id: newId, bitacoras: [], isCreated: false });
          alertService.showLoading("Cargando datos...");
          
          await fetchBarcoDetail(newId, false);
          alertService.closeAlert();
        }
      );
    }

    // Mostrar confirmación antes de seleccionar barco y crear recepción
    alertService.showConfirmModal(
      '¿Confirmar selección?',
      'Una vez seleccionado, no podrá cambiar el barco para esta recepción. Se creará el registro automáticamente.',
      async () => {
        setLoadingBoat(true);
        alertService.showLoading("Cargando información y creando recepción...");

        try {
          await fetchBarcoDetail(newId, false);
          
          if (!bitacora.isCreated) {
            const updatedBitacora = {
              ...bitacora,
              id: newId,
              nombreBarco: barcos.find(b => b.id === newId)?.vaporBarco || ""
            };
            
            const recepcionId = await businessLogic.validateAndCreateRecepcion(newId, updatedBitacora);
            if (recepcionId) {
              updateBitacora({
                id: recepcionId,
                estado: EstadoRecepcion.CREADA,
                isCreated: true
              });
            }
          }

          alertService.closeAlert();
          alertService.showSuccessToast("Barco seleccionado y recepción creada");
        } catch (err) {
          console.error("Error en onBarcoChange:", err);
          alertService.closeAlert();
          // El error ya fue mostrado por showErrorAlert en ApiService
        } finally {
          setLoadingBoat(false);
        }
      }
    );
  };

  const onProductoChange = async (opt: OptionType | null) => {
    const newProducto = (opt?.value as string) || "";
    const updates = { producto: newProducto };
    updateBitacora(updates);
    //await businessLogic.updateRecepcionIfCreated(bitacora, updates);
  };

  const onPuntoChange = async (opt: OptionType | null) => {
    const v = (opt?.value as string) || "";
    const updates = {
      puntoDescarga: v,
      puntoCarga: v && v !== "NO APLICA" ? "NO APLICA" : "",
    };
    updateBitacora(updates);
    //await businessLogic.updateRecepcionIfCreated(bitacora, updates);
  };

  const onPuntoCargaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.toUpperCase();
    const updates = {
      puntoCarga: v,
      puntoDescarga: v ? "NO APLICA" : "",
    };
    updateBitacora(updates);
    //await businessLogic.updateRecepcionIfCreated(bitacora, updates);
  };

  const handleTurnoChange = async (field: 'turnoInicio' | 'turnoFin', value: string) => {
    const updates = { [field]: value };
    updateBitacora(updates);
    //await businessLogic.updateRecepcionIfCreated(bitacora, updates);
  };

  // =====================================================
  // HANDLERS DE OPERACIONES INDIVIDUALES
  // =====================================================

  const onOpTransporteChange = (opt: OptionType | null) => {
    if (!opt || !selectedBarco) {
      updateOperacion({ transporte: "", placa: "", motorista: "" });
      setOptsPlacas([]);
      setCurrentMotoristas([]);
      return;
    }
    
    const tId = Number(opt.value);
    const trans = selectedBarco.transportes.find((t) => t.id === tId)!;
    setCurrentMotoristas(trans.motoristas);
    setOptsPlacas(trans.motoristas.map((m) => ({ value: m.placa, label: m.placa })));
    updateOperacion({ transporte: trans.nombre, placa: "", motorista: "" });
  };

  const onOpPlacaChange = (opt: OptionType | null) => {
    const placa = (opt?.value as string) || "";
    const m = currentMotoristas.find((x) => x.placa === placa);
    updateOperacion({ placa, motorista: m?.nombre || "" });
  };

  const addOrUpdateOp = async () => {
    const validationError = businessLogic.validateOperacion(op);
    if (validationError) {
      return alertService.showWarning(validationError);
    }
    
    const nueva = { ...op, tiempoTotal: diffTime(op.horaInicio, op.horaFinal) };
    
    const updatedBitacoras = [...bitacora.bitacoras];
    if (editIdx != null) {
      updatedBitacoras[editIdx] = nueva;
      alertService.showSuccessToast("Operación actualizada", 1200);
    } else {
      updatedBitacoras.push(nueva);
    }
    
    const updates = { bitacoras: updatedBitacoras };
    updateBitacora(updates);
    await businessLogic.updateRecepcionIfCreated(bitacora, updates);
    
    resetOperacion();
  };

  const confirmDeleteOp = async (i: number) => {
    alertService.showConfirmModal(
      "¿Eliminar esta bitácora?",
      "Esta acción no se puede revertir.",
      async () => {
        const updatedBitacoras = bitacora.bitacoras.filter((_, idx) => idx !== i);
        const updates = { bitacoras: updatedBitacoras };
        
        updateBitacora(updates);
        await businessLogic.updateRecepcionIfCreated(bitacora, updates);
        
        alertService.showSuccessToast("Operación eliminada", 1200);
      }
    );
  };

  const editOperation = (index: number) => {
    setOp(bitacora.bitacoras[index]);
    setEditIndex(index);
  };

  // =====================================================
  // FUNCIONES DE ACCIONES FINALES
  // =====================================================

  const handleEndTurn = () => {
    const validationError = businessLogic.validateTurnoEnd(bitacora);
    if (validationError) {
      return alertService.showWarning(validationError);
    }

    alertService.showConfirmModal(
      "¿Terminar turno?",
      "Completar recepción y terminar. Esta acción no se puede revertir.",
      async () => {
        try {
          const fechaCierre = new Date().toLocaleString("en-CA", {
            timeZone: "America/El_Salvador",
            hour12: false,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          
          alertService.showLoading("Completando recepción...");

          const finalRecepcion = {
            ...bitacora,
            fechaCierre,
            estado: EstadoRecepcion.COMPLETADA
          };

          if (bitacora.id !== null) {
            try {
              const success = await apiService.updateRecepcion(
                bitacora.id, 
                finalRecepcion, 
                EstadoRecepcion.COMPLETADA
              );

              if (success) {
                alertService.closeAlert();
                alertService.showSuccess(
                  "Recepcion completada",
                  "Turno terminado exitosamente"
                );

                setTimeout(() => {
                  storageService.remove("bitacora");
                  storageService.remove("op");
                  storageService.remove("editIdx");
                  router.push("/proceso/iniciar");
                }, 1500);
              } else {
                throw new Error("No se pudo completar la recepción");
              }
            } catch (error) {
              console.error("Error al completar recepción:", error);
              alertService.closeAlert();
              // El error ya fue mostrado por showErrorAlert en ApiService
            }
          }
        } catch (error) {
          console.error("Error en handleEndTurn:", error);
          alertService.closeAlert();
          alertService.showError(
            "Error al completar recepción", 
            error instanceof Error ? error.message : "Error desconocido"
          );
        }
      },
      () => {},
      () => businessLogic.generateReport(bitacora, op, editIdx)
    );
  };

  const handleCancel = () => {
    alertService.showConfirmModal(
      "¿Está seguro de cancelar?",
      "Se borrarán los datos del formulario y se eliminará la recepción creada.",
      async () => {
        // Verificar si hay una recepción creada que no esté eliminada
        const currentEstado = ensureValidEstado(bitacora.estado);
        const shouldDeleteRecepcion = 
          bitacora.isCreated && 
          bitacora.id !== null && 
          currentEstado !== EstadoRecepcion.ELIMINADA;

        if (shouldDeleteRecepcion) {
          alertService.showLoading("Eliminando recepción...");
          
          try {
            await apiService.deleteRecepcion(bitacora.id!);
            alertService.closeAlert();
          } catch (error) {
            console.error("Error al eliminar recepción:", error);
            alertService.closeAlert();
            // El error ya fue mostrado por showErrorAlert en ApiService
          }
        }

        storageService.remove("bitacora");
        storageService.remove("op");
        storageService.remove("editIdx");
        router.push("/proceso/iniciar");
      }
    );
  };

  const handleRefreshClick = async () => {
    try {
      setIsRefreshing(true);
      const barcosNuevos = await fetchBarcos();
      
      if (bitacora.id !== null) {
        const existe = barcosNuevos.some((b) => b.id === bitacora.id);
        if (existe) {
          await fetchBarcoDetail(bitacora.id, true);
          alertService.showSuccessToast("Datos actualizados");
        } else {
          updateBitacora({
            id: null,
            nombreBarco: "",
            producto: "",
            turnoInicio: "",
            turnoFin: "",
            puntoCarga: "",
            puntoDescarga: "NO APLICA",
            bitacoras: [],
            isCreated: false
          });
          setSelectedBarco(null);
          setOptsProductos([]);
          setOptsPuntos([]);
          setOptsTransportes([]);
          setOptsPlacas([]);
          setCurrentMotoristas([]);
          alertService.showWarning("El barco ya no está disponible");
        }
      } else {
        alertService.showSuccessToast("Datos actualizados");
      }
    } catch (error) {
      console.error("Error en handleRefreshClick:", error);
      // El error ya fue mostrado por showErrorAlert en ApiService
    } finally {
      setIsRefreshing(false);
    }
  };

  // =====================================================
  // EFECTOS DE INICIALIZACIÓN Y PERSISTENCIA
  // =====================================================
  
  useEffect(() => {
    initializeBitacora();
    initializeOperacion();
  }, []);

  useEffect(() => {
    if (isInitialized) {
      fetchBarcos().then((lista) => {
        if (bitacora.id !== null && bitacora.isCreated) {
          fetchBarcoDetail(bitacora.id, true);
        }
      });
    }
  }, [isInitialized]);

  // Repoblar placas al cambiar transporte/barco
  useEffect(() => {
    if (selectedBarco && op.transporte) {
      const t = selectedBarco.transportes.find((x) => x.nombre === op.transporte);
      if (t) {
        setCurrentMotoristas(t.motoristas);
        setOptsPlacas(t.motoristas.map((m) => ({ value: m.placa, label: m.placa })));
      }
    }
  }, [selectedBarco, op.transporte]);

  // =====================================================
  // RENDERIZADO
  // =====================================================
  
  if (!isInitialized) {
    return <Loader/>;
  }

  const currentEstado = ensureValidEstado(bitacora.estado);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ENCABEZADO */}
      <PageHeader
        title="BITÁCORA DE RECEPCIÓN Y TRASLADO DE CEREALES"
        onRefresh={handleRefreshClick}
        isRefreshing={isRefreshing}
        showRefreshButton={true}
      />

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-4xl mx-auto p-2 space-y-6">
        
        {/* FORMULARIO PRINCIPAL - INFORMACIÓN DEL BARCO */}
        <section className="bg-white p-4 sm:p-6 rounded-lg shadow space-y-4 sm:space-y-6">
          
          {/* Estado de la recepción */}
          <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-semibold text-gray-800">Estado de la Recepción</h3>
              <EstadoBadge estado={currentEstado} showDescription={true} />
            </div>
          </div>

          {/* Solo mostrar formulario si no está eliminada o completada */}
          {shouldShowFormSection(currentEstado) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-2">Barco</label>
                <Select
                  options={barcos.map((b) => ({
                    value: b.id,
                    label: b.vaporBarco,
                  }))}
                  value={
                    bitacora.id !== null
                      ? { value: bitacora.id, label: bitacora.nombreBarco }
                      : null
                  }
                  onChange={onBarcoChange}
                  isDisabled={isSelectDisabled(loadingBoat, bitacora.isCreated || false, currentEstado)}
                  isLoading={barcos.length === 0 || isRefreshing}
                  placeholder={getSelectPlaceholder(currentEstado, bitacora.isCreated || false, barcos.length, isRefreshing)}
                  noOptionsMessage={() =>
                    barcos.length === 0
                      ? "Cargando barcos..."
                      : "No hay barcos disponibles"
                  }
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
                {shouldShowHelpText(bitacora.isCreated || false, currentEstado) && (
                  <p className="text-sm text-gray-600 mt-1">
                    El barco no se puede cambiar una vez creada la recepción
                  </p>
                )}
              </div>
              <div>
                <label className="block font-semibold mb-2">Fecha</label>
                <input
                  readOnly
                  type="date"
                  value={bitacora.fecha}
                  className="w-full h-10 border rounded-sm px-2 whitespace-nowrap"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold">Chequero</label>
                <input
                  readOnly
                  value={bitacora.chequero}
                  className="w-full h-10 border rounded-sm px-2 whitespace-nowrap"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold">Inicio Turno</label>
                <input
                  type="time"
                  value={bitacora.turnoInicio}
                  onChange={(e) => handleTurnoChange('turnoInicio', e.target.value)}
                  className="w-full h-10 border rounded-sm px-2 whitespace-nowrap"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold">Termina Turno</label>
                <input
                  type="time"
                  value={bitacora.turnoFin}
                  onChange={(e) => handleTurnoChange('turnoFin', e.target.value)}
                  className="w-full h-10 border rounded-sm px-2 whitespace-nowrap"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold">Producto</label>
                <Select
                  options={optsProductos}
                  value={
                    optsProductos.find((o) => o.value === bitacora.producto) ||
                    null
                  }
                  onChange={onProductoChange}
                  placeholder="Selecciona producto..."
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold">
                  Punto de Descarga
                </label>
                <Select
                  options={optsPuntos}
                  value={
                    optsPuntos.find((o) => o.value === bitacora.puntoDescarga) ||
                    null
                  }
                  onChange={onPuntoChange}
                  placeholder="Selecciona punto..."
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold">Punto de Carga</label>
                <input
                  type="text"
                  value={bitacora.puntoCarga}
                  onChange={onPuntoCargaChange}
                  className="w-full h-10 border rounded-sm px-2 whitespace-nowrap"
                />
              </div>
            </div>
          )}
        </section>

        {/* Mensaje para recepciones completadas */}
        {currentEstado === EstadoRecepcion.COMPLETADA && (
          <section className="bg-green-50 border border-green-200 p-6 rounded-lg shadow">
            <div className="text-center">
              <div className="mb-4">
                <EstadoBadge estado={EstadoRecepcion.COMPLETADA} showDescription={true} />
              </div>
              <h2 className="text-xl font-bold text-green-800 mb-2">
                Recepción Completada Exitosamente
              </h2>
              <p className="text-green-700 mb-4">
                Esta recepción fue completada el {bitacora.fechaCierre ? 
                  new Date(bitacora.fechaCierre).toLocaleString('es-ES', {
                    year: 'numeric',
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'fecha no disponible'
                }
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-white p-3 rounded border">
                  <span className="font-semibold">Barco:</span> {bitacora.nombreBarco}
                </div>
                <div className="bg-white p-3 rounded border">
                  <span className="font-semibold">Operaciones:</span> {bitacora.bitacoras.length}
                </div>
                <div className="bg-white p-3 rounded border">
                  <span className="font-semibold">Producto:</span> {bitacora.producto}
                </div>
                <div className="bg-white p-3 rounded border">
                  <span className="font-semibold">Chequero:</span> {bitacora.chequero}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* FORMULARIO DE OPERACIONES INDIVIDUALES */}
        {shouldShowOperationsSection(currentEstado) && (
          <>
            <section className="bg-white p-6 rounded shadow">
              <h2 className="font-semibold text-lg mb-4">Bitácoras</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 font-semibold">
                    Ticket Autorización
                  </label>
                  <input
                    type="number"
                    value={op.ticket}
                    onChange={(e) => updateOperacion({ ticket: e.target.value })}
                    className="w-full h-10 border rounded-sm px-2 whitespace-nowrap"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-semibold">Transporte</label>
                  <Select
                    options={optsTransportes}
                    value={
                      optsTransportes.find((o) => o.label === op.transporte) ||
                      null
                    }
                    onChange={onOpTransporteChange}
                    placeholder="Selecciona transporte..."
                  />
                </div>
                <div>
                  <label className="block mb-1 font-semibold">Placa</label>
                  <Select
                    options={optsPlacas}
                    value={optsPlacas.find((o) => o.value === op.placa) || null}
                    onChange={onOpPlacaChange}
                    isDisabled={!optsPlacas.length}
                    placeholder={
                      optsPlacas.length
                        ? "Selecciona placa..."
                        : "Seleccione transporte primero"
                    }
                    noOptionsMessage={() =>
                      optsPlacas.length
                        ? "Sin placas"
                        : "Seleccione transporte primero"
                    }
                  />
                </div>
                <div>
                  <label className="block mb-1 font-semibold">Motorista</label>
                  <input
                    readOnly
                    value={op.motorista}
                    placeholder="Se carga al elegir placa"
                    className="w-full h-10 border rounded-sm px-2 whitespace-nowrap"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-semibold">Hora Inicio</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      step={1}
                      value={op.horaInicio}
                      onChange={(e) =>
                        updateOperacion({
                          horaInicio: e.target.value,
                          tiempoTotal: diffTime(e.target.value, op.horaFinal),
                        })
                      }
                      className="w-full h-10 border rounded-sm px-2 whitespace-nowrap"
                    />
                    <button
                      onClick={() =>
                        updateOperacion({
                          horaInicio: nowTime(),
                          tiempoTotal: diffTime(nowTime(), op.horaFinal),
                        })
                      }
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md whitespace-nowrap"
                    >
                      Ahora
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block mb-1 font-semibold">Hora Final</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      step={1}
                      value={op.horaFinal}
                      onChange={(e) => {
                        if (op.horaInicio && e.target.value < op.horaInicio) {
                          return alertService.showWarning(
                            "La hora final no puede ser menor"
                          );
                        }
                        updateOperacion({
                          horaFinal: e.target.value,
                          tiempoTotal: diffTime(op.horaInicio, e.target.value),
                        });
                      }}
                      className="w-full h-10 border rounded-sm px-2 whitespace-nowrap"
                    />
                    <button
                      onClick={() => {
                        const now = nowTime();
                        if (op.horaInicio && now < op.horaInicio) {
                          return alertService.showWarning(
                            "La hora final no puede ser menor"
                          );
                        }
                        updateOperacion({
                          horaFinal: now,
                          tiempoTotal: diffTime(op.horaInicio, now),
                        });
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md whitespace-nowrap"
                    >
                      Ahora
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block mb-1 font-semibold">Tiempo Total</label>
                  <input
                    readOnly
                    value={op.tiempoTotal}
                    className="w-full h-10 border rounded-sm bg-gray-100 px-2 whitespace-nowrap"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block mb-1 font-semibold">Observaciones</label>
                  <textarea
                    rows={2}
                    value={op.observaciones}
                    onChange={(e) =>
                      updateOperacion({ observaciones: e.target.value })
                    }
                    className="w-full border rounded p-2"
                    placeholder="Escribe aquí..."
                  />
                </div>
              </div>
              
              {/* Botones de acción para operaciones */}
              <div className="flex justify-end mt-4 space-x-2">
                <button
                  onClick={addOrUpdateOp}
                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md whitespace-nowrap"
                >
                  {editIdx != null ? (
                    <>
                      <FiEdit size={20} />
                      Actualizar
                    </>
                  ) : (
                    <>
                      <FiPlus size={20} />
                      Agregar
                    </>
                  )}
                </button>
                {editIdx !== null && (
                  <button
                    type="button"
                    onClick={resetOperacion}
                    className="flex items-center ml-2 gap-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md whitespace-nowrap"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </section>

            {/* TABLA DE OPERACIONES */}
            <section className="bg-white p-6 rounded shadow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold uppercase">Bitácora de Operaciones</h2>
                <div className="text-sm text-gray-600">
                  {bitacora.bitacoras.length} operaciones registradas
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      {[
                        "Ticket",
                        "Transporte",
                        "Placa",
                        "Motorista",
                        "Inicio",
                        "Final",
                        "Total",
                        "Observaciones",
                        "Acción",
                      ].map((h) => (
                        <th key={h} className="border p-2">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bitacora.bitacoras.length > 0 ? (
                      bitacora.bitacoras.map((r, index) => (
                        <tr key={index} className="border-b text-center">
                          <td className="p-2 border whitespace-nowrap">{r.ticket}</td>
                          <td className="p-2 border whitespace-nowrap">{r.transporte}</td>
                          <td className="p-2 border whitespace-nowrap">{r.placa}</td>
                          <td className="p-2 border whitespace-nowrap">{r.motorista}</td>
                          <td className="p-2 border whitespace-nowrap">{r.horaInicio}</td>
                          <td className="p-2 border whitespace-nowrap">{r.horaFinal}</td>
                          <td className="p-2 border whitespace-nowrap">{r.tiempoTotal}</td>
                          <td className="p-2 border whitespace-nowrap">{r.observaciones}</td>
                          <td className="p-2 border text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => editOperation(index)}
                                title="Actualizar"
                                className="text-green-500 hover:text-green-700"
                              >
                                <FiEdit size={23} />
                              </button>
                              <button
                                onClick={() => confirmDeleteOp(index)}
                                title="Eliminar"
                                className="text-red-500 hover:text-red-700"
                              >
                                <FiTrash2 size={23} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="p-4 text-center text-gray-500">
                          No hay operaciones registradas
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* ACCIONES DEL PIE DE PÁGINA */}
        <PageActions
          onCancel={handleCancel}
          onSubmit={handleEndTurn}
          cancelText="Cancelar"
          submitText="Terminar turno"
        />
      </main>
    </div>
  );
}