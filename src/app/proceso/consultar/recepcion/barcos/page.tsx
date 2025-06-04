"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  ChangeEvent,
  DragEvent,
  FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import dynamic from "next/dynamic";
import {
  FiArrowLeft,
  FiTrash2,
  FiRefreshCw,
  FiAnchor,
  FiBox,
  FiUpload,
} from "react-icons/fi";
import { FaFileExcel, FaPlus } from "react-icons/fa";
import { PiBarnFill, PiTruckTrailerBold } from "react-icons/pi";
import Loader from "@/components/Loader";
import DataTable from "@/components/DataTable";
import { showErrorAlert } from "@/lib/errorAlert";

// --- Modal Imports ---
import { BaseModal } from '@/components/modals/BaseModal';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { ViewModal, ViewField } from '@/components/modals/ViewModal';
import { CreateEditModal, FormField } from '@/components/modals/CreateEditModal';
import { TableModal, TableColumn } from '@/components/modals/TableModal';

// --- Constants: Fixed Options for Download Points ---
const descargaOptions: {
  label: string;
  options: { value: string; label: string }[];
}[] = [
  {
    label: "Bodegas",
    options: Array.from({ length: 6 }, (_, i) => ({
      value: `BODEGA ${i + 1}`,
      label: `BODEGA ${i + 1}`,
    })),
  },
  {
    label: "Silos",
    options: Array.from({ length: 17 }, (_, i) => ({
      value: `SILO ${i + 1}`,
      label: `SILO ${i + 1}`,
    })),
  },
  {
    label: "Modulos",
    options: [1, 2, 3].map((i) => ({
      value: `MODULO ${i}`,
      label: `MODULO ${i}`,
    })),
  },
  {
    label: "Otros",
    options: [
      { value: "BIN UPDP", label: "BIN UPDP" },
      { value: "BODEGA GENERAL 1", label: "BODEGA GENERAL 1" },
      { value: "BODEGA GENERAL 6", label: "BODEGA GENERAL 6" },
      { value: "PATIO FORTALEZA", label: "PATIO FORTALEZA" },
      { value: "PATIO HOLCIM", label: "PATIO HOLCIM" },
      { value: "RANCHON", label: "RANCHON" },
      { value: "NO APLICA", label: "NO APLICA" }
    ],
  },
];

// --- TypeScript Interfaces ---
interface Bitacora {
  uid?: string;
  nombre: string;
  placa: string;
}

interface TransportSheet {
  uid: string;
  sheetName: string;
  empresa: string;
  rows: Bitacora[];
}

interface Transporte {
  id: number;
  nombre: string;
  motoristas: Bitacora[];
  activo: boolean;
  fechaRegistro: string;
}

interface TransportesResponse {
  data: {
    empresas: Transporte[];
    totalCount: number;
  };
}

interface Barco {
  id: number;
  vaporBarco: string;
  observaciones: string;
  productos: string[];
  puntosDescarga: string[];
  transportes: { id: number; nombre: string }[];
  activo: boolean;
  fechaRegistro: string;
}

interface BarcosResponse {
  data: {
    barcos: Barco[];
    totalCount: number;
  };
}

interface Producto {
  id: number;
  nombre: string;
  descripcion: string;
}

interface ProductosResponse {
  data: {
    productos: Producto[];
  };
}

