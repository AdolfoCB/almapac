"use client";

import { useState, useEffect, useRef, FormEvent, useCallback } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { FiArrowLeft, FiRefreshCw } from "react-icons/fi";
import DataTable from "@/components/DataTable";
import { showErrorAlert } from "@/lib/errorAlert";
import { FaFilePdf, FaPlus } from "react-icons/fa";
import PDFBitacoraAcumulado from "@/components/PDFBitacoraAcumulado";
import { PDFDownloadLink } from "@react-pdf/renderer";

// Función debounce
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

// Interfaz de un Barco
interface Barco {
  id: number;
  muelle: string | null;
  vaporBarco: string | null;
  fechaArribo: string | null;
  horaArribo: string | null;
  fechaAtraque: string | null;
  horaAtraque: string | null;
  fechaRecibido: string | null;
  horaRecibido: string | null;
  fechaInicioOperaciones: string | null;
  horaInicioOperaciones: string | null;
  fechaFinOperaciones?: string | null;
  horaFinOperaciones?: string | null;
  tipoCarga: string | null;
  sistemaUtilizado: string | null;
  activo: boolean;
  fechaRegistro: string | null;
}

// Respuesta de la API
interface BarcosResponse {
  data: {
    barcos: Barco[];
    totalCount: number;
  };
}

// Opciones de checks
const TIPO_CARGA_OPCIONES = [
  "CEREALES",
  "AZÚCAR CRUDA",
  "CARBÓN",
  "MELAZA",
  "GRASA AMARILLA",
  "YESO",
];
const SISTEMA_UTILIZADO_OPCIONES = [
  "UNIDAD DE CARGA",
  "SUCCIONADORA",
  "ALMEJA",
  "CHINGUILLOS",
  "EQUIPO BULHER",
  "ALAMBRE",
];

// Interfaces for API response types
interface Operacion {
  final: string;
  bodega: string;
  inicio: string;
  minutos: string;
  actividad: string;
}

interface BarcoConOperaciones {
  id: number;
  muelle: string;
  vaporBarco: string;
  fechaArribo: string;
  horaArribo: string;
  fechaAtraque: string;
  horaAtraque: string;
  fechaRecibido: string;
  horaRecibido: string;
  fechaInicioOperaciones: string;
  horaInicioOperaciones: string;
  fechaFinOperaciones: string;
  horaFinOperaciones: string;
  tipoCarga: string;
  sistemaUtilizado: string;
  fechaRegistro: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  operaciones: Operacion[];
  totalOperaciones: number;
}

interface APIResponse {
  success: boolean;
  code: number;
  message: string;
  data: BarcoConOperaciones;
}

