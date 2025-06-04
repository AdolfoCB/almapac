"use client";

// =====================================================
// IMPORTS Y DEPENDENCIAS
// =====================================================
import { useEffect, useState } from "react";
import { FiPlus, FiTrash2, FiEdit } from "react-icons/fi";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { showErrorAlert } from "@/lib/errorAlert";
import { getFechaInicio, getFecha } from '@/utils/dateTimeUtils';
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
const CreatableSelect = dynamic(() => import("react-select/creatable"), { ssr: false });

// =====================================================
// TIPOS E INTERFACES (Single Responsibility)
// =====================================================

interface OptionType {
  value: string;
  label: string;
}

interface Operacion {
  bodega: string;
  inicio: string;
  final: string;
  minutos: string;
  actividad: string;
}

interface BarcoData {
  id?: number;
  bValue: string;
  valorMuelle: string;
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
  activo?: boolean;
  fechaRegistro?: string;
}

interface BitacoraData {
  id?: number;
  fechaInicio: string;
  fechaCierre: string;
  fecha: string;
  muellero: string;
  turnoInicio: string;
  turnoFin: string;
  operaciones: Operacion[];
  estado: EstadoBitacora;
  observaciones: string;
  isCreated?: boolean;
  eliminado?: boolean;
}

interface FormDataType {
  barco: BarcoData;
  bitacora: BitacoraData;
}

interface Tab {
  id: number;
  label: string;
  formData: FormDataType;
}

// =====================================================
// SISTEMA DE ESTADOS (Open/Closed Principle)
// =====================================================

enum EstadoBitacora {
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

// Abstract factory para estados
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
      description: "Bitácora creada, lista para operaciones"
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
      description: "Bitácora completada exitosamente"
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
      description: "Bitácora eliminada"
    };
  }
}

// Factory registry
const ESTADO_FACTORIES: Record<EstadoBitacora, EstadoFactory> = {
  [EstadoBitacora.CREADA]: new EstadoCreadaFactory(),
  [EstadoBitacora.EN_PROCESO]: new EstadoEnProcesoFactory(),
  [EstadoBitacora.COMPLETADA]: new EstadoCompletadaFactory(),
  [EstadoBitacora.ELIMINADA]: new EstadoEliminadaFactory(),
};

// =====================================================
// SERVICIOS (Dependency Inversion Principle)
// =====================================================

// Interfaces para servicios
interface IStorageService {
  load<T>(key: string, defaultValue: T): T;
  save<T>(key: string, value: T): void;
  remove(key: string): void;
}

interface IApiService {
  fetchBarcos(): Promise<any[]>;
  fetchBarcoDetail(id: number): Promise<BarcoData>;
  updateBarco(id: number, data: any): Promise<boolean>;
  createBitacora(barcoId: number, data: BitacoraData): Promise<number | null>;
  updateBitacora(id: number, data: BitacoraData, forceState?: EstadoBitacora): Promise<boolean>;
  deleteBitacora(id: number): Promise<boolean>;
}

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

interface IUtilsService {
  parseTimeToSeconds(timeStr: string): number;
  calcularDuracion(inicio: string, final: string): string;
  actualizarDuracion(operacion: Operacion): Operacion;
  determineStateFromContent(bitacora: { isCreated?: boolean; operaciones: any[]; eliminado?: boolean; estado?: EstadoBitacora; }): EstadoBitacora;
}

interface IReportService {
  generateTextReport(tabs: Tab[]): void;
}

// Implementaciones concretas
class LocalStorageService implements IStorageService {
  load<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return defaultValue;
      try {
        return JSON.parse(stored) as T;
      } catch {
        return stored as T;
      }
    } catch (error) {
      console.warn(`Error accessing localStorage key "${key}":`, error);
      return defaultValue;
    }
  }

  save<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving to localStorage:`, error);
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing from localStorage:`, error);
    }
  }
}

class ApiService implements IApiService {
  async fetchBarcos(): Promise<any[]> {
    try {
      const res = await fetch("/api/v1/barcos?activo=true");
      if (!res.ok) {
        await showErrorAlert(res, "No se pudo obtener la lista de barcos");
        return [];
      }
      const data = await res.json();
      return data.data.barcos || [];
    } catch (error) {
      console.error("Error fetching barcos:", error);
      await showErrorAlert(null, "Error de conexión al obtener la lista de barcos");
      return [];
    }
  }

  async fetchBarcoDetail(id: number): Promise<BarcoData> {
    try {
      const res = await fetch(`/api/v1/barcos/${id}`);
      if (!res.ok) {
        await showErrorAlert(res, "Error al obtener información del barco");
        throw new Error("Error al obtener barco");
      }
      
      const data = await res.json();
      const barcoData = data.data;
      
      return {
        id: barcoData.id,
        bValue: barcoData.muelle,
        valorMuelle: barcoData.vaporBarco,
        arriboFecha: barcoData.fechaArribo,
        arriboHora: barcoData.horaArribo,
        atraqueFecha: barcoData.fechaAtraque,
        atraqueHora: barcoData.horaAtraque,
        recibidoFecha: barcoData.fechaRecibido,
        recibidoHora: barcoData.horaRecibido,
        inicioOperacionesFecha: barcoData.fechaInicioOperaciones,
        inicioOperacionesHora: barcoData.horaInicioOperaciones,
        finOperacionesFecha: barcoData.fechaFinOperaciones,
        finOperacionesHora: barcoData.horaFinOperaciones,
        tipoCarga: JSON.parse(barcoData.tipoCarga),
        sistemaUtilizado: JSON.parse(barcoData.sistemaUtilizado),
        activo: barcoData.activo,
        fechaRegistro: barcoData.fechaRegistro,
      };
    } catch (error) {
      console.error("Error fetching barco detail:", error);
      throw error;
    }
  }