// --- Helper Functions ---
// Debounce to limit rapid calls
function debounce<T extends (...args: any[]) => void>(func: T, wait: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
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

// --- Main Component ---
export default function BarcoProductoManagement() {
  const router = useRouter();

  // --- UI State: Tabs & Loading ---
  const [activeTab, setActiveTab] = useState<
    "barcos" | "productos" | "transportes"
  >("barcos");
  const [allLoaded, setAllLoaded] = useState<boolean>(false);

  // --- State: Confirmation Modal ---
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => () => {});
  const [confirmConfig, setConfirmConfig] = useState({
    title: '',
    message: '',
    type: 'warning' as 'danger' | 'warning' | 'info'
  });

  // --- State: Barcos ---
  const [barcos, setBarcos] = useState<Barco[]>([]);
  const [loadingBarcos, setLoadingBarcos] = useState<boolean>(false);
  const [barcoInput, setBarcoInput] = useState<string>("");
  const [barcoSearchQuery, setBarcoSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);

  // --- State: Productos ---
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState<boolean>(false);
  const [productoInput, setProductoInput] = useState<string>("");
  const [productoSearchQuery, setProductoSearchQuery] = useState<string>("");

  // --- State: Transportes (List & Pagination) ---
  const [pageTrans, setPageTrans] = useState<number>(1);
  const [limitTrans, setLimitTrans] = useState<number>(10);
  const [totalCountTrans, setTotalCountTrans] = useState<number>(0);
  const [loadingExistingTrans, setLoadingExistingTrans] = useState<boolean>(false);
  const [existingTransportes, setExistingTransportes] = useState<Transporte[]>([]);
  const [transportesOptions, setTransportesOptions] = useState<
    { value: number; label: string }[]
  >([]);

  // --- State: Excel Upload & Preview ---
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [transportSheets, setTransportSheets] = useState<TransportSheet[]>([]);
  const [isTransportUploadModalOpen, setIsTransportUploadModalOpen] =
    useState<boolean>(false);

  // --- State: View & Edit Transportes ---
  const [isTransportViewModalOpen, setIsTransportViewModalOpen] =
    useState<boolean>(false);
  const [selectedTransportView, setSelectedTransportView] =
    useState<Transporte | null>(null);
  const [isTransportEditModalOpen, setIsTransportEditModalOpen] =
    useState<boolean>(false);
  const [editTransportForm, setEditTransportForm] = useState<{
    id: number | null;
    empresa: string;
    motoristas: Bitacora[];
    activo: boolean;
    fechaRegistro: string;
  }>({ id: null, empresa: "", motoristas: [], activo: true, fechaRegistro: ""  });

  // --- State: Barco Create/Edit Modals ---
  const [isCreateBarcoModalOpen, setIsCreateBarcoModalOpen] =
    useState<boolean>(false);
  const [isEditBarcoModalOpen, setIsEditBarcoModalOpen] =
    useState<boolean>(false);
  const [isBarcoDetailModalOpen, setIsBarcoDetailModalOpen] =
    useState<boolean>(false);
  const [selectedBarcoDetail, setSelectedBarcoDetail] = useState<Barco | null>(
    null
  );

  const [createBarcoForm, setCreateBarcoForm] = useState<Omit<Barco, "id">>({
    vaporBarco: "",
    observaciones: "",
    productos: [],
    puntosDescarga: [],
    transportes: [],
    activo: true,
    fechaRegistro: "",
  });
  const [editBarcoForm, setEditBarcoForm] = useState<Barco>({
    id: null as any,
    vaporBarco: "",
    observaciones: "",
    productos: [],
    puntosDescarga: [],
    transportes: [],
    activo: true,
    fechaRegistro: "",
  });

  // --- State: Producto Create/Edit Modals ---
  const [isCreateProductoModalOpen, setIsCreateProductoModalOpen] =
    useState<boolean>(false);
  const [isEditProductoModalOpen, setIsEditProductoModalOpen] =
    useState<boolean>(false);
  const [isProductoDetailModalOpen, setIsProductoDetailModalOpen] =
    useState<boolean>(false);
  const [selectedProductoDetail, setSelectedProductoDetail] =
    useState<Producto | null>(null);
  const [createProductoForm, setCreateProductoForm] = useState<{
    nombre: string;
    descripcion: string;
  }>({
    nombre: "",
    descripcion: "",
  });
  const [editProductoForm, setEditProductoForm] = useState<{
    id: number | null;
    nombre: string;
    descripcion: string;
  }>({
    id: null,
    nombre: "",
    descripcion: "",
  });

  // --- Effects: Debounced Search Queries ---
  useEffect(() => {
    const h = setTimeout(() => {
      setBarcoSearchQuery(barcoInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(h);
  }, [barcoInput]);

  useEffect(() => {
    const h = setTimeout(() => {
      setProductoSearchQuery(productoInput);
    }, 500);
    return () => clearTimeout(h);
  }, [productoInput]);

  // --- Derived Data for Rendering ---
  const filteredBarcos = barcos;
  const filteredProductos = productos.filter((p) =>
    p.nombre.toLowerCase().includes(productoSearchQuery.toLowerCase())
  );
  const productoOptions = productos.map((p) => ({ value: p.nombre, label: p.nombre }));

  // --- Modal Configuration ---
  // Función para mostrar modal de confirmación
  const showConfirmDialog = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    type: 'danger' | 'warning' | 'info' = 'warning'
  ) => {
    setConfirmConfig({ title, message, type });
    setConfirmAction(() => onConfirm);
    setConfirmModalOpen(true);
  };

  const handleConfirmClose = () => {
    setConfirmModalOpen(false);
    setConfirmAction(() => () => {});
  };

  // Campos para ViewModal de Barco
  const barcoViewFields: ViewField[] = [
    { key: 'vaporBarco', label: 'Vapor Barco', type: 'text', value: '' },
    { key: 'fechaRegistro', label: 'Fecha Registro', type: 'date', value: '' },
    { key: 'observaciones', label: 'Observaciones', type: 'textarea', value: '', fullWidth: true },
    { 
      key: 'productos', 
      label: 'Productos', 
      type: 'array',
      value: [],
      fullWidth: true 
    },
    { 
      key: 'puntosDescarga', 
      label: 'Puntos de Descarga', 
      type: 'array',
      value: [],
      fullWidth: true 
    },
    { 
      key: 'transportes', 
      label: 'Transportes', 
      type: 'object',
      value: [],
      fullWidth: true,
      render: (value) => Array.isArray(value) ? value.map(t => t.nombre).join(', ') : ''
    },
    { key: 'activo', label: 'Activo', type: 'boolean', value: false }
  ];

  // Campos para CreateEditModal de Barco
  const barcoFormFields: FormField[] = [
    {
      key: 'vaporBarco',
      label: 'Vapor Barco',
      type: 'text',
      required: true,
      placeholder: 'Ingrese el nombre del barco'
    },
    {
      key: 'observaciones',
      label: 'Observaciones',
      type: 'textarea',
      placeholder: 'Observaciones adicionales',
      rows: 3,
      fullWidth: true
    },
    {
      key: 'productos',
      label: 'Productos',
      type: 'multiselect',
      options: productoOptions,
      placeholder: 'Selecciona productos...',
      fullWidth: true
    },
    {
      key: 'puntosDescarga',
      label: 'Puntos de Descarga',
      type: 'multiselect',
      options: descargaOptions,
      placeholder: 'Selecciona puntos...',
      fullWidth: true
    },
    {
      key: 'transportes',
      label: 'Transportes',
      type: 'multiselect',
      options: transportesOptions,
      placeholder: 'Selecciona transportes...',
      fullWidth: true
    }
  ];

  // Campos para ViewModal de Producto
  const productoViewFields: ViewField[] = [
    { key: 'nombre', label: 'Nombre', type: 'text', value: '' },
    { key: 'descripcion', label: 'Descripción', type: 'text', value: '', fullWidth: true }
  ];

  // Campos para CreateEditModal de Producto
  const productoFormFields: FormField[] = [
    {
      key: 'nombre',
      label: 'Nombre',
      type: 'text',
      required: true,
      placeholder: 'Nombre del producto'
    },
    {
      key: 'descripcion',
      label: 'Descripción',
      type: 'text',
      placeholder: 'Descripción del producto',
      fullWidth: true
    }
  ];

  // Campos para ViewModal de Transporte
  const transporteViewFields: ViewField[] = [
    { key: 'nombre', label: 'Empresa', type: 'text', value: '' },
    { key: 'fechaRegistro', label: 'Fecha Registro', type: 'date', value: '' },
    { key: 'activo', label: 'Activo', type: 'boolean', value: false },
    { 
      key: 'motoristas', 
      label: 'Motoristas', 
      type: 'object',
      value: [],
      fullWidth: true,
      render: (motoristas) => (
        <div className="space-y-2">
          {Array.isArray(motoristas) && motoristas.map((m, i) => (
            <div key={i} className="flex space-x-2 p-2 bg-gray-50 rounded">
              <span className="font-medium">{m.nombre}</span>
              <span className="text-gray-600">- {m.placa}</span>
            </div>
          ))}
        </div>
      )
    }
  ];

  // Columnas para TableModal de Transportes
  const transporteTableColumns: TableColumn[] = [
    {
      key: 'nombre',
      label: 'Nombre Motorista',
      type: 'text',
      required: true
    },
    {
      key: 'placa',
      label: 'Placa',
      type: 'text',
      required: true
    }
  ];

  // --- Fetch Functions ---

  /** Fetch Barcos with pagination and search */
  const fetchBarcos = async () => {
    setLoadingBarcos(true);
    try {
      const pageParam = page < 1 ? 1 : page;
      const res = await fetch(
        `/api/v1/recepcion/barcos?activo=all&page=${pageParam}&limit=${limit}&search=${encodeURIComponent(
          barcoSearchQuery
        )}`
      );
      const data: BarcosResponse = await res.json();
      setBarcos(data.data.barcos || []);
      setTotalCount(data.data.totalCount || 0);
    } catch(error) {
      console.log(error);
      showError("Error al obtener barcos", "Error fetching barcos");
    }
    setLoadingBarcos(false);
  };

  /** Fetch Productos */
  const fetchProductos = async () => {
    setLoadingProductos(true);
    try {
      const res = await fetch("/api/v1/recepcion/productos");
      const data: ProductosResponse = await res.json();
      setProductos(data.data.productos || []);
    } catch(error) {
      console.log(error);
      showError("Error al obtener productos", "Error fetching productos");
    }
    setLoadingProductos(false);
  };

  /** Fetch all transportes (all statuses) with pagination */
  const fetchAllTransportes = async (pg = pageTrans, lim = limitTrans) => {
    setLoadingExistingTrans(true);
    try {
      const res = await fetch(
        `/api/v1/recepcion/transportes?activo=all&page=${pg}&limit=${lim}`
      );
      const data: TransportesResponse = await res.json();
      setExistingTransportes(data.data.empresas || []);
      setTotalCountTrans(data.data.totalCount || 0);
    } catch(error) {
      console.log(error);
      showError("Error al obtener transportes", "Error fetching transportes");
    }
    setLoadingExistingTrans(false);
  };

  /** Fetch only active transportes for selection */
  const fetchActiveTransportes = async () => {
    try {
      const res = await fetch("/api/v1/recepcion/transportes?activo=true");
      const data: TransportesResponse = await res.json();
      setTransportesOptions(
        (data.data.empresas || []).map((t) => ({ value: t.id, label: t.nombre }))
      );
    } catch(error) {
      console.log(error);
      showError("Error al obtener transportes activos", "Error fetching active transportes");
    }
  };

  // Sync active transport options when list changes
  useEffect(() => {
    setTransportesOptions(
      existingTransportes
        .filter((t) => t.activo)
        .map((t) => ({ value: t.id, label: t.nombre }))
    );
  }, [existingTransportes]);

  // Refresh all data and show toast success or error
  const refreshData = async () => {
    try {
      await Promise.all([
        fetchBarcos(),
        fetchProductos(),
        fetchAllTransportes(),
        fetchActiveTransportes(),
      ]);
      toastSuccess("Datos actualizados");
    } catch(error) {
      console.log(error);
      showError("No se pudieron actualizar los datos");
    }
  };

  // Initial load and dependencies
  useEffect(() => {
    fetchBarcos();
    fetchProductos();
    fetchAllTransportes();
    fetchActiveTransportes();
  }, [page, limit, barcoSearchQuery]);

  useEffect(() => {
    fetchAllTransportes(pageTrans, limitTrans);
  }, [pageTrans, limitTrans]);

  useEffect(() => {
    (async () => {
      await Promise.all([
        fetchBarcos(),
        fetchProductos(),
        fetchAllTransportes(),
        fetchActiveTransportes(),
      ]);
      setAllLoaded(true);
    })();
  }, []);

  // --- Handlers: Excel Upload & Preview ---

  /** Handle file input change */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  /** Handle file drag and drop */
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, []);

  /** Process uploaded Excel file */
  const processFile = async (file: File) => {
    if (!file.name.endsWith(".xlsx")) {
      return showError("Solo archivos Excel (.xlsx) permitidos");
    }
    const form = new FormData();
    form.append("file", file);

    Swal.fire({
      title: "Procesando archivo...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const res = await fetch("/api/v1/transportes", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        Swal.close();
        setIsTransportUploadModalOpen(false);
        setTransportSheets([]);
        return showError(data.error || "Error al procesar archivo, intente de nuevo");

      }
      const { sheets }: { sheets: { sheetName: string; rows: any[] }[] } = data;
      Swal.close();
      setIsTransportUploadModalOpen(true);
      setTransportSheets(
        sheets.map((s) => ({
          uid: crypto.randomUUID(),
          sheetName: s.sheetName,
          empresa: s.sheetName,
          rows: s.rows.map((r) => ({
            uid: crypto.randomUUID(),
            nombre: r.nombre || "",
            placa: r.placa || "",
          })),
        }))
      );
    } catch(error) {
      console.log(error);
      Swal.close();
      setIsTransportUploadModalOpen(false);
      setTransportSheets([]);
      showError("Error al procesar archivo, intente de nuevo");
    }
  };

  // --- Handlers: TransportSheets Editing ---

  const updateEmpresa = (uid: string, name: string) =>
    setTransportSheets((ts) =>
      ts.map((s) => (s.uid === uid ? { ...s, empresa: name } : s))
    );

  const updateRow = (sUid: string, rUid: string, f: keyof Bitacora, v: string) =>
    setTransportSheets((ts) =>
      ts.map((s) =>
        s.uid !== sUid
          ? s
          : {
              ...s,
              rows: s.rows.map((r) => (r.uid === rUid ? { ...r, [f]: v } : r)),
            }
      )
    );

  const addRow = (sUid: string) =>
    setTransportSheets((ts) =>
      ts.map((s) =>
        s.uid !== sUid
          ? s
          : {
              ...s,
              rows: [...s.rows, { uid: crypto.randomUUID(), nombre: "", placa: "" }],
            }
      )
    );

  const removeRow = (sUid: string, rUid: string) =>
    setTransportSheets((ts) =>
      ts.map((s) =>
        s.uid !== sUid ? s : { ...s, rows: s.rows.filter((r) => r.uid !== rUid) }
      )
    );

  const removeSheet = (uid: string) => {
    setTransportSheets((ts) => {
      const newSheets = ts.filter((s) => s.uid !== uid);
      if (newSheets.length === 0) setIsTransportUploadModalOpen(false);
      return newSheets;
    });
  };

  /** Save transportes from sheets */
  const handleSaveTransportes = async () => {
    const totalRows = transportSheets.reduce((sum, s) => sum + s.rows.length, 0);
    if (totalRows === 0) {
      return showError("No hay filas, por favor carga de nuevo el archivo");
    }
    Swal.fire({
      title: "Procesando solicitud...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const now = new Date().toLocaleString("en-CA", {
        timeZone: "America/El_Salvador",
        year:   "numeric",
        month:  "2-digit",
        day:    "2-digit",
        hour:   "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const payload = transportSheets.map(({ empresa, rows }) => ({
        nombre: empresa,
        motoristas: rows.map(({ nombre, placa }) => ({ nombre, placa })),
        fechaRegistro: now,
      }));
      const res = await fetch("/api/v1/recepcion/transportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
      Swal.close();
      toastSuccess("Transporte registrado");
      setTransportSheets([]);
      setIsTransportUploadModalOpen(false);
      fetchAllTransportes();
      fetchActiveTransportes();
      }
      else{
        const err = await res.json();
        await showErrorAlert(err || "No se pudo registrar transportes");
        return;
      }
    } catch(error) {
      console.log(error);
      Swal.close();
      showError("No se pudo registrar transportes");
    }
  };

  // --- Handlers: View/Edit Transport Modal ---

  const openTransportViewModal = (t: Transporte) => {
    setSelectedTransportView(t);
    setIsTransportViewModalOpen(true);
  };

  const openTransportEditModal = (t: Transporte) => {
    setEditTransportForm({
      id: t.id,
      empresa: t.nombre,
      motoristas: t.motoristas.map((m) => ({ ...m })),
      activo: t.activo,
      fechaRegistro: t.fechaRegistro,
    });
    setIsTransportEditModalOpen(true);
  };

  const handleEditTransportChange = (
    field: keyof typeof editTransportForm,
    value: any
  ) => setEditTransportForm((p) => ({ ...p, [field]: value }));

  /** Save transport edit */
  const handleSaveTransportEdit = async () => {
    const { id, empresa, motoristas, activo, fechaRegistro } = editTransportForm;
    Swal.fire({
      title: "Procesando solicitud...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const res = await fetch(`/api/v1/recepcion/transportes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: empresa, motoristas, activo, fechaRegistro }),
      });
      if (res.ok) {
      Swal.close();
      toastSuccess("Transporte actualizado");
      setIsTransportEditModalOpen(false);
      fetchAllTransportes();
      fetchActiveTransportes();
      }else{
        const err = await res.json();
        await showErrorAlert(err, "No se pudo actualizar el transporte");
        return;
      }
    } catch(error) {
      console.log(error);
      showError("No se pudo actualizar el transporte");
    }
  };

  /** Delete transport with confirmation */
  const handleDeleteTransport = (id: number) => {
    showConfirmDialog(
      'Confirmar eliminación',
      'Esta acción no se puede deshacer. ¿Estás seguro de que deseas eliminar este transporte?',
      async () => {
        try {
          const res = await fetch(`/api/v1/recepcion/transportes/${id}`, {
            method: "DELETE",
          });
          if (res.ok) {
            toastSuccess("Transporte eliminado");
            fetchAllTransportes();
            fetchActiveTransportes();
            handleConfirmClose();
          } else {
            const err = await res.json();
            await showErrorAlert(err, "No se pudo eliminar transporte");
          }
        } catch(error) {
          console.log(error);
          showError("No se pudo eliminar transporte");
        }
      },
      'danger'
    );
  };

  // --- Handlers: Toggle Active States ---

  /** Toggle active state for transporte and clear form */
  const handleToggleActivo = async (t: Transporte) => {
    const newActivo = !t.activo;
    const payload = { 
      id: t.id, 
      nombre: t.nombre, 
      motoristas: t.motoristas, 
      activo: newActivo,
      fechaRegistro: t.fechaRegistro
    };
    try {
      const res = await fetch(`/api/v1/recepcion/transportes/${t.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchAllTransportes();
        await fetchActiveTransportes();
        toastSuccess(`Transporte ${newActivo ? "activado" : "desactivado"}`);
        // Clear edit form if editing the same transporte
        if (editTransportForm.id === t.id) {
          setEditTransportForm({ id: null, empresa: "", motoristas: [], activo: true, fechaRegistro: "" });
          setIsTransportEditModalOpen(false);
        }
      } else {
        const err = await res.json();
        await showErrorAlert(err, "No se pudo actualizar el transporte");
        return;
      }
    } catch(error) {
      console.log(error);
      showError("No se pudo actualizar el transporte");
    }
  };

  /** Toggle active state for barco and reset related forms */
  const handleToggleBarcoActivo = async (b: Barco) => {
    const newActivo = !b.activo;
    const payload = {
      id: b.id,
      vaporBarco: b.vaporBarco,
      productos: b.productos,
      puntosDescarga: b.puntosDescarga,
      transportes: b.transportes,
      observaciones: b.observaciones,
      activo: newActivo,
      fechaRegistro: b.fechaRegistro,
    };
    try {
      const res = await fetch(`/api/v1/recepcion/barcos/${b.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchBarcos();
        toastSuccess(`Barco ${newActivo ? "activado" : "desactivado"}`);

        // Reset forms if editing this barco
        if (editBarcoForm.id === b.id) {
          setEditBarcoForm({
            id: null as any,
            vaporBarco: "",
            observaciones: "",
            productos: [],
            puntosDescarga: [],
            transportes: [],
            activo: true,
            fechaRegistro: "",
          });
          setIsEditBarcoModalOpen(false);
        }
      } else {
        const err = await res.json();
        await showErrorAlert(err, "No se pudo actualizar el barco");
        return;
      }
    } catch(error) {
      console.log(error);
      showError("No se pudo actualizar el barco");
    }
  };

  // --- Handlers: Barco Create/Edit/Delete ---

  /** Open create barco modal and reset form */
  const openCreateBarcoModal = () => {
    const now = new Date().toLocaleString("en-CA", {
      timeZone: "America/El_Salvador",
      year:   "numeric",
      month:  "2-digit",
      day:    "2-digit",
      hour:   "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    setCreateBarcoForm({
      vaporBarco: "",
      observaciones: "",
      productos: [],
      puntosDescarga: [],
      transportes: [],
      activo: true,
      fechaRegistro: now,
    });
    setIsCreateBarcoModalOpen(true);
  };

  // Handlers para cambios en los formularios con modales estandarizados
  const handleCreateBarcoFieldChange = (key: string, value: any) => {
    if (key === 'transportes') {
      // Transformar IDs a objetos completos para la API
      const transportObjs = transportesOptions
        .filter(t => value.includes(t.value))
        .map(t => ({ id: t.value, nombre: t.label }));
      setCreateBarcoForm(prev => ({ ...prev, transportes: transportObjs }));
    } else {
      setCreateBarcoForm(prev => ({ ...prev, [key]: value }));
    }
  };

  const handleEditBarcoFieldChange = (key: string, value: any) => {
    if (key === 'transportes') {
      // Transformar IDs a objetos completos para la API
      const transportObjs = transportesOptions
        .filter(t => value.includes(t.value))
        .map(t => ({ id: t.value, nombre: t.label }));
      setEditBarcoForm(prev => ({ ...prev, transportes: transportObjs }));
    } else {
      setEditBarcoForm(prev => ({ ...prev, [key]: value }));
    }
  };

  /** Submit create barco form */
  const handleCreateBarcoSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!createBarcoForm.vaporBarco?.trim()) {
      showError("El nombre del barco es requerido");
      return;
    }
    
    Swal.fire({
      title: "Procesando solicitud...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const res = await fetch("/api/v1/recepcion/barcos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBarcoForm),
      });
      if (res.ok) {
        await refreshData();
        setIsCreateBarcoModalOpen(false);
        Swal.close();
        toastSuccess("Barco registrado");
      } else {
        const err = await res.json();
        Swal.close();
        await showErrorAlert(err, "No se pudo registrar el barco");
        return;
      }
    } catch(error) {
      console.log(error);
      Swal.close();
      showError("No se pudo registrar el barco");
    }
  };

  /** Open edit barco modal and filter related products and transportes */
  const openEditBarcoModal = (b: Barco) => {
    // Filter out deleted products & transports
    const existingProductoValues = productoOptions.map((opt) => opt.value);
    const filteredProductosEnForm = Array.isArray(b.productos)
      ? b.productos.filter((prod) => existingProductoValues.includes(prod))
      : [];
    const existingTransIds = existingTransportes.map((t) => t.id);
    const filteredTransportesEnForm = Array.isArray(b.transportes)
      ? b.transportes.filter((t) => existingTransIds.includes(t.id))
      : [];

    setEditBarcoForm({
      id: b.id,
      vaporBarco: b.vaporBarco,
      observaciones: b.observaciones || "",
      productos: filteredProductosEnForm,
      puntosDescarga: Array.isArray(b.puntosDescarga) ? b.puntosDescarga : [],
      transportes: filteredTransportesEnForm,
      activo: b.activo,
      fechaRegistro: b.fechaRegistro,
    });
    setIsEditBarcoModalOpen(true);
  };

  /** Submit edit barco form */
  const handleEditBarcoSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!editBarcoForm.vaporBarco?.trim()) {
      showError("El nombre del barco es requerido");
      return;
    }
    
    Swal.fire({
      title: "Procesando solicitud...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    const { id, ...payload } = editBarcoForm;
    try {
      const res = await fetch(`/api/v1/recepcion/barcos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
      await refreshData();
      setIsEditBarcoModalOpen(false);
      Swal.close();
      toastSuccess("Barco actualizado");
      }
      else {
        const err = await res.json();
        Swal.close();
        await showErrorAlert(err, "No se pudo actualizar el barco");
        return;
      }
    } catch(error) {
      console.log(error);
      Swal.close();
      showError("No se pudo actualizar el barco");
    }
  };

  /** Delete barco with confirmation */
  const handleDeleteBarco = (id: number) => {
    showConfirmDialog(
      'Confirmar eliminación',
      'Esta acción no se puede deshacer. ¿Estás seguro de que deseas eliminar este barco?',
      async () => {
        try {
          const res = await fetch(`/api/v1/recepcion/barcos/${id}`, {
            method: "DELETE",
          });
          if (res.ok) {
            await refreshData();
            toastSuccess("Barco eliminado");
            handleConfirmClose();
          } else {
            const data = await res.json().catch(() => ({}));
            await showErrorAlert(data, "No se pudo eliminar el barco");
          }
        } catch(error) {
          console.log(error);
          showError("No se pudo eliminar el barco");
        }
      },
      'danger'
    );
  };

  // --- Handlers: Producto Create/Edit/Delete ---

  const openCreateProductoModal = () => {
    setCreateProductoForm({ nombre: "", descripcion: "" });
    setIsCreateProductoModalOpen(true);
  };

  const handleCreateProductoFieldChange = (key: string, value: any) => {
    setCreateProductoForm(prev => ({ ...prev, [key]: value }));
  };

  /** Submit create producto form */
  const handleCreateProductoSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!createProductoForm.nombre?.trim()) {
      showError("El nombre del producto es requerido");
      return;
    }
    
    Swal.fire({
      title: "Procesando solicitud...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const res = await fetch("/api/v1/recepcion/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createProductoForm),
      });
      if (res.ok) {
        await refreshData();
        setIsCreateProductoModalOpen(false);
        Swal.close();
        toastSuccess("Producto registrado");
      } else {
        const err = await res.json();
        Swal.close();
        await showErrorAlert(err, "No se pudo registrar el producto");
        return;
      }
    } catch(error) {
      console.log(error);
      Swal.close();
      showError("No se pudo registrar el producto");
    }
  };

  const openEditProductoModal = (p: Producto) => {
    setEditProductoForm({ id: p.id, nombre: p.nombre, descripcion: p.descripcion });
    setIsEditProductoModalOpen(true);
  };

  const handleEditProductoFieldChange = (key: string, value: any) => {
    setEditProductoForm(prev => ({ ...prev, [key]: value }));
  };

  /** Submit edit producto form */
  const handleEditProductoSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!editProductoForm.nombre?.trim()) {
      showError("El nombre del producto es requerido");
      return;
    }
    
    Swal.fire({
      title: "Procesando solicitud...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    const { id, ...payload } = editProductoForm;
    try {
      const res = await fetch(`/api/v1/recepcion/productos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
      await refreshData();
      setIsEditProductoModalOpen(false);
      Swal.close();
      toastSuccess("Producto actualizado");
      }
      else {
        const err = await res.json();
        Swal.close();
        await showErrorAlert(err, "No se pudo actualizar el producto");
        return;
      }
    } catch(error) {
       console.log(error);
       Swal.close();
       showError("No se pudo actualizar el producto");
    }
  };

  /** Delete producto with confirmation */
  const handleDeleteProducto = (id: number) => {
    showConfirmDialog(
      'Confirmar eliminación',
      'Esta acción no se puede deshacer. ¿Estás seguro de que deseas eliminar este producto?',
      async () => {
        try {
          const res = await fetch(`/api/v1/recepcion/productos/${id}`, {
            method: "DELETE",
          });
          if (res.ok) {
            await refreshData();
            toastSuccess("Producto eliminado");
            handleConfirmClose();
          } else {
            const err = await res.json();
            await showErrorAlert(err, "No se pudo eliminar el producto");
          }
        } catch(error) {
          console.log(error);
          showError("No se pudo eliminar el producto");
        }
      },
      'danger'
    );
  };

  // --- Pagination Derived Values ---
  const totalPages = Math.ceil(totalCount / limit);

  // --- Render Loader if still loading initial data ---
  if (!allLoaded) return <Loader />;

  // --- Main JSX ---
  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER */}
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
              <h1 className="text-xl font-bold">Barcos en Recepción</h1>
            </div>
            <div className="grid grid-cols-2 md:flex md:flex-row items-center mt-4 md:mt-0 gap-3">
              <button
                onClick={() => router.push("/proceso/consultar/recepcion")}
                className="bg-orange-600 hover:bg-orange-700 px-3 py-2 rounded flex items-center"
              >
                <PiBarnFill className="mr-1" /> Bitacoras
              </button>
              <button
                onClick={refreshData}
                className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded flex items-center"
              >
                <FiRefreshCw className="mr-2 animate-spin-slow" /> Actualizar
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="container mx-auto px-4 py-6">
        {/* TABS */}
        <nav className="flex space-x-6 mb-4 border-b">
          <button
            onClick={() => setActiveTab("barcos")}
            className={`flex items-center space-x-1 pb-1 border-b-2 transition-all duration-300 ${
              activeTab === "barcos"
                ? "text-blue-600 border-blue-600"
                    : "text-gray-500 border-transparent hover:text-blue-600 hover:border-blue-600"
            }`}
          >
            <FiAnchor className="inline mr-1" /> Barcos
          </button>
          <button
            onClick={() => setActiveTab("productos")}
            className={`flex items-center space-x-1 pb-1 border-b-2 transition-all duration-300 ${
              activeTab === "productos"
                ? "text-blue-600 border-blue-600"
                    : "text-gray-500 border-transparent hover:text-blue-600 hover:border-blue-600"
            }`}
          >
            <FiBox className="inline mr-1" /> Productos
          </button>
          <button
            onClick={() => setActiveTab("transportes")}
            className={`flex items-center space-x-1 pb-1 border-b-2 transition-all duration-300 ${
              activeTab === "transportes"
                ? "text-blue-600 border-blue-600"
                    : "text-gray-500 border-transparent hover:text-blue-600 hover:border-blue-600"
            }`}
          >
            <PiTruckTrailerBold className="inline mr-1" /> Transportes
          </button>
        </nav>

        {/* BARCOS SECTION */}
        {activeTab === "barcos" && (
          <section className="bg-white p-4 rounded-lg shadow space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-semibold">Barcos</h2>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Buscar barcos..."
                  value={barcoInput}
                  onChange={(e) => setBarcoInput(e.target.value)}
                  className="w-full sm:max-w-xs border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  onClick={openCreateBarcoModal}
                  className="w-full sm:w-auto flex items-center justify-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-md transition"
                >
                  <FaPlus className="mr-2" />
                  Agregar
                </button>
              </div>
            </div>

            <DataTable
              data={filteredBarcos}
              columns={[
                { key: "fechaRegistro", label: "Fecha" },
                {
                  key: "vaporBarco",
                  label: "Vapor Barco",
                  align: "left",
                  noWrap: true,
                },
                {
                  key: "productos",
                  label: "Producto(s)",
                  align: "left",
                  render: (value) => (Array.isArray(value) ? value.join(", ") : value),
                  noWrap: true,
                },
                {
                  key: "puntosDescarga",
                  label: "Puntos Descarga",
                  align: "left",
                  render: (value) => (Array.isArray(value) ? value.join(", ") : value),
                  noWrap: true,
                },
                {
                  key: "transportes",
                  label: "Transportes",
                  align: "left",
                  render: (value) =>
                    Array.isArray(value) ? value.map((t) => t.nombre).join(", ") : value,
                  noWrap: true,
                },
                {
                  key: "activo",
                  label: "Activo",
                  align: "center" as const,
                  type: "checkbox" as const,
                  onCheckboxChange: (row: Barco) => handleToggleBarcoActivo(row),
                  noWrap: true,
                },
              ]}
              actions={[
                {
                  type: "view",
                  onClick: (row) => {
                    setSelectedBarcoDetail(row);
                    setIsBarcoDetailModalOpen(true);
                  },
                },
                { type: "edit", onClick: (row) => openEditBarcoModal(row) },
                { type: "delete", onClick: (row) => handleDeleteBarco(row.id) },
              ]}
              loading={loadingBarcos}
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={limit}
              onPageChange={setPage}
              onPageSizeChange={setLimit}
              pageSizeOptions={[10, 25, 50, 100, 200]}
              emptyMessage="No hay registros"
              tableId="barcos-table"
              tableClassName="min-w-full border text-sm bg-white rounded-lg shadow"
              headerClassName="bg-gray-200"
            />
          </section>
        )}

        {/* PRODUCTOS SECTION */}
        {activeTab === "productos" && (
          <section className="bg-white p-4 rounded-lg shadow space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-semibold">Productos</h2>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Buscar productos..."
                  value={productoInput}
                  onChange={(e) => setProductoInput(e.target.value)}
                  className="w-full sm:max-w-xs border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  onClick={openCreateProductoModal}
                   className="w-full sm:w-auto flex items-center justify-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-md transition"
                >
                  <FaPlus className="mr-2" />
                  Agregar
                </button>
              </div>
            </div>

            <DataTable
              data={filteredProductos}
              columns={[
                { key: "nombre", label: "Nombre", align: "left", noWrap: true },
                { key: "descripcion", label: "Descripción", align: "left", noWrap: true },
              ]}
              actions={[
                {
                  type: "view",
                  onClick: (row) => {
                    setSelectedProductoDetail(row);
                    setIsProductoDetailModalOpen(true);
                  },
                },
                { type: "edit", onClick: (row) => openEditProductoModal(row) },
                { type: "delete", onClick: (row) => handleDeleteProducto(row.id) },
              ]}
              loading={loadingProductos}
              currentPage={1}
              totalPages={1}
              totalCount={filteredProductos.length}
              pageSize={filteredProductos.length}
              onPageChange={() => {}}
              onPageSizeChange={() => {}}
              showPagination={false}
              emptyMessage="No hay registros"
              tableId="productos-table"
              tableClassName="min-w-full border text-sm bg-white rounded-lg shadow"
              headerClassName="bg-gray-200"
            />
          </section>
        )}

        {/* TRANSPORTES SECTION */}
        {activeTab === "transportes" && (
          <section className="bg-white p-4 rounded-lg shadow space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between">
              <h2 className="text-lg font-semibold mb-4 md:mb-0">Transportes</h2>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <a
                  href="https://res.cloudinary.com/dw7txgvbh/raw/upload/v1745432798/resources/Formato.xlsx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition"
                >
                  <FaFileExcel className="mr-1" /> Descargar Formato
                </a>
                <button
                  onClick={() => setIsTransportUploadModalOpen(true)}
                  className="w-full sm:w-auto flex items-center justify-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-md transition"
                >
                    <FaPlus className="mr-2" />
                    Agregar
                  </button>
              </div>
            </div>

            <DataTable
              data={existingTransportes}
              columns={[
                { key: "fechaRegistro", label: "Fecha", align: "left", noWrap: true },
                { key: "nombre", label: "Empresa", align: "left", noWrap: true },
                {
                  key: "activo",
                  label: "Activo",
                  align: "center" as const,
                  type: "checkbox" as const,
                  onCheckboxChange: (row: Transporte) => handleToggleActivo(row),
                  noWrap: true,
                },
              ]}
              actions={[
                { type: "view", onClick: (row) => openTransportViewModal(row) },
                { type: "edit", onClick: (row) => openTransportEditModal(row) },
                { type: "delete", onClick: (row) => handleDeleteTransport(row.id) },
              ]}
              loading={loadingExistingTrans}
              currentPage={pageTrans}
              totalPages={Math.ceil(totalCountTrans / limitTrans)}
              totalCount={totalCountTrans}
              pageSize={limitTrans}
              onPageChange={(newPage) => setPageTrans(newPage)}
              onPageSizeChange={(newLimit) => {
                setLimitTrans(newLimit);
                setPageTrans(1);
              }}
              emptyMessage="No hay registros"
              showPagination={true}
              tableId="transportes-table"
              tableClassName="min-w-full border text-sm bg-white rounded-lg shadow"
              headerClassName="bg-gray-200"
            />
          </section>
        )}
      </div>

      {/* ========== MODALES ESTANDARIZADOS ========== */}
      
      {/* Modal de Confirmación */}
      <ConfirmModal
        isOpen={confirmModalOpen}
        onClose={handleConfirmClose}
        onConfirm={() => {
          confirmAction();
          handleConfirmClose();
        }}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        type={confirmConfig.type}
      />

      {/* Modal de Vista de Barco */}
      <ViewModal
        isOpen={isBarcoDetailModalOpen}
        onClose={() => setIsBarcoDetailModalOpen(false)}
        title="Detalles del Barco"
        data={selectedBarcoDetail}
        fields={barcoViewFields}
        size="xl"
        actions={[
          {
            label: 'Editar',
            onClick: () => {
              setIsBarcoDetailModalOpen(false);
              if (selectedBarcoDetail) openEditBarcoModal(selectedBarcoDetail);
            },
            className: 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
          }
        ]}
      />

      {/* Modal de Creación de Barco */}
      <CreateEditModal
        isOpen={isCreateBarcoModalOpen}
        onClose={() => setIsCreateBarcoModalOpen(false)}
        title="Registrar Barco"
        formData={createBarcoForm}
        fields={barcoFormFields.map(field => {
          if (field.key === 'transportes') {
            return {
              ...field,
              value: createBarcoForm.transportes.map(t => t.id)
            };
          }
          return field;
        })}
        onSubmit={handleCreateBarcoSubmit}
        onFieldChange={handleCreateBarcoFieldChange}
        isLoading={false}
        size="xl"
        submitButtonText="Registrar Barco"
      />

      {/* Modal de Edición de Barco */}
      <CreateEditModal
        isOpen={isEditBarcoModalOpen}
        onClose={() => setIsEditBarcoModalOpen(false)}
        title="Editar Barco"
        formData={editBarcoForm}
        fields={barcoFormFields.map(field => {
          if (field.key === 'transportes') {
            return {
              ...field,
              value: editBarcoForm.transportes.map(t => t.id)
            };
          }
          return field;
        })}
        onSubmit={handleEditBarcoSubmit}
        onFieldChange={handleEditBarcoFieldChange}
        isLoading={false}
        size="xl"
        submitButtonText="Actualizar Barco"
      />

      {/* Modal de Vista de Producto */}
      <ViewModal
        isOpen={isProductoDetailModalOpen}
        onClose={() => setIsProductoDetailModalOpen(false)}
        title="Detalles del Producto"
        data={selectedProductoDetail}
        fields={productoViewFields}
        size="lg"
        actions={[
          {
            label: 'Editar',
            onClick: () => {
              setIsProductoDetailModalOpen(false);
              if (selectedProductoDetail) openEditProductoModal(selectedProductoDetail);
            },
            className: 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
          }
        ]}
      />

      {/* Modal de Creación de Producto */}
      <CreateEditModal
        isOpen={isCreateProductoModalOpen}
        onClose={() => setIsCreateProductoModalOpen(false)}
        title="Registrar Producto"
        formData={createProductoForm}
        fields={productoFormFields}
        onSubmit={handleCreateProductoSubmit}
        onFieldChange={handleCreateProductoFieldChange}
        isLoading={false}
        size="lg"
        submitButtonText="Registrar Producto"
      />

      {/* Modal de Edición de Producto */}
      <CreateEditModal
        isOpen={isEditProductoModalOpen}
        onClose={() => setIsEditProductoModalOpen(false)}
        title="Editar Producto"
        formData={editProductoForm}
        fields={productoFormFields}
        onSubmit={handleEditProductoSubmit}
        onFieldChange={handleEditProductoFieldChange}
        isLoading={false}
        size="lg"
        submitButtonText="Actualizar Producto"
      />

      {/* Modal de Vista de Transporte */}
      <ViewModal
        isOpen={isTransportViewModalOpen}
        onClose={() => setIsTransportViewModalOpen(false)}
        title="Detalles del Transporte"
        data={selectedTransportView}
        fields={transporteViewFields}
        size="lg"
        actions={[
          {
            label: 'Editar',
            onClick: () => {
              setIsTransportViewModalOpen(false);
              if (selectedTransportView) openTransportEditModal(selectedTransportView);
            },
            className: 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
          }
        ]}
      />

      {/* Modal de Edición de Transporte con Tabla */}
      <TableModal
        isOpen={isTransportEditModalOpen}
        onClose={() => setIsTransportEditModalOpen(false)}
        title="Editar Transporte"
        data={editTransportForm.motoristas}
        columns={transporteTableColumns}
        onDataChange={(newData) => handleEditTransportChange('motoristas', newData)}
        onSubmit={handleSaveTransportEdit}
        canAddRows={true}
        canDeleteRows={true}
        submitButtonText="Guardar Cambios"
        submitCondition={() => editTransportForm.empresa.trim() !== '' && editTransportForm.motoristas.length > 0}
        additionalFields={
          <div className="mb-4">
            <label className="block font-medium mb-1">
              Empresa <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editTransportForm.empresa}
              onChange={(e) => handleEditTransportChange('empresa', e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Nombre de la empresa"
              required
            />
          </div>
        }
      />

      {/* Modal de Carga de Transportes */}
      <BaseModal
        isOpen={isTransportUploadModalOpen}
        onClose={() => {
          setIsTransportUploadModalOpen(false);
          setTransportSheets([]);
        }}
        title="Cargar Excel de Transportes"
        size="2xl"
      >
        <div className="space-y-6">
          {/* Área de carga de archivos */}
          <div className="flex items-center space-x-4 mb-6">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer border-4 border-dashed border-gray-400 bg-white rounded-lg h-20 flex-1 flex items-center justify-center hover:border-blue-500 transition-colors"
            >
              <FiUpload size={24} className="text-gray-400 mr-2" />
              <span className="text-gray-600">Arrastra o haz click para subir .xlsx</span>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Contenido de las hojas cargadas */}
          {transportSheets.map((sheet) => (
            <div key={sheet.uid} className="border rounded-lg p-4 space-y-4 bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="flex-1 mr-4">
                  <label className="block font-medium mb-1">
                    Empresa
                  </label>
                  <input
                    type="text"
                    value={sheet.empresa}
                    onChange={(e) => updateEmpresa(sheet.uid, e.target.value)}
                    className="w-full border rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="Nombre de la empresa"
                  />
                  <p className="text-sm text-gray-500 mt-1">Hoja: {sheet.sheetName}</p>
                </div>
                <button
                  onClick={() => removeSheet(sheet.uid)}
                  className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-100 transition"
                  title="Eliminar empresa"
                >
                  <FiTrash2 size={20} />
                </button>
              </div>

              {/* Tabla de motoristas */}
              <div className="bg-white rounded border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Nombre Motorista</th>
                      <th className="px-4 py-2 text-left font-medium">Placa</th>
                      <th className="px-4 py-2 text-center font-medium w-20">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.map((row) => (
                      <tr key={row.uid} className="hover:bg-gray-50 border-t">
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.nombre}
                            onChange={(e) => updateRow(sheet.uid, row.uid!, "nombre", e.target.value)}
                            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="Nombre del motorista"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.placa}
                            onChange={(e) => updateRow(sheet.uid, row.uid!, "placa", e.target.value)}
                            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="Placa del vehículo"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => removeRow(sheet.uid, row.uid!)}
                            className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-100 transition"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div className="p-3 border-t bg-gray-50">
                  <button
                    onClick={() => addRow(sheet.uid)}
                    className="flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    <FaPlus className="mr-1" size={12} /> Agregar motorista
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Sin datos cargados */}
          {transportSheets.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FiUpload size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No hay datos cargados. Sube un archivo Excel para comenzar.</p>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              onClick={() => {
                setIsTransportUploadModalOpen(false);
                setTransportSheets([]);
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveTransportes}
              disabled={transportSheets.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Guardar Transportes
            </button>
          </div>
        </div>
      </BaseModal>

      {/* GLOBAL STYLES */}
      <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 2s linear infinite;
        }
      `}</style>
    </div>
  );
}