function DownloadPDF({
  barcoId,
  pdfKey,
  onDownload,
}: {
  barcoId: number;
  onDownload: () => void;
  pdfKey,
}) {
  const [pdfData, setPdfData] = useState<BarcoConOperaciones | null>(null);
  const downloadTriggered = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/v1/bitacoras/barco/${barcoId}`);
        const data: APIResponse = await res.json();
        if (data.success) {
          setPdfData(data.data);
          console.log(data.data)
        } else {
          throw new Error(data.message);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        Swal.fire("Error", "No se pudo obtener los datos para el PDF", "error");
      }
    };

    fetchData();
  }, [barcoId]);

  if (!pdfData) return null;

  const fileName = `Bitacora_${pdfData.vaporBarco}_${pdfData.fechaRegistro.split(",")[0]}.pdf`;

  return (
    <div style={{ display: "none" }}>
      <PDFDownloadLink
        key={pdfKey}
        document={<PDFBitacoraAcumulado formData={pdfData} />}
        fileName={fileName}
      >
        {({ loading, blob, url, error }) => {
          if (!loading && blob && url && !downloadTriggered.current) {
            downloadTriggered.current = true;
            Swal.close();
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => {
              onDownload();
              Swal.fire("Éxito", "Reporte generado correctamente.", "success");
            }, 0);
          }
          return null;
        }}
      </PDFDownloadLink>
    </div>
  );
}

export default function BarcosPage() {
  const router = useRouter();

  // Estados de datos y paginación
  const [barcos, setBarcos] = useState<Barco[]>([]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshLoading, setRefreshLoading] = useState(false);

  // Estados para modales y formulario
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Campos formulario
  const [muelle, setMuelle] = useState("");
  const [vaporBarco, setVaporBarco] = useState("");
  const [fechaArribo, setFechaArribo] = useState("");
  const [horaArribo, setHoraArribo] = useState("");
  const [fechaAtraque, setFechaAtraque] = useState("");
  const [horaAtraque, setHoraAtraque] = useState("");
  const [fechaRecibido, setFechaRecibido] = useState("");
  const [horaRecibido, setHoraRecibido] = useState("");
  const [fechaInicioOp, setFechaInicioOp] = useState("");
  const [horaInicioOp, setHoraInicioOp] = useState("");
  const [fechaFinOp, setFechaFinOp] = useState("");
  const [horaFinOp, setHoraFinOp] = useState("");
  const [tipoCarga, setTipoCarga] = useState<string[]>([]);
  const [sistemaUtilizado, setSistemaUtilizado] = useState<string[]>([]);
  const [activo, setActivo] = useState(false);
  const [fechaRegistro, setFechaRegistro] = useState("");
  const [viewData, setViewData] = useState<Barco | null>(null);
  const [renderPDFLink, setRenderPDFLink] = useState(false);
  const [pdfKey, setPdfKey] = useState(0);
  // Debounce para búsqueda
  const debouncedSetSearch = useCallback(
    debounce((value: string) => {
      setSearch(value);
    }, 500),
    []
  );

  const handleGenerarPDF = () => {
    Swal.fire({
      title: "Generando Reporte...",
      html: "Por favor, espera un momento.",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
  
    setRenderPDFLink(true);
    setPdfKey((prev) => prev + 1);
  };

  // Carga de datos desde API
  async function fetchBarcos() {
    setLoading(true);
    try {
      const pageParam = page < 1 ? 1 : page;
      const res = await fetch(
        `/api/v1/barcos?search=${search}&page=${pageParam}&limit=${limit}&activo=all`
      );
      const result: BarcosResponse = await res.json();
      setBarcos(result.data.barcos || []);
      setTotalCount(result.data.totalCount || 0);
    } catch (error) {
      console.error("Error al listar barcos:", error);
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: "No se pudo obtener la lista de barcos",
        showConfirmButton: false,
        timer: 3000,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBarcos();
  }, [search, page, limit]);

  // Actualizar lista
  async function refreshData() {
    setRefreshLoading(true);
    await fetchBarcos();
    setRefreshLoading(false);
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Datos actualizados",
      showConfirmButton: false,
      timer: 1500,
    });
  }

  // Ver detalles
  function handleView(id: number) {
    const barcoFound = barcos.find((b) => b.id === id);
    if (!barcoFound) {
      return Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: "Barco no encontrado",
        showConfirmButton: false,
        timer: 2500,
      });
    }
    setViewData(barcoFound);
    setShowViewModal(true);
  }

  // Abrir modal de creación
  function openCreateModal() {
    setEditId(null);
    setMuelle("");
    setVaporBarco("");
    setFechaArribo("");
    setHoraArribo("");
    setFechaAtraque("");
    setHoraAtraque("");
    setFechaRecibido("");
    setHoraRecibido("");
    setFechaInicioOp("");
    setHoraInicioOp("");
    setFechaFinOp("");
    setHoraFinOp("");
    setTipoCarga([]);
    setSistemaUtilizado([]);
    setActivo(false);
    setFechaRegistro("");
    setShowCreateModal(true);
  }

  // Crear nuevo barco
  async function handleCreate(e: FormEvent) {
    e.preventDefault();

    const missingFields: string[] = [];
    if (!muelle.trim()) missingFields.push("muelle");
    if (!vaporBarco.trim()) missingFields.push("vapor/barco");
    if (tipoCarga.length === 0) missingFields.push("tipo de carga");

    if (missingFields.length > 0) {
      return Swal.fire({
        toast: true,
        position: "top-end",
        icon: "warning",
        title: `Falta ingresar: ${missingFields.join(", ")}`,
        showConfirmButton: false,
        timer: 3000,
      });
    }

    try {
      Swal.fire({
        title: "Procesando solicitud...",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });
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
      const body = {
        muelle,
        vaporBarco,
        fechaArribo,
        horaArribo,
        fechaAtraque,
        horaAtraque,
        fechaRecibido,
        horaRecibido,
        fechaInicioOperaciones: fechaInicioOp,
        horaInicioOperaciones: horaInicioOp,
        fechaFinOperaciones: fechaFinOp,
        horaFinOperaciones: horaFinOp,
        tipoCarga,
        sistemaUtilizado,
        fechaRegistro: now,
      };
      const res = await fetch("/api/v1/barcos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      Swal.close();
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        await showErrorAlert(errData, "No se pudo registrar el barco");
        return;
      }
      setShowCreateModal(false);
      await fetchBarcos();
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Barco registrado",
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (error: any) {
      Swal.close();
      console.error(error);
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: error.message || "Error al registrar barco",
        showConfirmButton: false,
        timer: 3000,
      });
    }
  }

  // Abrir modal de edición
  function openEditModal(id: number) {
    const barcoData = barcos.find((b) => b.id === id);
    if (!barcoData) {
      return Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: "Barco no encontrado",
        showConfirmButton: false,
        timer: 2500,
      });
    }
    setEditId(barcoData.id);
    setMuelle(barcoData.muelle || "");
    setVaporBarco(barcoData.vaporBarco || "");
    setFechaArribo(barcoData.fechaArribo || "");
    setHoraArribo(barcoData.horaArribo || "");
    setFechaAtraque(barcoData.fechaAtraque || "");
    setHoraAtraque(barcoData.horaAtraque || "");
    setFechaRecibido(barcoData.fechaRecibido || "");
    setHoraRecibido(barcoData.horaRecibido || "");
    setFechaInicioOp(barcoData.fechaInicioOperaciones || "");
    setHoraInicioOp(barcoData.horaInicioOperaciones || "");
    setFechaFinOp(barcoData.fechaFinOperaciones || "");
    setHoraFinOp(barcoData.horaFinOperaciones || "");
    const tc = barcoData.tipoCarga ? JSON.parse(barcoData.tipoCarga) : [];
    const su = barcoData.sistemaUtilizado
      ? JSON.parse(barcoData.sistemaUtilizado)
      : [];
    setTipoCarga(tc);
    setSistemaUtilizado(su);
    setActivo(barcoData.activo);
    setFechaRegistro(barcoData.fechaRegistro || "");
    setShowEditModal(true);
  }

  // Actualizar barco
  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editId) return;
    try {
      Swal.fire({
        title: "Procesando solicitud...",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });
      const body = {
        muelle,
        vaporBarco,
        fechaArribo,
        horaArribo,
        fechaAtraque,
        horaAtraque,
        fechaRecibido,
        horaRecibido,
        fechaInicioOperaciones: fechaInicioOp,
        horaInicioOperaciones: horaInicioOp,
        fechaFinOperaciones: fechaFinOp,
        horaFinOperaciones: horaFinOp,
        tipoCarga,
        sistemaUtilizado,
        fechaRegistro,
        activo,
      };
      const res = await fetch(`/api/v1/barcos/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      Swal.close();
      if (!res.ok) {
       await showErrorAlert(res, "No se pudo actualizar el barco");
       return;
      }
      setShowEditModal(false);
      await fetchBarcos();
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Barco actualizado",
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (error: any) {
      Swal.close();
      console.error(error);
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: error.message || "Error al actualizar barco",
        showConfirmButton: false,
        timer: 3000,
      });
    }
  }

  // Eliminar barco
  async function handleDelete(id: number) {
    const result = await Swal.fire({
      title: "¿Eliminar este barco?",
      text: "Esta acción no se puede deshacer",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3838b0",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "No, cancelar",
    });
    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/v1/barcos/${id}`, { method: "DELETE" });
        if (!res.ok) {
        const errData = await res.json().catch(() => null);
        await showErrorAlert(errData, "No se pudo eliminar el barco");
        return;
        }
        await fetchBarcos();
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "Barco eliminado",
          showConfirmButton: false,
          timer: 1500,
        });
      } catch (error: any) {
        console.error("Error al eliminar barco:", error);
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "error",
          title: error.message || "Error al eliminar barco",
          showConfirmButton: false,
          timer: 3000,
        });
      }
    }
  }

  // Manejo del switch de activo en la tabla de barcos
  const handleToggleActivo = async (barco: Barco) => {
    const newActivo = !barco.activo;

    // Para no perder datos, usamos el registro actual del barco para los campos
    const payload = {
      muelle: barco.muelle || "",
      vaporBarco: barco.vaporBarco || "",
      fechaArribo: barco.fechaArribo || "",
      horaArribo: barco.horaArribo || "",
      fechaAtraque: barco.fechaAtraque || "",
      horaAtraque: barco.horaAtraque || "",
      fechaRecibido: barco.fechaRecibido || "",
      horaRecibido: barco.horaRecibido || "",
      fechaInicioOperaciones: barco.fechaInicioOperaciones || "",
      horaInicioOperaciones: barco.horaInicioOperaciones || "",
      fechaFinOperaciones: barco.fechaFinOperaciones || "",
      horaFinOperaciones: barco.horaFinOperaciones || "",
      tipoCarga: barco.tipoCarga ? JSON.parse(barco.tipoCarga) : [],
      sistemaUtilizado: barco.sistemaUtilizado
        ? JSON.parse(barco.sistemaUtilizado)
        : [],
      fechaRegistro: barco.fechaRegistro || "",
      activo: newActivo,
    };

    try {
      const res = await fetch(`/api/v1/barcos/${barco.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchBarcos();
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: `Barco ${newActivo ? "activado" : "desactivado"}`,
          showConfirmButton: false,
          timer: 1500,
        });
      } else {
        const errorData = await res.json().catch(() => null);
        await showErrorAlert(errorData, "No se pudo actualizar el barco");
        return;
      }
    } catch (error) {
      console.error("Error actualizando estado de activo:", error);
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: "No se pudo actualizar el estado de activo",
        showConfirmButton: false,
        timer: 3000,
      });
    }
  };

  // Toggle checks
  function toggleCheckTipoCarga(item: string) {
    setTipoCarga((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  }
  function toggleCheckSistema(item: string) {
    setSistemaUtilizado((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  }

  const totalPages = Math.ceil(totalCount / limit);

  // Configuración de columnas y acciones para DataTable
  const columns = [
    { key: "fechaRegistro", label: "Fecha", noWrap: true},
    { key: "muelle", label: "Muelle", noWrap: true },
    { key: "vaporBarco", label: "Vapor/Barco", noWrap: true },
    {
      key: "inicioOp",
      label: "Inicio Operaciones",
      render: (_: any, row: Barco) =>
        `${row.fechaInicioOperaciones || "-"} ${row.horaInicioOperaciones || ""}`,
      noWrap: true,
    },
    {
      key: "finOp",
      label: "Fin Operaciones",
      render: (_: any, row: Barco) =>
        `${row.fechaFinOperaciones || "-"} ${row.horaFinOperaciones || ""}`,
      noWrap: true,
    },
    {
      key: "activo",
      label: "Activo",
      align: "center" as const,
      type: "checkbox" as const,
      onCheckboxChange: (row: Barco, checked: boolean) => {
        handleToggleActivo(row);
      },
      noWrap: true,
    },
  ];

  const actions = [
    {
      type: "view" as const,
      onClick: (row: Barco) => handleView(row.id),
      title: "Ver detalles",
    },
    {
      type: "edit" as const,
      onClick: (row: Barco) => openEditModal(row.id),
      title: "Editar",
    },
    {
      type: "delete" as const,
      onClick: (row: Barco) => handleDelete(row.id),
      title: "Eliminar",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-[#110885] text-white shadow-lg md:sticky md:top-0 z-50">
        <div className="mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <button
              onClick={() => router.push("/")}
              className="bg-white hover:bg-gray-200 text-blue-600 p-2 rounded-full mr-3 transition-all duration-300 transform hover:scale-105"
              title="Volver"
            >
              <FiArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold">Barcos en Muelle</h1>
          </div>
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
      </header>

      {/* MAIN CONTENT */}
      <div className="container mx-auto px-4 py-6">
      {/* Contenido */}
      <section className="bg-white p-4 rounded-lg shadow space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Barcos</h2>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Buscar por muelle o barco..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              debouncedSetSearch(e.target.value);
              setPage(1);
            }}
           className="w-full sm:max-w-xs border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            onClick={openCreateModal}
             className="w-full sm:w-auto flex items-center justify-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-md transition"
                            >
            <FaPlus className="mr-2" />
            Agregar
          </button>
          </div>
        </div>

        {/* DataTable */}
        <DataTable<Barco>
          data={barcos}
          columns={columns}
          actions={actions}
          loading={loading}
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={limit}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => {
            setLimit(s);
            setPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100, 200]}
          emptyMessage="No hay registros"
          tableId="barcos-table"
          tableClassName="min-w-full border text-sm bg-white rounded-lg shadow"
          headerClassName="bg-gray-200"
          showPagination={true}
        />
        </section>

        {/* Modal Crear */}
        {showCreateModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-2 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl lg:max-w-4xl p-6 rounded-lg shadow-xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Nuevo Barco</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-6">
                {/* MUELLE y VAPOR/BARCO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      MUELLE
                    </label>
                    <input
                      type="text"
                      value={muelle}
                      onChange={(e) => setMuelle(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ingrese muelle"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      VAPOR/BARCO
                    </label>
                    <input
                      type="text"
                      value={vaporBarco}
                      onChange={(e) => setVaporBarco(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ingrese nombre del barco"
                      required
                    />
                  </div>
                </div>

                {/* Tipo de Carga y Sistema Utilizado */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <fieldset className="border p-4 rounded-xl">
                    <legend className="text-sm font-medium text-gray-700 px-2">
                      TIPO DE CARGA
                    </legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {TIPO_CARGA_OPCIONES.map((item) => (
                        <label
                          key={item}
                          className="flex items-center space-x-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={tipoCarga.includes(item)}
                            onChange={() => toggleCheckTipoCarga(item)}
                            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="border p-4 rounded-xl">
                    <legend className="text-sm font-medium text-gray-700 px-2">
                      SISTEMA UTILIZADO
                    </legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {SISTEMA_UTILIZADO_OPCIONES.map((item) => (
                        <label
                          key={item}
                          className="flex items-center space-x-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={sistemaUtilizado.includes(item)}
                            onChange={() => toggleCheckSistema(item)}
                            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>

                {/* Fechas y Horas */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* ARRIBO */}
                  <div className="border p-4 rounded-xl">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-3">
                      ARRIBO
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Fecha
                        </label>
                        <input
                          type="date"
                          value={fechaArribo}
                          onChange={(e) => setFechaArribo(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Hora
                        </label>
                        <input
                          type="time"
                          value={horaArribo}
                          onChange={(e) => setHoraArribo(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  {/* ATRAQUE */}
                  <div className="border p-4 rounded-xl">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-3">
                      ATRAQUE
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Fecha
                        </label>
                        <input
                          type="date"
                          value={fechaAtraque}
                          onChange={(e) => setFechaAtraque(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Hora
                        </label>
                        <input
                          type="time"
                          value={horaAtraque}
                          onChange={(e) => setHoraAtraque(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  {/* RECIBIDO */}
                  <div className="border p-4 rounded-xl">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-3">
                      RECIBIDO
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Fecha
                        </label>
                        <input
                          type="date"
                          value={fechaRecibido}
                          onChange={(e) => setFechaRecibido(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Hora
                        </label>
                        <input
                          type="time"
                          value={horaRecibido}
                          onChange={(e) => setHoraRecibido(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  {/* INICIO OPERACIONES */}
                  <div className="border p-4 rounded-xl">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-3">
                      INICIO OPERACIONES
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Fecha
                        </label>
                        <input
                          type="date"
                          value={fechaInicioOp}
                          onChange={(e) => setFechaInicioOp(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Hora
                        </label>
                        <input
                          type="time"
                          value={horaInicioOp}
                          onChange={(e) => setHoraInicioOp(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  {/* FIN OPERACIONES */}
                  <div className="border p-4 rounded-xl">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-3">
                      FIN OPERACIONES
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Fecha
                        </label>
                        <input
                          type="date"
                          value={fechaFinOp}
                          onChange={(e) => setFechaFinOp(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Hora
                        </label>
                        <input
                          type="time"
                          value={horaFinOp}
                          onChange={(e) => setHoraFinOp(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="border-2 px-5 py-2 text-gray-600 hover:text-gray-800 font-medium rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Ver */}
        {showViewModal && viewData && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-2 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl lg:max-w-4xl p-6 rounded-lg shadow-xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h2 className="text-2xl font-bold text-gray-800">
                  Detalles del Barco
                </h2>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Muelle y Barco */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      MUELLE
                    </label>
                    <div className="w-full px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                      <span
                        className={viewData.muelle ? "text-gray-800" : "text-gray-400"}
                      >
                        {viewData.muelle || "-"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      VAPOR/BARCO
                    </label>
                    <div className="w-full px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                      <span
                        className={
                          viewData.vaporBarco ? "text-gray-800" : "text-gray-400"
                        }
                      >
                        {viewData.vaporBarco || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fechas/Horas */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* ARRIBO */}
                  <div className="border p-3 rounded-xl bg-gray-50">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                      ARRIBO
                    </h3>
                    <div className="space-y-1">
                      <div>
                        <span className="text-sm text-gray-600">Fecha: </span>
                        <span
                          className={
                            viewData.fechaArribo ? "text-gray-800" : "text-gray-400"
                          }
                        >
                          {viewData.fechaArribo || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Hora: </span>
                        <span
                          className={
                            viewData.horaArribo ? "text-gray-800" : "text-gray-400"
                          }
                        >
                          {viewData.horaArribo || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* ATRAQUE */}
                  <div className="border p-3 rounded-xl bg-gray-50">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                      ATRAQUE
                    </h3>
                    <div className="space-y-1">
                      <div>
                        <span className="text-sm text-gray-600">Fecha: </span>
                        <span
                          className={
                            viewData.fechaAtraque ? "text-gray-800" : "text-gray-400"
                          }
                        >
                          {viewData.fechaAtraque || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Hora: </span>
                        <span
                          className={
                            viewData.horaAtraque ? "text-gray-800" : "text-gray-400"
                          }
                        >
                          {viewData.horaAtraque || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* RECIBIDO */}
                  <div className="border p-3 rounded-xl bg-gray-50">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                      RECIBIDO
                    </h3>
                    <div className="space-y-1">
                      <div>
                        <span className="text-sm text-gray-600">Fecha: </span>
                        <span
                          className={
                            viewData.fechaRecibido ? "text-gray-800" : "text-gray-400"
                          }
                        >
                          {viewData.fechaRecibido || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Hora: </span>
                        <span
                          className={
                            viewData.horaRecibido ? "text-gray-800" : "text-gray-400"
                          }
                        >
                          {viewData.horaRecibido || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* INICIO OPERACIONES */}
                  <div className="border p-3 rounded-xl bg-gray-50">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                      INICIO OPERACIONES
                    </h3>
                    <div className="space-y-1">
                      <div>
                        <span className="text-sm text-gray-600">Fecha: </span>
                        <span
                          className={
                            viewData.fechaInicioOperaciones
                              ? "text-gray-800"
                              : "text-gray-400"
                          }
                        >
                          {viewData.fechaInicioOperaciones || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Hora: </span>
                        <span
                          className={
                            viewData.horaInicioOperaciones
                              ? "text-gray-800"
                              : "text-gray-400"
                          }
                        >
                          {viewData.horaInicioOperaciones || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* FIN OPERACIONES */}
                  <div className="border p-3 rounded-xl bg-gray-50">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                      FIN OPERACIONES
                    </h3>
                    <div className="space-y-1">
                      <div>
                        <span className="text-sm text-gray-600">Fecha: </span>
                        <span
                          className={
                            viewData.fechaFinOperaciones
                              ? "text-gray-800"
                              : "text-gray-400"
                          }
                        >
                          {viewData.fechaFinOperaciones || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Hora: </span>
                        <span
                          className={
                            viewData.horaFinOperaciones
                              ? "text-gray-800"
                              : "text-gray-400"
                          }
                        >
                          {viewData.horaFinOperaciones || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tipo & Sistema */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      TIPO DE CARGA
                    </label>
                    <div className="w-full px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                      <span
                        className={viewData.tipoCarga ? "text-gray-800" : "text-gray-400"}
                      >
                        {viewData.tipoCarga
                          ? JSON.parse(viewData.tipoCarga).join(", ")
                          : "-"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      SISTEMA UTILIZADO
                    </label>
                    <div className="w-full px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                      <span
                        className={
                          viewData.sistemaUtilizado ? "text-gray-800" : "text-gray-400"
                        }
                      >
                        {viewData.sistemaUtilizado
                          ? JSON.parse(viewData.sistemaUtilizado).join(", ")
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t mt-6">
              <button
                onClick={handleGenerarPDF}
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
              >
                  <FaFilePdf size={24} />
                  Reporte PDF
                </button>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
                >
                  Cerrar
                </button>
              </div>
                {renderPDFLink && viewData && (
                <DownloadPDF
                  key={pdfKey}
                  pdfKey={pdfKey}
                  barcoId={viewData.id} 
                  onDownload={() => setRenderPDFLink(false)}
                />
                )}
            </div>
          </div>
        )}

        {/* Modal Editar */}
        {showEditModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-2 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl lg:max-w-4xl p-6 rounded-lg shadow-xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Editar Barco</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleEdit} className="space-y-6">
                {/* MUELLE y VAPOR/BARCO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      MUELLE
                    </label>
                    <input
                      type="text"
                      value={muelle}
                      onChange={(e) => setMuelle(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ingrese muelle"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      VAPOR/BARCO
                    </label>
                    <input
                      type="text"
                      value={vaporBarco}
                      onChange={(e) => setVaporBarco(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ingrese nombre del barco"
                      required
                    />
                  </div>
                </div>

                {/* Tipo de Carga y Sistema Utilizado */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <fieldset className="border p-4 rounded-xl">
                    <legend className="text-sm font-medium text-gray-700 px-2">
                      TIPO DE CARGA
                    </legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {TIPO_CARGA_OPCIONES.map((item) => (
                        <label
                          key={item}
                          className="flex items-center space-x-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={tipoCarga.includes(item)}
                            onChange={() => toggleCheckTipoCarga(item)}
                            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="border p-4 rounded-xl">
                    <legend className="text-sm font-medium text-gray-700 px-2">
                      SISTEMA UTILIZADO
                    </legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {SISTEMA_UTILIZADO_OPCIONES.map((item) => (
                        <label
                          key={item}
                          className="flex items-center space-x-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={sistemaUtilizado.includes(item)}
                            onChange={() => toggleCheckSistema(item)}
                            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>

                {/* Fechas y Horas */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* ARRIBO */}
                  <div className="border p-4 rounded-xl">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-3">
                      ARRIBO
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Fecha
                        </label>
                        <input
                          type="date"
                          value={fechaArribo}
                          onChange={(e) => setFechaArribo(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Hora
                        </label>
                        <input
                          type="time"
                          value={horaArribo}
                          onChange={(e) => setHoraArribo(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  {/* ATRAQUE */}
                  <div className="border p-4 rounded-xl">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-3">
                      ATRAQUE
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Fecha
                        </label>
                        <input
                          type="date"
                          value={fechaAtraque}
                          onChange={(e) => setFechaAtraque(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Hora
                        </label>
                        <input
                          type="time"
                          value={horaAtraque}
                          onChange={(e) => setHoraAtraque(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  {/* RECIBIDO */}
                  <div className="border p-4 rounded-xl">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-3">
                      RECIBIDO
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Fecha
                        </label>
                        <input
                          type="date"
                          value={fechaRecibido}
                          onChange={(e) => setFechaRecibido(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Hora
                        </label>
                        <input
                          type="time"
                          value={horaRecibido}
                          onChange={(e) => setHoraRecibido(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  {/* INICIO OPERACIONES */}
                  <div className="border p-4 rounded-xl">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-3">
                      INICIO OPERACIONES
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Fecha
                        </label>
                        <input
                          type="date"
                          value={fechaInicioOp}
                          onChange={(e) => setFechaInicioOp(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Hora
                        </label>
                        <input
                          type="time"
                          value={horaInicioOp}
                          onChange={(e) => setHoraInicioOp(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  {/* FIN OPERACIONES */}
                  <div className="border p-4 rounded-xl">
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-3">
                      FIN OPERACIONES
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Fecha
                        </label>
                        <input
                          type="date"
                          value={fechaFinOp}
                          onChange={(e) => setFechaFinOp(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Hora
                        </label>
                        <input
                          type="time"
                          value={horaFinOp}
                          onChange={(e) => setHoraFinOp(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-md focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botones */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="border-2 px-5 py-2 text-gray-600 hover:text-gray-800 font-medium rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Actualizar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}