  async updateBarco(id: number, data: any): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/barcos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        await showErrorAlert(res, "Error al actualizar información del barco");
        throw new Error("Error al actualizar barco");
      }
      return true;
    } catch (error) {
      console.error("Error updating barco:", error);
      throw error;
    }
  }

  async createBitacora(barcoId: number, bitacoraData: BitacoraData): Promise<number | null> {
    try {
      const requestData = {
        barcoId,
        fechaInicio: bitacoraData.fechaInicio,
        fecha: bitacoraData.fecha,
        muellero: bitacoraData.muellero,
        turnoInicio: bitacoraData.turnoInicio,
        turnoFin: bitacoraData.turnoFin,
        observaciones: bitacoraData.observaciones,
        operaciones: bitacoraData.operaciones,
        estado: EstadoBitacora.CREADA,
        eliminado: false
      };

      const res = await fetch("/api/v1/bitacoras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData)
      });

      if (!res.ok) {
        await showErrorAlert(res, "Error al crear bitácora en la base de datos");
        return null;
      }

      const data = await res.json();
      console.log(`Bitácora creada con ID: ${data.data.id}, Estado: ${EstadoBitacora.CREADA}`);
      return data.data.id;
    } catch (error) {
      console.error("Error creating bitácora:", error);
      await showErrorAlert(null, "Error de conexión al crear la bitácora");
      return null;
    }
  }

  async updateBitacora(
    bitacoraId: number, 
    bitacoraData: BitacoraData, 
    forceState?: EstadoBitacora
  ): Promise<boolean> {
    try {
      const utilsService = new UtilsService();
      const estado = forceState || utilsService.determineStateFromContent(bitacoraData);
      
      const requestData = {
        fechaInicio: bitacoraData.fechaInicio,
        fechaCierre: bitacoraData.fechaCierre,
        fecha: bitacoraData.fecha,
        muellero: bitacoraData.muellero,
        turnoInicio: bitacoraData.turnoInicio,
        turnoFin: bitacoraData.turnoFin,
        observaciones: bitacoraData.observaciones,
        operaciones: bitacoraData.operaciones,
        estado: estado,
        eliminado: bitacoraData.eliminado || false
      };

      const res = await fetch(`/api/v1/bitacoras/${bitacoraId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData)
      });

      if (!res.ok) {
        await showErrorAlert(res, "Error al actualizar bitácora en la base de datos");
        throw new Error("Error al actualizar bitácora");
      }

      console.log(`Bitácora ${bitacoraId} actualizada con estado: ${estado}`);
      return true;
    } catch (error) {
      console.error("Error updating bitácora:", error);
      throw error;
    }
  }

  async deleteBitacora(bitacoraId: number): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/bitacoras/${bitacoraId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });

      if (!res.ok) {
        await showErrorAlert(res, "Error al eliminar bitácora de la base de datos");
        throw new Error("Error al eliminar bitácora");
      }

      console.log(`Bitácora ${bitacoraId} marcada como eliminada`);
      return true;
    } catch (error) {
      console.error("Error deleting bitácora:", error);
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
  parseTimeToSeconds(timeStr: string): number {
    if (!timeStr) return 0;
    const parts = timeStr.split(":").map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 3600 + parts[1] * 60;
    }
    return 0;
  }

  calcularDuracion(inicio: string, final: string): string {
    const startSeconds = this.parseTimeToSeconds(inicio);
    const endSeconds = this.parseTimeToSeconds(final);
    if (startSeconds && endSeconds && endSeconds >= startSeconds) {
      const diffSeconds = endSeconds - startSeconds;
      const totalMinutes = Math.floor(diffSeconds / 60);
      return totalMinutes.toString();
    }
    return "0";
  }

  actualizarDuracion(operacion: Operacion): Operacion {
    return {
      ...operacion,
      minutos: this.calcularDuracion(operacion.inicio, operacion.final),
    };
  }

  determineStateFromContent(bitacora: {
    isCreated?: boolean;
    operaciones: any[];
    eliminado?: boolean;
    estado?: EstadoBitacora;
  }): EstadoBitacora {
    if (bitacora.eliminado) return EstadoBitacora.ELIMINADA;
    if (bitacora.estado === EstadoBitacora.COMPLETADA) return EstadoBitacora.COMPLETADA;
    if (bitacora.operaciones.length > 0) return EstadoBitacora.EN_PROCESO;
    return EstadoBitacora.CREADA;
  }
}

class ReportService implements IReportService {
  generateTextReport(tabs: Tab[]): void {
    const now = new Date();
    const fechaNota = now.toISOString().replace(/[:.]/g, "-");
    let contenido = `Bitácora - Generado el ${now.toLocaleString("en-CA", { timeZone: "America/El_Salvador", hour12: false })}\n\n`;
    
    tabs.forEach(tab => {
      if (tab.formData.bitacora.estado === EstadoBitacora.ELIMINADA) return;
      
      const { barco, bitacora } = tab.formData;
      const config = ESTADO_FACTORIES[bitacora.estado].createConfig();
      
      contenido += `=== ${tab.label} ===\n`;
      contenido += `Estado: ${config.label}\n`;
      contenido += `Barco: ${barco.valorMuelle} (Muelle: ${barco.bValue})\n`;
      contenido += `Arribo: ${barco.arriboFecha} ${barco.arriboHora}\n`;
      contenido += `Atraque: ${barco.atraqueFecha} ${barco.atraqueHora}\n`;
      contenido += `Recibido: ${barco.recibidoFecha} ${barco.recibidoHora}\n`;
      contenido += `Inicio Operaciones: ${barco.inicioOperacionesFecha} ${barco.inicioOperacionesHora}\n`;
      contenido += `Fin Operaciones: ${barco.finOperacionesFecha} ${barco.finOperacionesHora}\n\n`;
      contenido += `Bitácora:\n`;
      contenido += `Fecha: ${bitacora.fecha}\n`;
      contenido += `Turno: ${bitacora.turnoInicio} - ${bitacora.turnoFin}\n`;
      contenido += `Operaciones (${bitacora.operaciones.length}):\n`;
      bitacora.operaciones.forEach((op, i) => {
        contenido += `${i + 1}. [${op.bodega}] ${op.inicio} → ${op.final} (${op.minutos}min) — ${op.actividad}\n`;
      });
      contenido += `Observaciones: ${bitacora.observaciones}\n\n`;
    });
    
    const blob = new Blob([contenido], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bitacora_${fechaNota}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// =====================================================
// COMPONENTES REUTILIZABLES (Single Responsibility)
// =====================================================

interface EstadoBadgeProps {
  estado: EstadoBitacora;
  showDescription?: boolean;
}

function EstadoBadge({ estado, showDescription = false }: EstadoBadgeProps) {
  const config = ESTADO_FACTORIES[estado].createConfig();
  
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
// CONSTANTES
// =====================================================

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

// =====================================================
// FUNCIONES UTILITARIAS GLOBALES
// =====================================================

function createInitialFormData(storageService: IStorageService): FormDataType {
  const storedMuellero = storageService.load<string>("userNameAll", "");
  const storedTurnoInicio = storageService.load<string>("turnoInicio", "");
  const storedTurnoFin = storageService.load<string>("turnoFin", "");

  return {
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
      fechaInicio: getFechaInicio(),
      fechaCierre: "",
      fecha: getFecha(),
      muellero: storedMuellero,
      turnoInicio: storedTurnoInicio,
      turnoFin: storedTurnoFin,
      operaciones: [],
      observaciones: "",
      estado: EstadoBitacora.CREADA,
      isCreated: false,
      eliminado: false,
    },
  };
}

// =====================================================
// CUSTOM HOOKS (Single Responsibility)
// =====================================================

function useTabsState(
  storageService: IStorageService,
  utilsService: IUtilsService
) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [initialized, setInitialized] = useState(false);

  const updateTab = (tabId: number, updates: Partial<FormDataType>) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId 
        ? { ...tab, formData: { ...tab.formData, ...updates } }
        : tab
    ));
  };

  const createInitialTab = () => {
    const initialFormData = createInitialFormData(storageService);
    const initialTab: Tab = { 
      id: 1, 
      label: "Barco 1", 
      formData: initialFormData 
    };
    setTabs([initialTab]);
    setActiveTab(1);
    
    storageService.save("tabsList", [initialTab]);
    storageService.save("activeTab", 1);
    storageService.save("barcoData_1", initialTab.formData.barco);
    storageService.save("bitacoraData_1", initialTab.formData.bitacora);
  };

  const addTab = (currentFormData?: FormDataType): Tab => {
    const newId = tabs.length ? Math.max(...tabs.map(t => t.id)) + 1 : 1;
    const currentTurnoInicio = currentFormData?.bitacora.turnoInicio || "";
    const currentTurnoFin = currentFormData?.bitacora.turnoFin || "";
    const storedMuellero = storageService.load<string>("userNameAll", "");

    const newTab: Tab = {
      id: newId,
      label: `Barco ${newId}`,
      formData: {
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
          fechaInicio: getFechaInicio(),
          fechaCierre: "",
          fecha: getFecha(),
          muellero: storedMuellero,
          turnoInicio: currentTurnoInicio,
          turnoFin: currentTurnoFin,
          operaciones: [],
          observaciones: "",
          estado: EstadoBitacora.CREADA,
          isCreated: false,
          eliminado: false,
        }
      }
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTab(newId);
    storageService.save(`barcoData_${newId}`, newTab.formData.barco);
    storageService.save(`bitacoraData_${newId}`, newTab.formData.bitacora);
    
    return newTab;
  };

  const removeTab = (tabId: number) => {
    storageService.remove(`barcoData_${tabId}`);
    storageService.remove(`bitacoraData_${tabId}`);
    storageService.remove(`newOperacion_${tabId}`);
    
    const filtered = tabs.filter(tab => tab.id !== tabId);
    setTabs(filtered);
    
    if (activeTab === tabId && filtered.length > 0) {
      setActiveTab(filtered[0].id);
    }
  };

  return {
    tabs,
    setTabs,
    activeTab,
    setActiveTab,
    initialized,
    setInitialized,
    updateTab,
    addTab,
    removeTab
  };
}

function useOperacionState(
  storageService: IStorageService,
  utilsService: IUtilsService,
  activeTab: number
) {
  const defaultOp: Operacion = {
    bodega: "",
    inicio: "",
    final: "",
    minutos: "",
    actividad: "",
  };

  const [newOperacion, setNewOperacion] = useState<Operacion>(defaultOp);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [actividadOptions, setActividadOptions] = useState<OptionType[]>(validOptions);

  const updateOperacion = (updates: Partial<Operacion>) => {
    setNewOperacion(prev => {
      let updated = { ...prev, ...updates };
      if (updates.inicio || updates.final) {
        updated = utilsService.actualizarDuracion(updated);
      }
      return updated;
    });
  };

  const resetOperacion = () => {
    setNewOperacion(defaultOp);
    storageService.remove(`newOperacion_${activeTab}`);
    setEditingIndex(null);
  };

  return {
    newOperacion,
    setNewOperacion,
    editingIndex,
    setEditingIndex,
    actividadOptions,
    setActividadOptions,
    updateOperacion,
    resetOperacion,
    defaultOp
  };
}

// =====================================================
// BUSINESS LOGIC SERVICE
// =====================================================

class BitacoraMuelleBusinessLogic {
  constructor(
    private apiService: IApiService,
    private alertService: IAlertService,
    private utilsService: IUtilsService,
    private reportService: IReportService
  ) {}

  // Validaciones
  validateBoatSelection(tabs: Tab[], selectedBarcos: string[], availableBarcos: any[]): boolean {
    const remainingBarcos = availableBarcos.length - selectedBarcos.length;
    return remainingBarcos > 0 && availableBarcos.length > 0;
  }

  validateOperacion(op: Operacion): string | null {
    if (!op.inicio) return "Debe completar el campo INICIO.";
    if (!op.final) return "Debe completar el campo FINAL.";
    if (this.utilsService.parseTimeToSeconds(op.final) < this.utilsService.parseTimeToSeconds(op.inicio)) {
      return "La hora final no puede ser menor que la hora de inicio.";
    }
    if (!op.actividad) return "Debe seleccionar o especificar una ACTIVIDAD.";
    return null;
  }

  validateEndTurn(tabs: Tab[]): string | null {
    // Validar barcos seleccionados
    const tabSinBarco = tabs.find(tab => 
      tab.formData.bitacora.estado !== EstadoBitacora.ELIMINADA && 
      tab.formData.bitacora.estado !== EstadoBitacora.COMPLETADA &&
      !tab.formData.barco.id
    );
    if (tabSinBarco) {
      return `Debe seleccionar un barco para ${tabSinBarco.label}`;
    }

    // Validar operaciones
    const tabSinOps = tabs.find(tab => 
      tab.formData.bitacora.estado !== EstadoBitacora.ELIMINADA && 
      tab.formData.bitacora.estado !== EstadoBitacora.COMPLETADA &&
      tab.formData.bitacora.operaciones.length === 0
    );
    if (tabSinOps) {
      return `Debe agregar al menos una actividad en ${tabSinOps.label}`;
    }

    // Validar bitácoras creadas
    const tabSinBitacora = tabs.find(tab => 
      tab.formData.bitacora.estado !== EstadoBitacora.ELIMINADA &&
      tab.formData.bitacora.estado !== EstadoBitacora.COMPLETADA &&
      (!tab.formData.bitacora.isCreated || !tab.formData.bitacora.id)
    );
    if (tabSinBitacora) {
      return `Primero debe seleccionar un barco para ${tabSinBitacora.label} para crear la bitácora`;
    }

    // Validar turnos
    for (const tab of tabs) {
      if (tab.formData.bitacora.estado !== EstadoBitacora.ELIMINADA && 
          tab.formData.bitacora.estado !== EstadoBitacora.COMPLETADA) {
        if (!tab.formData.bitacora.turnoInicio || !tab.formData.bitacora.turnoFin) {
          return `Falta ingresar el turno de inicio y/o fin para ${tab.label}.`;
        }
      }
    }

    return null;
  }

  async createBitacoraIfNeeded(barcoId: number, bitacoraData: BitacoraData): Promise<number | null> {
    try {
      return await this.apiService.createBitacora(barcoId, bitacoraData);
    } catch (error) {
      console.error("Error en createBitacoraIfNeeded:", error);
      // El error ya fue mostrado por showErrorAlert en ApiService
      return null;
    }
  }

  async updateBitacoraIfCreated(bitacoraData: BitacoraData): Promise<boolean> {
    if (bitacoraData.id && bitacoraData.isCreated) {
      try {
        return await this.apiService.updateBitacora(bitacoraData.id, bitacoraData);
      } catch (error) {
        console.error("Error en updateBitacoraIfCreated:", error);
        // El error ya fue mostrado por showErrorAlert en ApiService
        return false;
      }
    }
    return true;
  }

  async completeTurn(tabs: Tab[]): Promise<boolean> {
    try {
      this.alertService.showLoading("Completando bitácoras...");

      const now = new Date();
      const fechaCierre = now.toLocaleString("en-CA", {
        timeZone: "America/El_Salvador",
        hour12: false,
        year: "numeric",
        month: "2-digit", 
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });

      for (const tab of tabs) {
        const { bitacora } = tab.formData;
        if (bitacora.id && 
            bitacora.estado !== EstadoBitacora.ELIMINADA && 
            bitacora.estado !== EstadoBitacora.COMPLETADA) {
          
          const finalBitacora = {
            ...bitacora,
            fechaCierre,
            estado: EstadoBitacora.COMPLETADA
          };

          try {
            const success = await this.apiService.updateBitacora(bitacora.id, finalBitacora, EstadoBitacora.COMPLETADA);
            if (!success) {
              throw new Error(`Error al completar bitácora de ${tab.label}`);
            }
          } catch (error) {
            console.error(`Error al completar bitácora de ${tab.label}:`, error);
            // El error ya fue mostrado por showErrorAlert en ApiService
            throw error;
          }
        }
      }

      this.alertService.closeAlert();
      this.alertService.showSuccess(
        "Todas las bitácoras han sido completadas",
        "Turno terminado exitosamente"
      );
      return true;
    } catch (error) {
      console.error("Error en completeTurn:", error);
      this.alertService.closeAlert();
      this.alertService.showError(
        "Error al completar bitácoras", 
        error instanceof Error ? error.message : "Error desconocido"
      );
      return false;
    }
  }

  generateReport(tabs: Tab[]): void {
    this.reportService.generateTextReport(tabs);
  }
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function Bitacora() {
  const router = useRouter();

  // Dependency Injection
  const storageService = new LocalStorageService();
  const apiService = new ApiService();
  const alertService = new AlertService();
  const utilsService = new UtilsService();
  const reportService = new ReportService();
  const businessLogic = new BitacoraMuelleBusinessLogic(apiService, alertService, utilsService, reportService);

  // Custom hooks
  const {
    tabs,
    setTabs,
    activeTab,
    setActiveTab,
    initialized,
    setInitialized,
    updateTab,
    addTab,
    removeTab
  } = useTabsState(storageService, utilsService);

  const {
    newOperacion,
    setNewOperacion,
    editingIndex,
    setEditingIndex,
    actividadOptions,
    setActividadOptions,
    updateOperacion,
    resetOperacion,
    defaultOp
  } = useOperacionState(storageService, utilsService, activeTab);

  // Estados locales
  const [userNameLoaded, setUserNameLoaded] = useState(false);
  const [loadingBoat, setLoadingBoat] = useState(false);
  const [loadingBarcosList, setLoadingBarcosList] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [barcosList, setBarcosList] = useState<any[]>([]);

  // Datos del formulario activo
  const activeFormData = tabs.find(tab => tab.id === activeTab)?.formData;

  // =====================================================
  // FUNCIONES DE UTILIDAD
  // =====================================================

  const createInitialTab = () => {
    const initialFormData = createInitialFormData(storageService);
    const initialTab: Tab = { 
      id: 1, 
      label: "Barco 1", 
      formData: initialFormData 
    };
    setTabs([initialTab]);
    setActiveTab(1);
    
    storageService.save("tabsList", [initialTab]);
    storageService.save("activeTab", 1);
    storageService.save("barcoData_1", initialTab.formData.barco);
    storageService.save("bitacoraData_1", initialTab.formData.bitacora);
  };

  const getAllSelectedBarcos = (): string[] => {
    return tabs
      .filter(tab => 
        tab.formData.barco.valorMuelle && 
        tab.formData.bitacora.estado !== EstadoBitacora.ELIMINADA &&
        tab.formData.bitacora.estado !== EstadoBitacora.COMPLETADA
      )
      .map(tab => tab.formData.barco.valorMuelle);
  };

  const getAvailableBarcos = () => {
    const allSelectedBarcos = getAllSelectedBarcos();
    return barcosList.filter(boat => !allSelectedBarcos.includes(boat.vaporBarco));
  };

  const canAddMoreTabs = (): boolean => {
    return businessLogic.validateBoatSelection(tabs, getAllSelectedBarcos(), barcosList);
  };

  // =====================================================
  // FUNCIONES DE API Y DATOS
  // =====================================================

  const fetchBarcosList = async () => {
    setLoadingBarcosList(true);
    try {
      const barcos = await apiService.fetchBarcos();
      setBarcosList(barcos);
    } catch (error) {
      console.error("Error en fetchBarcosList:", error);
      // El error ya fue mostrado por showErrorAlert en ApiService
    } finally {
      setLoadingBarcosList(false);
    }
  };

  const updateBarcoData = (newBarco: BarcoData) => {
    if (!activeFormData || !initialized) return;
    updateTab(activeTab, { barco: newBarco });
    storageService.save(`barcoData_${activeTab}`, newBarco);
  };

  const updateBitacoraData = async (newBitacora: BitacoraData) => {
    if (!activeFormData || !initialized) return;
    
    const estado = utilsService.determineStateFromContent(newBitacora);
    const updatedBitacora = { ...newBitacora, estado };
    
    updateTab(activeTab, { bitacora: updatedBitacora });
    storageService.save(`bitacoraData_${activeTab}`, updatedBitacora);

    await businessLogic.updateBitacoraIfCreated(updatedBitacora);
  };

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleChangeBoat = async (e: { target: { value: string } }) => {
    const selectedValue = e.target.value;
    const selectedBoat = barcosList.find(b => b.vaporBarco === selectedValue);
    if (!selectedBoat) return;

    alertService.showConfirmModal(
      '¿Confirmar selección?',
      'Una vez seleccionado, no podrá cambiar el barco para esta bitácora. Se creará el registro automáticamente.',
      async () => {
        setLoadingBoat(true);
        alertService.showLoading("Cargando información y creando bitácora...");

        try {
          const barcoData = await apiService.fetchBarcoDetail(selectedBoat.id);
          updateBarcoData(barcoData);

          if (activeFormData && !activeFormData.bitacora.isCreated) {
            const bitacoraId = await businessLogic.createBitacoraIfNeeded(selectedBoat.id, activeFormData.bitacora);
            if (bitacoraId) {
              const updatedBitacora = {
                ...activeFormData.bitacora,
                id: bitacoraId,
                estado: EstadoBitacora.CREADA,
                isCreated: true
              };
              
              updateTab(activeTab, {
                barco: barcoData,
                bitacora: updatedBitacora
              });
              
              storageService.save(`barcoData_${activeTab}`, barcoData);
              storageService.save(`bitacoraData_${activeTab}`, updatedBitacora);
            }
          }

          alertService.closeAlert();
          alertService.showSuccessToast("Barco seleccionado y bitácora creada");
        } catch (err) {
          console.error("Error en seleccionar barco:", err);
          alertService.closeAlert();
          // El error ya fue mostrado por showErrorAlert en ApiService
        } finally {
          setLoadingBoat(false);
        }
      }
    );
  };

  const handleActualizarBarco = async () => {
    if (!activeFormData?.barco.id) {
      return alertService.showWarning("Debe seleccionar un barco para actualizar", "Barco no seleccionado");
    }

    const body = {
      muelle: activeFormData.barco.bValue,
      vaporBarco: activeFormData.barco.valorMuelle,
      fechaArribo: activeFormData.barco.arriboFecha,
      horaArribo: activeFormData.barco.arriboHora,
      fechaAtraque: activeFormData.barco.atraqueFecha,
      horaAtraque: activeFormData.barco.atraqueHora,
      fechaRecibido: activeFormData.barco.recibidoFecha,
      horaRecibido: activeFormData.barco.recibidoHora,
      fechaInicioOperaciones: activeFormData.barco.inicioOperacionesFecha,
      horaInicioOperaciones: activeFormData.barco.inicioOperacionesHora,
      fechaFinOperaciones: activeFormData.barco.finOperacionesFecha,
      horaFinOperaciones: activeFormData.barco.finOperacionesHora,
      tipoCarga: activeFormData.barco.tipoCarga,
      sistemaUtilizado: activeFormData.barco.sistemaUtilizado,
      activo: activeFormData.barco.activo,
      fechaRegistro: activeFormData.barco.fechaRegistro,
    };

    alertService.showConfirmModal(
      "Actualizar información del barco",
      "¿Desea actualizar la información del barco?",
      async () => {
        alertService.showLoading("Enviando datos...");

        try {
          await apiService.updateBarco(activeFormData.barco.id!, body);
          const updatedInfo = await apiService.fetchBarcoDetail(activeFormData.barco.id!);
          updateBarcoData(updatedInfo);
          
          alertService.closeAlert();
          alertService.showSuccessToast("Información del barco actualizada", 1200);
        } catch (error: any) {
          console.error("Error en actualizar barco:", error);
          alertService.closeAlert();
          // El error ya fue mostrado por showErrorAlert en ApiService
        }
      }
    );
  };

  const handleRefreshClick = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    
    try {
      const updatedBarcosList = await apiService.fetchBarcos();
      setBarcosList(updatedBarcosList);

      if (activeFormData?.barco.id) {
        const barcoStillExists = updatedBarcosList.some(
          (b: any) => b.id === activeFormData.barco.id
        );

        if (!barcoStillExists) {
          alertService.showWarning("El barco seleccionado ya no está disponible");
          updateBarcoData({
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
          });
        } else {
          try {
            const updatedInfo = await apiService.fetchBarcoDetail(activeFormData.barco.id);
            updateBarcoData(updatedInfo);
            alertService.showSuccessToast("Datos actualizados");
          } catch (error) {
            console.error("Error al actualizar información del barco:", error);
            // El error ya fue mostrado por showErrorAlert en ApiService
          }
        }
      }
    } catch (error) {
      alertService.closeAlert();
      console.error("Error en refresh:", error);
      // El error ya fue mostrado por showErrorAlert en ApiService
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddTab = async () => {
    if (!canAddMoreTabs()) {
      return alertService.showWarning(
        `Ya se han utilizado todos los barcos disponibles.\n\nPara agregar una nueva pestaña, primero elimine una pestaña existente.`,
        "No se pueden agregar más pestañas"
      );
    }

    alertService.showConfirmModal(
      '¿Agregar nuevo barco?',
      'Se creará una nueva pestaña para registrar operaciones.',
      () => {
        addTab(activeFormData);
      }
    );
  };

  const handleDeleteTab = async (id: number) => {
    if (tabs.length === 1) return;
    
    const tabToDelete = tabs.find(tab => tab.id === id);
    
    alertService.showConfirmModal(
      "¿Eliminar pestaña?",
      "Se borrarán los datos del formulario, esta acción no se puede revertir.",
      async () => {
        if (tabToDelete?.formData.bitacora.isCreated && tabToDelete.formData.bitacora.id) {
          alertService.showLoading("Eliminando bitácora...");

          try {
            await apiService.deleteBitacora(tabToDelete.formData.bitacora.id);
            alertService.closeAlert();
          } catch (error) {
            console.error("Error al eliminar bitácora:", error);
            alertService.closeAlert();
            // El error ya fue mostrado por showErrorAlert en ApiService
            return;
          }
        }

        removeTab(id);
      }
    );
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (!activeFormData) return;
    
    if ([
      "bValue", "valorMuelle", "arriboFecha", "arriboHora", "atraqueFecha", 
      "atraqueHora", "recibidoFecha", "recibidoHora", "inicioOperacionesFecha", 
      "inicioOperacionesHora", "finOperacionesFecha", "finOperacionesHora"
    ].includes(name)) {
      updateBarcoData({ ...activeFormData.barco, [name]: value });
    } else {
      const updatedBitacora = { ...activeFormData.bitacora, [name]: value };
      await updateBitacoraData(updatedBitacora);
    }
  };

  const handleCheckboxChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    groupKey: "tipoCarga" | "sistemaUtilizado"
  ) => {
    const { value, checked } = e.target;
    if (!activeFormData) return;
    const current = activeFormData.barco[groupKey];
    updateBarcoData({
      ...activeFormData.barco,
      [groupKey]: checked ? [...current, value] : current.filter(item => item !== value),
    });
  };

  const handleOperacionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    updateOperacion({ [name]: value });
  };

  const addOrUpdateOperacion = async () => {
    const validationError = businessLogic.validateOperacion(newOperacion);
    if (validationError) {
      return alertService.showError(validationError);
    }

    if (activeFormData) {
      let updatedOperaciones: Operacion[];
      
      if (editingIndex !== null) {
        updatedOperaciones = [...(activeFormData.bitacora.operaciones || [])];
        updatedOperaciones[editingIndex] = newOperacion;
        alertService.showSuccessToast("Actividad actualizada", 1200);
      } else {
        updatedOperaciones = [...(activeFormData.bitacora.operaciones || []), newOperacion];
      }

      const updatedBitacora = {
        ...activeFormData.bitacora,
        operaciones: updatedOperaciones,
      };

      await updateBitacoraData(updatedBitacora);
    }
    resetOperacion();
  };

  const handleEditOperacion = (index: number) => {
    if (!activeFormData?.bitacora.operaciones) return;
    setNewOperacion(activeFormData.bitacora.operaciones[index]);
    setEditingIndex(index);
  };

  const deleteOperacion = async (index: number) => {
    alertService.showConfirmModal(
      "¿Eliminar actividad?",
      "Esta acción no se puede revertir.",
      async () => {
        if (activeFormData?.bitacora.operaciones) {
          const updatedOperaciones = activeFormData.bitacora.operaciones.filter((_, i) => i !== index);
          const updatedBitacora = {
            ...activeFormData.bitacora,
            operaciones: updatedOperaciones,
          };

          await updateBitacoraData(updatedBitacora);
          alertService.showSuccessToast("Actividad eliminada", 1200);
        }
      }
    );
  };

  const handleEndTurn = async () => {
    const validationError = businessLogic.validateEndTurn(tabs);
    if (validationError) {
      return alertService.showWarning(validationError);
    }

    alertService.showConfirmModal(
      "¿Terminar turno?",
      "Completar todas las bitácoras activas y terminar turno. Esta acción no se puede revertir.",
      async () => {
        const success = await businessLogic.completeTurn(tabs);
        if (success) {
          setTimeout(() => {
            tabs.forEach(tab => {
              storageService.remove(`barcoData_${tab.id}`);
              storageService.remove(`bitacoraData_${tab.id}`);
              storageService.remove(`newOperacion_${tab.id}`);
            });
            storageService.remove("activeTab");
            storageService.remove("tabsList");
            storageService.remove("turnoInicio");
            storageService.remove("turnoFin");

            router.push("/proceso/iniciar");
          }, 2000);
        }
      },
      () => {},
      () => businessLogic.generateReport(tabs)
    );
  };

  const handleCancel = async () => {
    alertService.showConfirmModal(
      "¿Está seguro de cancelar?",
      "Se borrarán los datos del formulario y se eliminarán las bitácoras creadas.",
      async () => {
        const bitacorasToDelete = tabs.filter(tab => 
          tab.formData.bitacora.isCreated && 
          tab.formData.bitacora.id &&
          tab.formData.bitacora.estado !== EstadoBitacora.ELIMINADA
        );

        if (bitacorasToDelete.length > 0) {
          alertService.showLoading("Eliminando bitácoras...");

          for (const tab of bitacorasToDelete) {
            if (tab.formData.bitacora.id) {
              try {
                await apiService.deleteBitacora(tab.formData.bitacora.id);
              } catch (error) {
                console.error(`Error al eliminar bitácora ${tab.id}:`, error);
                // El error ya fue mostrado por showErrorAlert en ApiService
              }
            }
          }
          alertService.closeAlert();
        }

        tabs.forEach(tab => {
          storageService.remove(`barcoData_${tab.id}`);
          storageService.remove(`bitacoraData_${tab.id}`);
          storageService.remove(`newOperacion_${tab.id}`);
        });
        storageService.remove("activeTab");
        storageService.remove("tabsList");
        storageService.remove("turnoInicio");
        storageService.remove("turnoFin");
        
        router.push("/proceso/iniciar");
      }
    );
  };

  // =====================================================
  // EFECTOS
  // =====================================================

  useEffect(() => {
    if (initialized) return;
    
    const storedTabs = storageService.load<Tab[] | null>("tabsList", null);
    if (storedTabs && Array.isArray(storedTabs) && storedTabs.length > 0) {
      const restoredTabs = storedTabs.map(tab => {
        const barcoData = storageService.load<BarcoData>(`barcoData_${tab.id}`, tab.formData?.barco || createInitialFormData(storageService).barco);
        const bitacoraData = storageService.load<BitacoraData>(`bitacoraData_${tab.id}`, tab.formData?.bitacora || createInitialFormData(storageService).bitacora);
        
        if (!bitacoraData.estado || !Object.values(EstadoBitacora).includes(bitacoraData.estado)) {
          bitacoraData.estado = EstadoBitacora.CREADA;
        }
        
        return {
          ...tab,
          formData: {
            barco: barcoData,
            bitacora: bitacoraData
          }
        };
      });
      setTabs(restoredTabs);
      
      const storedActiveTab = storageService.load<number>("activeTab", restoredTabs[0].id);
      const validActiveTab = restoredTabs.find(t => t.id === storedActiveTab) ? storedActiveTab : restoredTabs[0].id;
      setActiveTab(validActiveTab);
    } else {
      createInitialTab();
    }
    setInitialized(true);
  }, [initialized]);

  useEffect(() => {
    if (!initialized || tabs.length === 0) return;
    storageService.save("tabsList", tabs);
  }, [tabs, initialized]);

  useEffect(() => {
    if (!initialized) return;
    storageService.save("activeTab", activeTab);
  }, [activeTab, initialized]);

  useEffect(() => {
    if (!initialized) return;
    
    const key = `newOperacion_${activeTab}`;
    const stored = storageService.load<Operacion | null>(key, null);
    
    if (stored && typeof stored === 'object') {
      setNewOperacion({ ...defaultOp, ...stored });
    } else {
      resetOperacion();
    }
  }, [activeTab, initialized]);

  useEffect(() => {
    if (!initialized) return;
    
    const operacionToSave: Operacion = {
      bodega: newOperacion.bodega,
      inicio: newOperacion.inicio,
      final: newOperacion.final,
      minutos: newOperacion.minutos,
      actividad: newOperacion.actividad,
    };
    
    storageService.save(`newOperacion_${activeTab}`, operacionToSave);
  }, [newOperacion, activeTab, initialized]);

  useEffect(() => {
    fetchBarcosList();
  }, []);

  useEffect(() => {
    if (activeFormData && initialized) {
      if (activeFormData.bitacora.turnoInicio) {
        storageService.save("turnoInicio", activeFormData.bitacora.turnoInicio);
      }
      if (activeFormData.bitacora.turnoFin) {
        storageService.save("turnoFin", activeFormData.bitacora.turnoFin);
      }
    }
  }, [activeFormData, initialized]);

  // =====================================================
  // RENDERIZADO
  // =====================================================

  if (!initialized) {
    return <Loader/>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="BITÁCORA DE OPERACIONES EN MUELLE Y ABORDO"
        onRefresh={handleRefreshClick}
        isRefreshing={isRefreshing}
        showRefreshButton={true}
      />

      <main className="max-w-4xl mx-auto p-2 space-y-6">
        
        {/* INFORMACIÓN DEL BARCO */}
        <section className="bg-white p-4 sm:p-6 rounded-lg shadow space-y-4 sm:space-y-6">
          
          {/* Estado de la bitácora */}
          {activeFormData && (
            <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded-lg">
              <div>
                <h3 className="font-semibold text-gray-800">Estado de la Bitácora</h3>
                <EstadoBadge estado={activeFormData.bitacora.estado} showDescription={true} />
              </div>
            </div>
          )}
          
          {/* Muelle y Barco */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-2">Barco</label>
              <Select
                name="valorMuelle"
                value={
                  activeFormData?.barco.valorMuelle
                    ? { value: activeFormData.barco.valorMuelle, label: activeFormData.barco.valorMuelle }
                    : null
                }
                onChange={(option: OptionType | null) => {
                  const e = {
                    target: {
                      value: option?.value || "",
                    },
                  };
                  handleChangeBoat(e);
                }}
                isDisabled={
                  loadingBoat || 
                  loadingBarcosList || 
                  (activeFormData?.bitacora.isCreated === true) ||
                  (activeFormData?.bitacora.estado === EstadoBitacora.ELIMINADA) ||
                  (activeFormData?.bitacora.estado === EstadoBitacora.COMPLETADA) ||
                  (!canAddMoreTabs() && !activeFormData?.barco.valorMuelle)
                }
                isLoading={barcosList.length === 0 || isRefreshing}
                options={getAvailableBarcos().map(boat => ({ value: boat.vaporBarco, label: boat.vaporBarco }))}
                placeholder={
                  activeFormData?.bitacora.estado === EstadoBitacora.ELIMINADA
                    ? "Bitácora eliminada"
                    : activeFormData?.bitacora.isCreated 
                    ? "Barco seleccionado (no se puede cambiar)"
                    : !canAddMoreTabs() && !activeFormData?.barco.valorMuelle
                    ? "No hay barcos disponibles"
                    : barcosList.length === 0 
                    ? "Cargando barcos..." 
                    : isRefreshing 
                    ? "Procesando solicitud..." 
                    : "Seleccione barco"
                }
                noOptionsMessage={() => {
                  if (barcosList.length === 0) return "Cargando barcos...";
                  if (!canAddMoreTabs()) return "Todos los barcos ya están en uso";
                  return "No hay barcos disponibles";
                }}
                className="react-select-container"
                classNamePrefix="react-select"
              />
              {activeFormData?.bitacora.isCreated && 
               activeFormData?.bitacora.estado !== EstadoBitacora.ELIMINADA && 
               activeFormData?.bitacora.estado !== EstadoBitacora.COMPLETADA && (
                <p className="text-sm text-gray-600 mt-1">
                  El barco no se puede cambiar una vez creada la bitácora
                </p>
              )}
            </div>
            <div>
              <label className="block font-semibold mb-2">Muelle</label>
              <input
                type="text"
                name="bValue"
                value={activeFormData?.barco.bValue || ""}
                onChange={handleChange}
                placeholder="B-4"
                className="w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                readOnly
              />
            </div>
          </div>

          {/* Resto del formulario solo si no está eliminada o completada */}
          {activeFormData?.bitacora.estado !== EstadoBitacora.ELIMINADA && 
           activeFormData?.bitacora.estado !== EstadoBitacora.COMPLETADA && (
            <>
              {/* Tipo de Carga & Sistema Utilizado */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                
                {/* Tipo de Carga */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                    <h3 className="font-semibold uppercase text-gray-700 text-center">TIPO DE CARGA</h3>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-3">
                      {["CEREALES", "AZÚCAR CRUDA", "CARBÓN", "MELAZA", "GRASA AMARILLA", "YESO"].map(tipo => (
                        <label key={tipo} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                          <input
                            type="checkbox"
                            value={tipo}
                            checked={activeFormData?.barco.tipoCarga.includes(tipo) || false}
                            onChange={e => handleCheckboxChange(e, "tipoCarga")}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            disabled
                          />
                          <span className="text-gray-700 select-none">{tipo}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sistema Utilizado */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                    <h3 className="font-semibold uppercase text-gray-700 text-center">SISTEMA UTILIZADO</h3>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-3">
                      {["UNIDAD DE CARGA", "SUCCIONADORA", "ALMEJA", "CHINGUILLOS", "EQUIPO BULHER", "ALAMBRE"].map(sistema => (
                        <label key={sistema} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                          <input
                            type="checkbox"
                            value={sistema}
                            checked={activeFormData?.barco.sistemaUtilizado.includes(sistema) || false}
                            onChange={e => handleCheckboxChange(e, "sistemaUtilizado")}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-gray-700 select-none">{sistema}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fechas y Horas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[
                  { label: "ARRIBO", fechaName: "arriboFecha", horaName: "arriboHora" },
                  { label: "ATRAQUE", fechaName: "atraqueFecha", horaName: "atraqueHora" },
                  { label: "RECIBIDO", fechaName: "recibidoFecha", horaName: "recibidoHora" },
                  { label: "INICIO OPERACIONES", fechaName: "inicioOperacionesFecha", horaName: "inicioOperacionesHora" },
                  { label: "FIN OPERACIONES", fechaName: "finOperacionesFecha", horaName: "finOperacionesHora" },
                ].map(({ label, fechaName, horaName }) => (
                  <div key={label} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h4 className="font-semibold mb-3 uppercase text-gray-700 text-center border-b border-gray-200 pb-2">
                      {label}
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block font-medium mb-1 text-gray-700">
                          Fecha
                        </label>
                        <input
                          type="date"
                          name={fechaName}
                          value={activeFormData?.barco[fechaName as keyof BarcoData] as string || ""}
                          onChange={handleChange}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-1 text-gray-700">
                          Hora
                        </label>
                        <input
                          type="time"
                          name={horaName}
                          value={activeFormData?.barco[horaName as keyof BarcoData] as string || ""}
                          onChange={handleChange}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botón para actualizar información del barco */}
              <div className="flex justify-center sm:justify-end pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleActualizarBarco}
                  className="w-full sm:w-auto bg-white text-blue-600 border border-blue-600 px-6 py-2.5 rounded-md hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 font-medium"
                >
                  Actualizar
                </button>
              </div>
            </>
          )}
        </section>

        {/* Mensaje para bitácoras completadas */}
        {activeFormData?.bitacora.estado === EstadoBitacora.COMPLETADA && (
          <section className="bg-green-50 border border-green-200 p-6 rounded-lg shadow">
            <div className="text-center">
              <div className="mb-4">
                <EstadoBadge estado={EstadoBitacora.COMPLETADA} showDescription={true} />
              </div>
              <h2 className="text-xl font-bold text-green-800 mb-2">
                Bitácora Completada Exitosamente
              </h2>
              <p className="text-green-700 mb-4">
                Esta bitácora fue completada el {activeFormData.bitacora.fechaCierre ? 
                  new Date(activeFormData.bitacora.fechaCierre).toLocaleString('es-ES', {
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
                  <span className="font-semibold">Barco:</span> {activeFormData.barco.valorMuelle}
                </div>
                <div className="bg-white p-3 rounded border">
                  <span className="font-semibold">Operaciones:</span> {activeFormData.bitacora.operaciones.length}
                </div>
                <div className="bg-white p-3 rounded border">
                  <span className="font-semibold">Turno:</span> {activeFormData.bitacora.turnoInicio} - {activeFormData.bitacora.turnoFin}
                </div>
                <div className="bg-white p-3 rounded border">
                  <span className="font-semibold">Muellero:</span> {activeFormData.bitacora.muellero}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECCIÓN DE BITÁCORA */}
        {activeFormData?.bitacora.estado !== EstadoBitacora.ELIMINADA &&
         activeFormData?.bitacora.estado !== EstadoBitacora.COMPLETADA && (
          <>
            <section className="bg-white p-6 rounded shadow">
              <h2 className="text-xl font-bold mb-4">Bitácoras</h2>
              
              {/* Información general de la bitácora */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
                <div>
                  <label className="block font-semibold mb-1">Fecha</label>
                  <input
                    type="date"
                    name="fecha"
                    value={activeFormData?.bitacora.fecha || ""}
                    onChange={handleChange}
                    className="w-full h-10 border rounded-sm px-2 whitespace-nowrap"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Muellero</label>
                  <input
                    type="text"
                    name="muellero"
                    readOnly
                    value={activeFormData?.bitacora.muellero || ""}
                    onChange={handleChange}
                    placeholder="Ej: Juan Pérez"
                    className="w-full h-10 border rounded-sm px-2 whitespace-nowrap"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Inicio Turno</label>
                  <input
                    type="time"
                    name="turnoInicio"
                    value={activeFormData?.bitacora.turnoInicio || ""}
                    onChange={handleChange}
                    className="w-full h-10 border rounded-sm px-2 whitespace-nowrap"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Termina Turno</label>
                  <input
                    type="time"
                    name="turnoFin"
                    value={activeFormData?.bitacora.turnoFin || ""}
                    onChange={handleChange}
                    className="w-full h-10 border rounded-sm px-2 whitespace-nowrap"
                  />
                </div>
              </div>
              
              {/* FORMULARIO DE NUEVA OPERACIÓN */}
              <div className="bg-white p-2 rounded shadow">
                <h2 className="font-semibold text-lg mb-4">Operaciones</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block font-semibold">Bodega</label>
                    <Select
                      className="react-select-container"
                      classNamePrefix="react-select"
                      options={bodegaOptions}
                      placeholder="-- Seleccione Bodega --"
                      value={bodegaOptions.find(opt => opt.value === newOperacion.bodega) || null}
                      onChange={(option: OptionType | null) => updateOperacion({ bodega: option ? option.value : "" })}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold">Hora Inicio</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        name="inicio"
                        value={newOperacion.inicio}
                        onChange={handleOperacionChange}
                        className="w-full h-10 border rounded-sm px-2 whitespace-nowrap"
                        step="1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const hora = now.toLocaleTimeString("en-GB", { hour12: false, timeZone: "America/El_Salvador" });
                          updateOperacion({ inicio: hora });
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md whitespace-nowrap"
                      >
                        Ahora
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold">Hora Final</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        name="final"
                        value={newOperacion.final}
                        onChange={handleOperacionChange}
                        className="w-full h-10 border rounded-sm px-2 whitespace-nowrap"
                        step="1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const hora = now.toLocaleTimeString("en-GB", { hour12: false, timeZone: "America/El_Salvador" });
                          updateOperacion({ final: hora });
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md whitespace-nowrap"
                      >
                        Ahora
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold">Minutos</label>
                    <input
                      type="text"
                      name="minutos"
                      value={newOperacion.minutos}
                      readOnly
                      className="w-full h-10 border rounded-sm px-2 bg-gray-50 whitespace-nowrap"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold">Actividad</label>
                    <CreatableSelect
                      className="react-select-container"
                      classNamePrefix="react-select"
                      options={actividadOptions}
                      placeholder="-- Seleccione o cree Actividad --"
                      value={actividadOptions.find(opt => opt.value === newOperacion.actividad) || null}
                      onChange={(option: OptionType | null) => updateOperacion({ actividad: option ? option.value : "" })}
                      onCreateOption={(inputValue: string) => {
                        const newOpt = { value: inputValue, label: inputValue };
                        setActividadOptions(prev => [...prev, newOpt]);
                        updateOperacion({ actividad: inputValue });
                      }}
                    />
                  </div>
                </div>
                
                {/* Botones de acción para operaciones */}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={addOrUpdateOperacion}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md whitespace-nowrap"
                  >
                    {editingIndex !== null ? (
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
                  {editingIndex !== null && (
                    <button
                      type="button"
                      onClick={resetOperacion}
                      className="flex items-center ml-2 gap-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md whitespace-nowrap"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* TABLA DE OPERACIONES */}
            <section className="bg-white p-6 rounded shadow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold uppercase">Bitácora de Operaciones</h2>
                <div className="text-sm text-gray-600">
                  {activeFormData?.bitacora.operaciones?.length || 0} operaciones registradas
                </div>
              </div>
              <div className="overflow-x-auto mb-3">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      {[
                        "Bodega",
                        "Inicio",
                        "Final",
                        "Minutos",
                        "Actividad",
                        "Acción",
                      ].map(h => (
                        <th key={h} className="border p-2">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeFormData?.bitacora.operaciones && activeFormData.bitacora.operaciones.length > 0 ? (
                      activeFormData.bitacora.operaciones.map((op, index) => (
                        <tr key={index} className="border-b text-center">
                          <td className="p-2 border whitespace-nowrap">{op.bodega}</td>
                          <td className="p-2 border whitespace-nowrap">{op.inicio}</td>
                          <td className="p-2 border whitespace-nowrap">{op.final}</td>
                          <td className="p-2 border whitespace-nowrap">{op.minutos}</td>
                          <td className="p-2 border whitespace-nowrap">{op.actividad}</td>
                          <td className="p-2 border text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditOperacion(index)}
                                title="Actualizar"
                                className="text-green-500 hover:text-green-700"
                              >
                                <FiEdit size={23} />
                              </button>
                              <button
                                onClick={() => deleteOperacion(index)}
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
                        <td colSpan={6} className="p-4 text-center text-gray-500">
                          No hay operaciones registradas
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* SECCIÓN DE OBSERVACIONES */}
              <div className="sm:col-span-2">
                <label className="block mb-1 font-semibold">Observaciones</label>
                <textarea
                  name="observaciones"
                  value={activeFormData?.bitacora.observaciones || ""}
                  onChange={handleChange}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-2 py-1 resize-y whitespace-nowrap"
                  placeholder="Escribe aquí..."
                />
              </div>
            </section>
          </>
        )}

        {/* NAVEGACIÓN DE PESTAÑAS */}
        <div className="p-2 border-t flex flex-wrap items-center justify-center gap-2">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`px-3 py-2 cursor-pointer rounded-md shadow-sm flex items-center gap-1 ${
                activeTab === tab.id ? "bg-blue-600 text-white" : "bg-gray-200 text-black hover:bg-gray-300"
              } ${tab.formData.bitacora.estado === EstadoBitacora.ELIMINADA ? "opacity-50" : ""} ${
                tab.formData.bitacora.estado === EstadoBitacora.COMPLETADA ? "opacity-75 bg-green-50 border-2 border-green-200" : ""
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              {/* Indicador de estado de bitácora */}
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${
                  tab.formData.bitacora.estado === EstadoBitacora.ELIMINADA 
                    ? 'bg-red-400'
                    : tab.formData.bitacora.estado === EstadoBitacora.COMPLETADA
                    ? 'bg-green-500'
                    : tab.formData.bitacora.estado === EstadoBitacora.EN_PROCESO 
                    ? 'bg-yellow-400'
                    : tab.formData.bitacora.isCreated 
                    ? 'bg-blue-400' 
                    : 'bg-gray-400'
                }`} title={ESTADO_FACTORIES[tab.formData.bitacora.estado].createConfig().description} />
                
                {/* Mostrar estado en texto para pestañas especiales */}
                {tab.formData.bitacora.estado === EstadoBitacora.ELIMINADA && (
                  <span className="text-xs text-red-600 ml-1">ELIMINADA</span>
                )}
                {tab.formData.bitacora.estado === EstadoBitacora.COMPLETADA && (
                  <span className="text-xs text-green-600 ml-1">COMPLETADA</span>
                )}
              </div>
              
              {tabs.length > 1 && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteTab(tab.id);
                  }}
                  className="flex items-center justify-center bg-white rounded-full p-0.5 text-red-500 shadow"
                  title="Eliminar pestaña"
                >
                  <FiTrash2 size={20} />
                </button>
              )}
            </div>
          ))}
          
          {/* Botón para agregar pestaña */}
          <button
            onClick={handleAddTab}
            disabled={!canAddMoreTabs()}
            className={`flex items-center justify-center p-2 rounded-full text-white transition-all duration-200 ${
              !canAddMoreTabs()
                ? 'bg-gray-400 cursor-not-allowed opacity-50' 
                : 'bg-green-500 hover:bg-green-600 hover:scale-105'
            }`}
            title={
              !canAddMoreTabs()
                ? `No se pueden agregar más pestañas (${getAllSelectedBarcos().length}/${barcosList.length} barcos en uso)`
                : `Agregar nueva pestaña (${getAvailableBarcos().length} barcos disponibles)`
            }
          >
            <FiPlus size={20} />
          </button>
        </div>

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