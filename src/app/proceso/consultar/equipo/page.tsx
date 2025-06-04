"use client";

import React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { FiArrowLeft, FiFileText, FiRefreshCw } from "react-icons/fi";
import Swal from "sweetalert2";
import PDFEquipo from "@/components/PDFEquipo";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { FaFilePdf } from "react-icons/fa";
import { useRouter } from "next/navigation";
import DataTable from "@/components/DataTable";
import { showErrorAlert } from "@/lib/errorAlert";

// Types
interface Inspeccion {
  id: number;
  titulo: string;
  cumple: boolean;
  observaciones?: string;
}

interface Equipo {
  id: number;
  fecha: string;
  hora: string;
  horaFin?: string;
  tiempoTotal?: string;
  equipo: string;
  operador: string;
  turnoInicio: string;
  turnoFin: string;
  horometro: string;
  recomendaciones?: string;
  inspecciones: Inspeccion[];
}

interface User {
  roleId?: number;
}

interface Session {
  user?: User;
}

interface EquiposResponse {
  data: {
    equipos: Equipo[];
    totalCount: number;
  };
}

// Función debounce
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

// Componente auxiliar que se encarga de descargar el PDF
interface DownloadPDFProps {
  viewData: Equipo;
  pdfKey: number;
  fileName: string;
  onDownload: () => void;
}

