"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { FaFilePdf } from "react-icons/fa";
import { FiArrowLeft, FiRefreshCw, FiFileText } from "react-icons/fi";
import PDFBitacora from "@/components/PDFBitacora";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { useSession } from "next-auth/react";
import DataTable from "@/components/DataTable";

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

// Interfaces según el detalle que retorna la API
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
  fechaFinOperaciones: string | null;
  horaFinOperaciones: string | null;
  tipoCarga: string | null;
  sistemaUtilizado: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Operacion {
  id: number;
  bodega: string;
  inicio: string;
  final: string;
  minutos: string;
  actividad: string;
  bitacoraId: number;
  createdAt: string;
  updatedAt: string;
}

interface Bitacoras {
  id: number;
  fechaInicio: string;
  fecha: string;
  fechaCierre: string;
  muellero: string;
  turnoInicio: string;
  turnoFin: string;
  observaciones: string;
  barcoId: number;
  eliminado?: boolean;
  createdAt: string;
  updatedAt: string;
  barco: Barco;
  operaciones: Operacion[];
  estado: string;
}

// Componente auxiliar que se encarga de descargar el PDF
function DownloadPDF({
  viewData,
  pdfKey,
  fileName,
  onDownload,
}: {
  viewData: Bitacoras;
  pdfKey: number;
  fileName: string;
  onDownload: () => void;
}) {
  const downloadTriggered = useRef(false);

  return (
    <div style={{ display: "none" }}>
      <PDFDownloadLink
        key={pdfKey}
        document={<PDFBitacora formData={viewData} />}
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

export default function BitacorasPage() {
  const { data: session } = useSession();
  const roleId = (session?.user as { roleId: number } | undefined)?.roleId || null;
  
  // Estados para consulta y paginación
  const [bitacoras, setBitacoras] = useState<Bitacoras[]>([]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Estados para filtros de fecha
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFinal, setFechaFinal] = useState("");

  // Estados para loading de exportación y refresco
  const [exportLoading, setExportLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);

  // Estados para el modal de detalles y para la generación del PDF
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewData, setViewData] = useState<Bitacoras | null>(null);
  const [renderPDFLink, setRenderPDFLink] = useState(false);
  const [pdfKey, setPdfKey] = useState(0);

  // Función debounced para actualizar el estado de búsqueda
  const debouncedSetSearch = useCallback(
    debounce((value: string) => {
      setSearch(value);
    }, 500),
    []
  );

  const router = useRouter();

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

  // Función para cargar bitácoras desde la API
  async function fetchBitacoras() {
    setLoading(true);
    try {
      const pageParam = page < 1 ? 1 : page;
      const res = await fetch(
        `/api/v1/bitacoras?search=${search}&page=${pageParam}&limit=${limit}`
      );
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || "No se pudo obtener la lista");
      }
      setBitacoras(result.data.bitacoras);
      setTotalCount(result.data.totalCount || 0);
    } catch (error: any) {
      console.error("Error al listar bitácoras:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBitacoras();
  }, [search, page, limit]);

  // Función para ver el detalle completo de una bitácora
  function handleView(bitacora: Bitacoras) {
    setViewData(bitacora);
    setShowViewModal(true);
    setRenderPDFLink(false);
  }

  // Función para editar una bitácora
  function handleEdit(bitacora: Bitacoras) {
    localStorage.setItem("bitacoraId", bitacora.id.toString());
    router.push("/proceso/editar/barco");
  }

  // // Función para eliminar una bitácora (opcional)
  // function handleDelete(bitacora: Bitacoras) {
  //   Swal.fire({
  //     title: "¿Estás seguro?",
  //     text: "Esta acción no se puede deshacer",
  //     icon: "warning",
  //     showCancelButton: true,
  //     confirmButtonColor: "#d33",
  //     cancelButtonColor: "#3085d6",
  //     confirmButtonText: "Sí, eliminar",
  //     cancelButtonText: "Cancelar"
  //   }).then((result) => {
  //     if (result.isConfirmed) {
  //       console.log("Eliminar bitácora:", bitacora.id);
  //       Swal.fire("Eliminado", "La bitácora ha sido eliminada", "success");
  //     }
  //   });
  // }

  // Función para Actualizar la lista de bitácoras
  const handleRefresh = async () => {
    setRefreshLoading(true);
    await fetchBitacoras();
    setRefreshLoading(false);
           Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "Datos actualizados",
          showConfirmButton: false,
          timer: 1500,
        });
  };

  // Exportar Excel
  const handleExportarExcel = async () => {
    if (!fechaInicio || !fechaFinal) {
      Swal.fire(
        "Información",
        "Debe seleccionar la fecha de Inicio y Final.",
        "warning"
      );
      return;
    }
    setExportLoading(true);
    Swal.fire({
      title: "Generando Reporte...",
      html: "Por favor, espera un momento.",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const response = await fetch(
        `/api/v1/bitacoras/export-excel?fechaInicio=${fechaInicio}&fechaFinal=${fechaFinal}`
      );
      if (!response.ok) {
        Swal.fire("Error", "Error generando reporte: " + response.status, "error");
        setExportLoading(false);
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = `Bitacoras_Barcos-${fechaInicio}-${fechaFinal}.xlsx`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      Swal.fire("Éxito", "Reporte generado correctamente.", "success");
    } catch (error: any) {
      Swal.fire("Error", "Error generando el reporte: " + error.message, "error");
    } finally {
      setExportLoading(false);
    }
  };

  // Filtrar bitácoras por fecha
  const filteredBitacoras = bitacoras.filter((b) => {
    const fechaBitacora = new Date(b.fecha);
    const inicio = fechaInicio ? new Date(fechaInicio) : null;
    const fin = fechaFinal ? new Date(fechaFinal) : null;

    if (inicio && fin) {
      return fechaBitacora >= inicio && fechaBitacora <= fin;
    } else if (inicio) {
      return fechaBitacora >= inicio;
    } else if (fin) {
      return fechaBitacora <= fin;
    }
    return true;
  });

  const totalPages = Math.ceil(totalCount / limit);

    // Función para asignar colores a la etiqueta de rol (colores distintos para cada rol)
  const getRoleBadgeClass = (estado?: string) => {
    if (!estado) return "bg-yellow-200 text-yellow-800";
    const r = estado.toLowerCase();
    if (r.includes("creada")) return "bg-blue-200 text-blue-800 font-bold";
    if (r.includes("proceso")) return "bg-orange-200 text-orange-800 font-bold";
    if (r.includes("completada")) return "bg-green-200 text-green-800 font-bold";
    if (r.includes("eliminada")) return "bg-red-200 text-red-800 font-bold";
    return "bg-gray-200 text-gray-800";
  };

  // Configuración de columnas para la tabla
  const columns = [
    {
      key: 'fecha',
      label: 'Fecha',
      noWrap: true
    },
    {
      key: 'muellero',
      label: 'Muellero',
      noWrap: true
    },
    {
      key: 'turno',
      label: 'Turno',
      render: (value: any, row: Bitacoras) => `${row.turnoInicio} - ${row.turnoFin}`,
      noWrap: true
    },
    {
      key: 'vaporBarco',
      label: 'Barco',
      render: (value: any, row: Bitacoras) => row.barco?.vaporBarco || '-',
      noWrap: true
    },
    {
      key: 'operaciones',
      label: 'Bitácoras',
      render: (value: any, row: Bitacoras) => row.operaciones.length.toString(),
      noWrap: true
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (_: any, row: Bitacoras) => (
        <span
          className={`px-2 py-1 rounded-md text-sm font-medium ${getRoleBadgeClass(
            row.estado || "-" )}`}
        >
          {row.estado || "-"}
        </span>
      ),
      noWrap: true,
    }
  ];

  // Configuración de acciones para la tabla
  const actions = [
    {
      type: 'view' as const,
      onClick: handleView,
      title: "Ver detalles"
    },
    {
      type: 'edit' as const,
      onClick: handleEdit,
      title: "Editar",
      condition: (row: Bitacoras) => roleId === 1
    }
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Encabezado */}
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
              <h1 className="text-xl font-bold">Bitácoras de Barcos</h1>
            </div>
            <div className="grid grid-cols-2 md:flex md:flex-row items-center mt-4 md:mt-0 gap-3">
              {(roleId === 1 || roleId === 4) && (
                <button
                  onClick={handleExportarExcel}
                  title="Exportar Excel"
                  className="bg-green-700 hover:bg-green-800 text-white px-3 py-2 rounded flex items-center gap-1 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
                >
                  {exportLoading ? (
                    <span className="inline-block animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4"></span>
                  ) : (
                    <FiFileText size={20} />
                  )}
                  <span className="md:inline">Exportar Excel</span>
                </button>
              )}
              <button
                onClick={handleRefresh}
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
          </div>
          {/* Filtros de fecha y búsqueda */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <label className="text-sm">Fecha Inicio</label>
              <input
                type="date"
                className="border text-black p-1 w-full rounded"
                placeholder="dd/mm/aaaa"
                value={fechaInicio}
                onChange={(e) => {
                  setFechaInicio(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm">Fecha Final</label>
              <input
                type="date"
                className="border text-black p-1 w-full rounded"
                placeholder="dd/mm/aaaa"
                value={fechaFinal}
                onChange={(e) => {
                  setFechaFinal(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm">Buscar</label>
              <input
                type="text"
                placeholder="Buscar por muellero, barco..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  debouncedSetSearch(e.target.value);
                  setPage(1);
                }}
                className="border text-black p-1 w-full rounded"
              />
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="container mx-auto px-4 py-6">

      {/* Contenido principal */}
      <section className="bg-white p-4 rounded-lg shadow space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
          <h2 className="text-lg font-semibold mb-2 md:mb-0">Bitacoras</h2>
        </div>
        <div>
        <DataTable
          data={filteredBitacoras}
          columns={columns}
          actions={actions}
          loading={loading}
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={limit}
          onPageChange={(newPage) => setPage(newPage)}
          onPageSizeChange={(newSize) => {
            setLimit(newSize);
            setPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100, 200]}
          emptyMessage="No hay registros"
          tableId="bitacoras-table"
          tableClassName="min-w-full border text-sm bg-white rounded-lg shadow"
          headerClassName="bg-gray-200"
          rowClassName={(row: Bitacoras) => row.eliminado ? "bg-gray-100 text-red-400 italic" : ""}

          showPagination={true}
          />
        </div>
      </section>
      </div>

      {/* Modal de Detalles de la Bitácora */}
      {showViewModal && viewData && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-2">
          <div className="bg-white w-full max-w-5xl p-4 rounded-md overflow-y-auto max-h-screen my-3">
            <h2 className="text-2xl font-bold mb-4">Detalles de la Bitácora</h2>
            <div className="space-y-4">
              {/* Sección: Información del Barco */}
              <section className="max-w-5xl mx-auto bg-white shadow-md p-4 mb-4 rounded-md">
                <h2 className="text-xl font-bold mb-4">Barco</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">MUELLE</label>
                    <input
                      type="text"
                      name="bValue"
                      value={viewData.barco.muelle || ""}
                      readOnly
                      placeholder="B-4"
                      className="w-full h-9 border border-gray-300 rounded-md px-2 py-1 text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">VAPOR/BARCO</label>
                    <input
                      type="text"
                      name="valorMuelle"
                      value={viewData.barco.vaporBarco || ""}
                      readOnly
                      className="w-full h-9 border border-gray-300 rounded-md px-2 py-1 text-black"
                    />
                  </div>
                </div>
                {/* Tarjetas: Tipo de Carga y Sistema Utilizado */}
                <div className="sm:col-span-2 mb-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="border rounded-md">
                      <div className="bg-gray-200 text-center py-2">
                        <h3 className="text-sm font-semibold uppercase text-gray-700">TIPO DE CARGA</h3>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-2">
                          {["CEREALES", "AZÚCAR CRUDA", "CARBÓN", "MELAZA", "GRASA AMARILLA", "YESO"].map((tipo) => (
                            <label key={tipo} className="inline-flex items-center space-x-1">
                              <input
                                type="checkbox"
                                value={tipo}
                                checked={
                                  viewData.barco.tipoCarga
                                    ? viewData.barco.tipoCarga.includes(tipo)
                                    : false
                                }
                                readOnly
                                className="h-4 w-4"
                              />
                              <span className="text-xs whitespace-nowrap">{tipo}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="border rounded-md">
                      <div className="bg-gray-200 text-center py-2">
                        <h3 className="text-sm font-semibold uppercase text-gray-700">SISTEMA UTILIZADO</h3>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-2">
                          {["UNIDAD DE CARGA", "SUCCIONADORA", "ALMEJA", "CHINGUILLOS", "EQUIPO BULHER", "ALAMBRE"].map((sistema) => (
                            <label key={sistema} className="inline-flex items-center space-x-1">
                              <input
                                type="checkbox"
                                value={sistema}
                                checked={
                                  viewData.barco.sistemaUtilizado
                                    ? viewData.barco.sistemaUtilizado.includes(sistema)
                                    : false
                                }
                                readOnly
                                className="h-4 w-4"
                              />
                              <span className="text-xs whitespace-nowrap">{sistema}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Campos de fechas y horas del Barco */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  {/* ARRIBO */}
                  <div className="border rounded-md p-4">
                    <label className="block text-base font-semibold mb-2 uppercase">ARRIBO</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Fecha Arribo</label>
                        <input
                          type="date"
                          name="arriboFecha"
                          value={viewData.barco.fechaArribo || ""}
                          readOnly
                          className="w-full border rounded-md px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Hora Arribo</label>
                        <input
                          type="time"
                          name="arriboHora"
                          value={viewData.barco.horaArribo || ""}
                          readOnly
                          className="w-full border rounded-md px-2 py-1"
                        />
                      </div>
                    </div>
                  </div>
                  {/* ATRAQUE */}
                  <div className="border rounded-md p-4">
                    <label className="block text-base font-semibold mb-2 uppercase">ATRAQUE</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Fecha Atraque</label>
                        <input
                          type="date"
                          name="atraqueFecha"
                          value={viewData.barco.fechaAtraque || ""}
                          readOnly
                          className="w-full border rounded-md px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Hora Atraque</label>
                        <input
                          type="time"
                          name="atraqueHora"
                          value={viewData.barco.horaAtraque || ""}
                          readOnly
                          className="w-full border rounded-md px-2 py-1"
                        />
                      </div>
                    </div>
                  </div>
                  {/* RECIBIDO */}
                  <div className="border rounded-md p-4">
                    <label className="block text-base font-semibold mb-2 uppercase">RECIBIDO</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Fecha Recibido</label>
                        <input
                          type="date"
                          name="recibidoFecha"
                          value={viewData.barco.fechaRecibido || ""}
                          readOnly
                          className="w-full border rounded-md px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Hora Recibido</label>
                        <input
                          type="time"
                          name="recibidoHora"
                          value={viewData.barco.horaRecibido || ""}
                          readOnly
                          className="w-full border rounded-md px-2 py-1"
                        />
                      </div>
                    </div>
                  </div>
                  {/* INICIO OPERACIONES */}
                  <div className="border rounded-md p-4">
                    <label className="block text-base font-semibold mb-2 uppercase">INICIO OPERACIONES</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Fecha Inicio</label>
                        <input
                          type="date"
                          name="inicioOperacionesFecha"
                          value={viewData.barco.fechaInicioOperaciones || ""}
                          readOnly
                          className="w-full border rounded-md px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Hora Inicio</label>
                        <input
                          type="time"
                          name="inicioOperacionesHora"
                          value={viewData.barco.horaInicioOperaciones || ""}
                          readOnly
                          className="w-full border rounded-md px-2 py-1"
                        />
                      </div>
                    </div>
                  </div>
                  {/* FIN OPERACIONES */}
                  <div className="border rounded-md p-4">
                    <label className="block text-base font-semibold mb-2 uppercase">FIN OPERACIONES</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Fecha Fin</label>
                        <input
                          type="date"
                          name="finOperacionesFecha"
                          value={viewData.barco.fechaFinOperaciones || ""}
                          readOnly
                          className="w-full border rounded-md px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Hora Fin</label>
                        <input
                          type="time"
                          name="finOperacionesHora"
                          value={viewData.barco.horaFinOperaciones || ""}
                          readOnly
                          className="w-full border rounded-md px-2 py-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Sección: Bitácoras de Operaciones */}
              <section className="max-w-5xl mx-auto bg-white shadow-md p-2 mb-4 rounded-md">
                <h2 className="text-xl font-bold mb-4">Bitácoras</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">
                      FECHA INICIO
                    </label>
                    <input
                      type="text"
                      name="fechaInicio"
                      value={viewData.fechaInicio}
                      readOnly
                      className="w-full h-9 border border-gray-300 rounded-md px-2 py-1 text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">
                      FECHA CIERRE
                    </label>
                    <input
                      type="text"
                      name="fechaCierre"
                      value={viewData.fechaCierre || ""}
                      readOnly
                      className="w-full h-9 border border-gray-300 rounded-md px-2 py-1 text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">
                      MUELLERO
                    </label>
                    <input
                      type="text"
                      name="nombreMuellero"
                      value={viewData.muellero}
                      readOnly
                      placeholder="Ej: Juan Pérez"
                      className="w-full border border-gray-300 rounded-md px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">
                      Inicio Turno
                    </label>
                    <input
                      type="time"
                      name="turnoInicio"
                      value={viewData.turnoInicio}
                      readOnly
                      className="w-full border border-gray-300 rounded-md px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">
                      Termina Turno
                    </label>
                    <input
                      type="time"
                      name="turnoFin"
                      value={viewData.turnoFin}
                      readOnly
                      className="w-full border border-gray-300 rounded-md px-2 py-1"
                    />
                  </div>
                </div>

                {/* Sección: Tabla de Operaciones */}
                <section className="mb-6 border rounded-md p-2">
                  <h2 className="text-lg font-semibold mb-2 uppercase">
                    Bitácora de Operaciones
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border text-sm">
                      <thead className="bg-gray-100 text-gray-700">
                        <tr>
                          <th className="p-2 border text-center whitespace-nowrap">BODEGA</th>
                          <th className="p-2 border text-center whitespace-nowrap">INICIO</th>
                          <th className="p-2 border text-center whitespace-nowrap">FINAL</th>
                          <th className="p-2 border text-center whitespace-nowrap">MINUTOS</th>
                          <th className="p-2 border text-center whitespace-nowrap">ACTIVIDAD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewData.operaciones.map((op, index) => (
                          <tr key={index} className="border-b">
                            <td className="p-2 border text-center whitespace-nowrap">{op.bodega}</td>
                            <td className="p-2 border text-center whitespace-nowrap">{op.inicio}</td>
                            <td className="p-2 border text-center whitespace-nowrap">{op.final}</td>
                            <td className="p-2 border text-center whitespace-nowrap">{op.minutos}</td>
                            <td className="p-2 border text-center whitespace-nowrap">{op.actividad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Sección: Observaciones */}
                <section className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">
                    Observaciones
                  </label>
                  <textarea
                    name="observaciones"
                    value={viewData.observaciones}
                    disabled
                    readOnly
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-2 py-1 resize-y whitespace-nowrap"
                    placeholder="No hay observaciones."
                  />
                </section>
              </section>
            </div>
            <div className="flex justify-end mt-6 gap-3">
              {roleId === 1 && 
              (
              <button
                onClick={handleGenerarPDF}
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
              >
                <FaFilePdf size={24} />
                Reporte PDF
              </button>
              )}
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setRenderPDFLink(false);
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
              >
                Cerrar
              </button>
            </div>
            {renderPDFLink && viewData && (
              <DownloadPDF
                key={pdfKey}
                pdfKey={pdfKey}
                viewData={viewData}
                fileName={`Bitacora-${viewData.id}-${new Date().toISOString()}.pdf`}
                onDownload={() => setRenderPDFLink(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