function DownloadPDF({ viewData, pdfKey, fileName, onDownload }: DownloadPDFProps) {
  const downloadTriggered = useRef<boolean>(false);

  return (
    <div style={{ display: "none" }}>
      <PDFDownloadLink
        key={pdfKey}
        document={<PDFEquipo formData={viewData} />}
        fileName={fileName}
      >
        {({ loading, blob, url, error }) => {
          if (error && !downloadTriggered.current) {
            downloadTriggered.current = true;
            Swal.close();
            Swal.fire("Error", "Error generando reporte: " + error, "error");
          }
          if (!loading && blob && url && !downloadTriggered.current) {
            downloadTriggered.current = true;
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            Swal.close();
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


export default function EquiposPage() {
  const router = useRouter();
  const { data: session } = useSession() as { data: Session | null };
  // Extraemos el roleId de la sesión (suponiendo que viene en session.user.roleId)
  const roleId: number | null = session?.user?.roleId || null;

  // Estados para el listado de equipos, paginación y búsqueda
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [expandedRows, setExpandedRows] = useState<number[]>([]);

  // Estados para filtros de fecha (para consulta y exportación)
  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFinal, setFechaFinal] = useState<string>("");
  
  // Estados para loading de exportación y refresco
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [refreshLoading, setRefreshLoading] = useState<boolean>(false);

  // Estados para el modal de detalles y para la generación del PDF
  const [showViewModal, setShowViewModal] = useState<boolean>(false);
  const [viewData, setViewData] = useState<Equipo | null>(null);
  const [renderPDFLink, setRenderPDFLink] = useState<boolean>(false);
  const [pdfKey, setPdfKey] = useState<number>(0);

  // Función debounced para actualizar la búsqueda
  const debouncedSetSearch = useCallback(
    debounce((value: string) => {
      setSearch(value);
    }, 500),
    []
  );

  // Función para iniciar la descarga del PDF con alerta de carga
  const handleGenerarPDF = (): void => {
    Swal.fire({
      title: "Generando Reporte...",
      html: "Por favor, espera un momento.",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    setRenderPDFLink(true);
    setPdfKey((prev) => prev + 1);
  };

  // Función para obtener equipos de la API
  async function fetchEquipos() {
    setLoading(true);
    try {
      const pageParam = page < 1 ? 1 : page;
      const res = await fetch(`/api/v1/equipos?search=${search}&page=${pageParam}&limit=${limit}`);
      const data: EquiposResponse = await res.json();
      setEquipos(data.data.equipos || []);
      //console.log("Equipos obtenidos:", data.data.equipos);
      setTotalCount(data.data.totalCount || 0);
    } catch(error) {
      console.log(error);
      showError("No se pudieron actualizar los datos");
    } finally {
      setLoading(false);
    }
  }

    useEffect(() => {
      fetchEquipos();
    }, [search, page, limit]);

  // Función para exportar a Excel; este botón solo estará disponible para roleId igual a 1
  const handleExportarExcel = async (): Promise<void> => {
    if (!fechaInicio || !fechaFinal) {
      Swal.fire("Información", "Debe seleccionar la fecha de Inicio y Final.", "warning");
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
        `/api/v1/equipos/export-excel?fechaInicio=${fechaInicio}&fechaFinal=${fechaFinal}`
      );
      if (!response.ok) {
        const err = await response.json();
        await showErrorAlert(err, "No se pudo generar el reporte");
        setExportLoading(false);
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = `Inspeccion_Equipos-${fechaInicio}-${fechaFinal}.xlsx`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toastSuccess("Reporte generado");
      } catch(error) {
          console.log(error);
          showError("No se pudo eliminar el producto");
      } finally {
      setExportLoading(false);
    }
  };

  const filteredEquipos = equipos.filter((b) => {
    const fechaEquipo = new Date(b.fecha);
    const inicio = fechaInicio ? new Date(fechaInicio) : null;
    const fin = fechaFinal ? new Date(fechaFinal) : null;

    if (inicio && fin) {
      return fechaEquipo >= inicio && fechaEquipo <= fin;
    } else if (inicio) {
      return fechaEquipo >= inicio;
    } else if (fin) {
      return fechaEquipo <= fin;
    }
    return true;
  });

  // Función para Actualizar la lista de equipos
  const refreshData = async (): Promise<void> => {
  try
    {
    setRefreshLoading(true);
    await fetchEquipos();
    setRefreshLoading(false);
      toastSuccess("Datos actualizados");
    } catch(error) {
      console.log(error);
      showError("No se pudieron actualizar los datos");
    }
  };

  // Función para expandir/contraer la lista de inspecciones en la tabla
  const toggleRow = (id: number): void => {
    if (expandedRows.includes(id)) {
      setExpandedRows(expandedRows.filter((rid) => rid !== id));
    } else {
      setExpandedRows([...expandedRows, id]);
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  // Abre el modal con los detalles del equipo seleccionado
  const handleViewDetails = (equipo: Equipo): void => {
    setViewData(equipo);
    setShowViewModal(true);
    setRenderPDFLink(false);
  };

     // Configuración de columnas y acciones para DataTable
  const columns = [
    {
      key: "fecha",
      label: "Fecha",
      render: (_: any, row: Equipo) => `${row.fecha} ${row.hora}`
    },
    {
      key: "horaFin",
      label: "Hora Fin",
      render: (_: any, row: Equipo) => row.horaFin || "-",
      condition: () => roleId === 1 || roleId === 6
    },
    {
      key: "tiempoTotal",
      label: "Tiempo Total",
      render: (_: any, row: Equipo) => row.tiempoTotal || "-",
      condition: () => roleId === 1 || roleId === 6
    },
    { key: "equipo", label: "Equipo" },
    { key: "operador", label: "Operador" },
    {
      key: "turno",
      label: "Turno",
      render: (_: any, row: Equipo) => `${row.turnoInicio} - ${row.turnoFin}`
    }
  ];

  const actions = [
    {
      type: "view" as const,
      onClick: handleViewDetails,
      title: "Ver detalles"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Encabezado */}
      <header className="bg-[#003E9B] text-white shadow-lg md:sticky md:top-0 z-50">
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
              <h1 className="text-xl font-bold">Historial de Equipos</h1>
            </div>
            <div className="grid grid-cols-2 md:flex md:flex-row items-center mt-4 md:mt-0 gap-3">
              {/* El botón de exportar Excel se renderiza solo si roleId es 1 o 6 */}
              {(roleId === 1 || roleId === 6) && (
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
            {(roleId === 1 || roleId === 6) && (
            <div className="flex flex-col">
              <label className="text-sm">Buscar</label>
              <input
                type="text"
                placeholder="Buscar por equipo, operador..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  debouncedSetSearch(e.target.value);
                  setPage(1);
                }}
                className="border text-black p-1 w-full rounded"
              />
            </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="container mx-auto px-4 py-6">

      {/* Contenido principal */}
      <section className="bg-white p-4 rounded-lg shadow space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
          <h2 className="text-lg font-semibold mb-2 md:mb-0">Equipos</h2>
        </div>
        <div>
          <DataTable<Equipo>
            data={filteredEquipos}
            columns={columns}
            actions={actions}
            loading={loading}
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={limit}
            onPageChange={setPage}
            onPageSizeChange={size => { setLimit(size); setPage(1); }}
            pageSizeOptions={[10, 25, 50, 100, 200]}
            emptyMessage="No hay registros"
            tableId="equipos-table"
            tableClassName="min-w-full border text-sm bg-white rounded-lg shadow"
            headerClassName="bg-gray-200"
            showPagination={true}
          />
        </div>
      </section>
      </div>

      {/* Modal de ver detalles */}
      {showViewModal && viewData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
          <div className="bg-white w-full max-w-7xl shadow-lg p-4 relative max-h-[98vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Detalles del Equipo</h2>
            </div>
            <div className="mb-6">
              <table className="min-w-full border-collapse table-auto">
                <tbody>
                  <tr>
                    <td className="px-4 py-3 border-2 border-gray-500">
                      <div className="space-y-4 sm:space-y-0 sm:flex sm:space-x-4">
                        <div className="sm:flex-1">
                          <label className="block text-base font-semibold text-gray-800 mb-1 uppercase">
                            Equipo
                          </label>
                          <input
                            type="text"
                            value={viewData.equipo}
                            readOnly
                            className="w-full p-2 text-base border-2 border-gray-500 rounded-md"
                          />
                        </div>
                        <div className="sm:flex-1">
                          <label className="block text-base font-semibold text-gray-800 mb-1 uppercase">
                            Horómetro
                          </label>
                          <input
                            type="text"
                            value={viewData.horometro}
                            readOnly
                            className="w-full p-2 text-base border-2 border-gray-500 rounded-md"
                          />
                        </div>
                        <div className="sm:flex-1">
                          <label className="block text-base font-semibold text-gray-800 mb-1 uppercase">
                            Fecha
                          </label>
                          <input
                            type="text"
                            value={`${viewData.fecha} ${viewData.hora}`}
                            readOnly
                            className="w-full p-2 text-base border-2 border-gray-500 rounded-md"
                          />
                        </div>
                        {(roleId === 1 || roleId === 6) && (
                          <div className="sm:flex-1">
                            <label className="block text-base font-semibold text-gray-800 mb-1 uppercase">
                              Hora Fin
                            </label>
                            <input
                              type="time"
                              value={viewData.horaFin || ""}
                              readOnly
                              className="w-full p-2 text-base border-2 border-gray-500 rounded-md"
                            />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 border-2 border-gray-500" colSpan={3}>
                      <div className="flex flex-col sm:flex-row sm:space-x-4">
                      {(roleId === 1 || roleId === 6) && (
                          <div className="flex-1">
                            <label className="block text-base font-semibold text-gray-800 mb-1 uppercase">
                              Tiempo Total
                              </label>
                              <input
                              type="text"
                              value={viewData.tiempoTotal || ""}
                              readOnly
                              className="w-full p-2 text-base border-2 border-gray-500 rounded-md"
                              placeholder="Sin tiempo total"
                              />
                          </div>
                            )}
                        <div className="sm:flex-1">
                          <label className="block text-base font-semibold text-gray-800 mb-1 uppercase">
                            Operador
                          </label>
                          <input
                            type="text"
                            value={viewData.operador}
                            readOnly
                            className="w-full p-2 text-base border-2 border-gray-500 rounded-md"
                            placeholder="Ingrese nombre del operador"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-base font-semibold text-gray-800 mb-1 uppercase">
                            INICIO TURNO
                          </label>
                          <input
                            type="time"
                            name="turnoInicio"
                            value={viewData.turnoInicio}
                            readOnly
                            className="w-full text-base border-2 border-gray-500 rounded-md px-2 py-1"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-base font-semibold text-gray-800 mb-1 uppercase">
                            TERMINA TURNO
                          </label>
                          <input
                            type="time"
                            name="turnoFin"
                            value={viewData.turnoFin}
                            readOnly
                            className="w-full text-base border-2 border-gray-500 rounded-md px-2 py-1"
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-4">Inspecciones</h3>
              <div className="block md:hidden">
                {viewData.inspecciones.map((item, index) => (
                  <div key={item.id} className="p-4 border-2 border-gray-500 rounded-md mb-4">
                    <div className="flex items-center mb-3">
                      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-blue-600 text-white text-base mr-2">
                        {index + 1}
                      </div>
                      <span className="font-semibold text-gray-800 text-base">{item.titulo}</span>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-gray-800 text-base">¿Cumple condición?</span>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-1 text-gray-800 text-base">
                          <input
                            type="checkbox"
                            checked={item.cumple === true}
                            readOnly
                            className="form-checkbox h-6 w-6 accent-orange-500"
                          />
                          <span>SI</span>
                        </label>
                        <label className="flex items-center space-x-1 text-gray-800 text-base">
                          <input
                            type="checkbox"
                            checked={item.cumple === false}
                            readOnly
                            className="form-checkbox h-6 w-6 accent-orange-500"
                          />
                          <span>NO</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-800 font-semibold text-base mb-1">
                        Observaciones:
                      </label>
                      <textarea
                        placeholder="Sin observaciones."
                        value={item.observaciones || ""}
                        readOnly
                        className="w-full text-base border-2 border-gray-500 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y min-h-[10px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr>
                      <th scope="col" className="px-4 py-3 border-2 border-gray-500 text-base font-bold text-gray-800">
                        N°
                      </th>
                      <th scope="col" className="px-4 py-3 border-2 border-gray-500 text-base font-bold text-gray-800">
                        Parte Evaluada
                      </th>
                      <th scope="col" className="px-4 py-3 border-2 border-gray-500 text-base font-bold text-gray-800">
                        Cumple
                      </th>
                      <th scope="col" className="px-4 py-3 border-2 border-gray-500 text-base font-bold text-gray-800">
                        Observaciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewData.inspecciones.map((item, index) => (
                      <tr key={item.id}>
                        <th scope="row" className="px-4 py-3 border-2 border-gray-500 text-base text-gray-700">
                          {index + 1}
                        </th>
                        <td className="px-4 py-3 border-2 border-gray-500 text-base text-gray-700">
                          {item.titulo}
                        </td>
                        <td className="px-4 py-3 border-2 border-gray-500 text-base text-gray-700">
                          <div className="flex justify-center items-center space-x-4">
                            <label className="flex items-center space-x-1">
                              <input
                                type="checkbox"
                                checked={item.cumple === true}
                                readOnly
                                className="form-checkbox h-6 w-6 accent-orange-500"
                              />
                              <span className="text-base">SI</span>
                            </label>
                            <label className="flex items-center space-x-1">
                              <input
                                type="checkbox"
                                checked={item.cumple === false}
                                readOnly
                                className="form-checkbox h-6 w-6 accent-orange-500"
                              />
                              <span className="text-base">NO</span>
                            </label>
                          </div>
                        </td>
                        <td className="px-4 py-3 border-2 border-gray-500 text-base text-gray-700">
                          <textarea
                            value={item.observaciones || ""}
                            readOnly
                            className="w-full text-base border-2 border-gray-500 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y min-h-[10px]"
                            placeholder="Sin observaciones."
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mb-6">
              <label className="block mb-1 text-base font-semibold text-gray-800">
                Recomendaciones:
              </label>
              <textarea
                value={viewData.recomendaciones || ""}
                readOnly
                className="w-full text-base border-2 border-gray-500 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y min-h-[120px]"
                placeholder="Ingrese recomendaciones aquí..."
              />
            </div>
            <div className="mt-4 flex justify-end gap-4">
            {(roleId === 1 || roleId === 6) && (
              <button
                onClick={handleGenerarPDF}
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
              >
                Reporte PDF
                <FaFilePdf size={24} />
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
                fileName={`Equipo-${viewData.id}-${new Date().toISOString()}.pdf`}
                onDownload={() => setRenderPDFLink(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
