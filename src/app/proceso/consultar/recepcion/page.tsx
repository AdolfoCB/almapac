"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FiArrowLeft, FiFileText, FiRefreshCw } from "react-icons/fi";
import { FaEye, FaFilePdf } from "react-icons/fa";
import Swal from "sweetalert2";
import PDFRecepcion from "@/components/PDFRecepcion";
import { PDFDownloadLink } from "@react-pdf/renderer";
import DataTable from "@/components/DataTable";

// --- Modal Imports ---
import { BaseModal } from "@/components/modals/BaseModal";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { ViewModal, ViewField } from "@/components/modals/ViewModal";
import { CreateEditModal, FormField } from "@/components/modals/CreateEditModal";
import { TableModal, TableColumn } from "@/components/modals/TableModal";

// debounce helper
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

interface Bitacora {
  transporte: string;
  placa: string;
  ticket: string;
  horaInicio: string;
  horaFinal: string;
  tiempoTotal: string;
  motorista: string;
  observaciones?: string;
}

interface Recepcion {
  id: number;
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
  bitacoras: Bitacora[];
  estado: string;
  eliminado?: boolean;
}

interface Session {
  user?: User;
}

interface User {
  roleId?: number;
}

interface RecepcionResponse {
  data: {
    recepciones: Recepcion[];
    totalCount: number;
  };
}

interface DownloadPDFProps {
  viewData: Recepcion;
  pdfKey: number;
  fileName: string;
  onDownload: () => void;
}

function DownloadPDF({
  viewData,
  pdfKey,
  fileName,
  onDownload,
}: DownloadPDFProps) {
  const downloadTriggered = useRef(false);

  return (
    <div style={{ display: "none" }}>
      <PDFDownloadLink
        key={pdfKey}
        document={<PDFRecepcion data={viewData} />}
        fileName={fileName}
      >
        {({ loading, blob, url, error }) => {
          if (error && !downloadTriggered.current) {
            downloadTriggered.current = true;
            Swal.close();
            Swal.fire("Error", "Error generando PDF: " + error, "error");
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
            Swal.fire("Éxito", "Reporte generado correctamente.", "success");
            setTimeout(onDownload, 0);
          }
          return null;
        }}
      </PDFDownloadLink>
    </div>
  );
}

export default function RecepcionPage() {
  const { data: session } = useSession() as { data: Session | null };
  const roleId: number | null = session?.user?.roleId || null;

  const [recepciones, setRecepciones] = useState<Recepcion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);

  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFinal, setFechaFinal] = useState<string>("");
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [refreshLoading, setRefreshLoading] = useState<boolean>(false);

  const [showViewModal, setShowViewModal] = useState<boolean>(false);
  const [viewData, setViewData] = useState<Recepcion | null>(null);
  const [renderPDFLink, setRenderPDFLink] = useState<boolean>(false);
  const [pdfKey, setPdfKey] = useState<number>(0);

  const debouncedSetSearch = useCallback(
    debounce((v: string) => setSearch(v), 500),
    []
  );

  const router = useRouter();

  async function fetchRecepcion() {
    setLoading(true);
    try {
      const pageParam = page < 1 ? 1 : page;
      const res = await fetch(
        `/api/v1/recepcion?search=${encodeURIComponent(
          search
        )}&page=${pageParam}&limit=${limit}`
      );
      const data: RecepcionResponse = await res.json();
      setRecepciones(data.data.recepciones);
      setTotalCount(data.data.totalCount);
    } catch (error) {
      console.error("Error al listar recepciones y traslados:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo obtener la lista de recepciones y traslados",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRecepcion();
  }, [search, page, limit]);

  const refreshData = async () => {
    setRefreshLoading(true);
    await fetchRecepcion();
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

  const handleExportarExcel = async () => {
    if (!fechaInicio || !fechaFinal) {
      return Swal.fire(
        "Información",
        "Debe seleccionar fecha Inicio y Final.",
        "warning"
      );
    }
    setExportLoading(true);
    Swal.fire({
      title: "Generando Reporte...",
      html: "Por favor, espera un momento.",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const resp = await fetch(
        `/api/v1/recepcion/export-excel?fechaInicio=${fechaInicio}&fechaFinal=${fechaFinal}`
      );
      if (!resp.ok) throw new Error(resp.statusText);
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Recepciones_Traslados-${fechaInicio}-${fechaFinal}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      Swal.fire("Éxito", "Reporte generado correctamente.", "success");
    } catch (err: any) {
      Swal.fire("Error", "Error generando reporte: " + err.message, "error");
    } finally {
      setExportLoading(false);
    }
  };

  const handleViewDetails = (item: Recepcion) => {
    setViewData(item);
    setShowViewModal(true);
    setRenderPDFLink(false);
  };

  const handleGenerarPDF = () => {
    if (!viewData) return;
    Swal.fire({
      title: "Generando Reporte...",
      html: "Por favor, espera un momento.",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    setRenderPDFLink(true);
    setPdfKey((k) => k + 1);
  };

  const handleEditRecord = (item: Recepcion) => {
    localStorage.setItem("recepcionId", item.id.toString());
    router.push(`/proceso/editar/recepcion`);
  };

  // Filtrado por fecha local (para mostrar en tabla)
  const filtered = recepciones.filter((r) => {
    const f = new Date(r.fecha);
    const i = fechaInicio ? new Date(fechaInicio) : null;
    const j = fechaFinal ? new Date(fechaFinal) : null;
    if (i && j) return f >= i && f <= j;
    if (i) return f >= i;
    if (j) return f <= j;
    return true;
  });

  const totalPages = Math.ceil(totalCount / limit);

  // Función para asignar colores a la etiqueta de rol (colores distintos para cada estado)
  const getRoleBadgeClass = (estado?: string) => {
    if (!estado) return "bg-yellow-200 text-yellow-800";
    const r = estado.toLowerCase();
    if (r.includes("creada")) return "bg-blue-200 text-blue-800 font-bold";
    if (r.includes("proceso")) return "bg-orange-200 text-orange-800 font-bold";
    if (r.includes("completada")) return "bg-green-200 text-green-800 font-bold";
    if (r.includes("eliminada")) return "bg-red-200 text-red-800 font-bold";
    return "bg-gray-200 text-gray-800";
  };

  // Definición de columnas para DataTable
  const columns = [
    {
      key: "fecha",
      label: "Fecha",
      render: (_: any, row: Recepcion) => `${row.fecha}`,
      className: "whitespace-nowrap",
      align: "center" as const,
      noWrap: true,
    },
    {
      key: "producto",
      label: "Producto",
      className: "whitespace-nowrap",
      align: "center" as const,
      noWrap: true,
    },
    {
      key: "nombreBarco",
      label: "Barco",
      className: "whitespace-nowrap",
      align: "center" as const,
      noWrap: true,
    },
    {
      key: "chequero",
      label: "Chequero",
      className: "whitespace-nowrap",
      align: "center" as const,
      noWrap: true,
    },
    {
      key: "turno",
      label: "Turno",
      render: (_: any, row: Recepcion) => `${row.turnoInicio} - ${row.turnoFin}`,
      className: "whitespace-nowrap",
      align: "center" as const,
      noWrap: true,
    },
    {
      key: "puntoCarga",
      label: "Punto Carga",
      className: "whitespace-nowrap",
      align: "center" as const,
      noWrap: true,
      render: (_: any, row: Recepcion) => row.puntoCarga,
    },
    {
      key: "puntoDescarga",
      label: "Punto Descarga",
      className: "whitespace-nowrap",
      align: "center" as const,
      noWrap: true,
      render: (_: any, row: Recepcion) => row.puntoDescarga,
    },
    {
      key: "bitacorasCount",
      label: "Bitácoras",
      render: (_: any, row: Recepcion) => row.bitacoras.length.toString(),
      className: "whitespace-nowrap",
      align: "center" as const,
      noWrap: true,
    },
    {
      key: "estado",
      label: "Estado",
      render: (_: any, row: Recepcion) => (
        <span
          className={`px-2 py-1 rounded-md text-sm font-medium ${getRoleBadgeClass(
            row.estado || "-"
          )}`}
        >
          {row.estado || "-"}
        </span>
      ),
      noWrap: true,
    },
  ];

  // Acciones (botones) para cada fila
  const actions = [
    {
      type: "view" as const,
      onClick: handleViewDetails,
      title: "Ver detalles",
      className:
        "bg-blue-500 hover:bg-blue-600 text-white p-2 rounded ml-2 transition-all duration-300 transform hover:scale-105 text-xs",
    },
    ...(roleId === 1
      ? [
          {
            type: "edit" as const,
            onClick: handleEditRecord,
            title: "Editar",
            className:
              "bg-amber-500 hover:bg-amber-600 text-white p-2 rounded ml-2 transition-all duration-300 transform hover:scale-105 text-xs",
          },
        ]
      : []),
  ];

  // Configuración de campos para ViewModal
  const recepcionViewFields: ViewField[] = [
    {
      key: "fecha",
      label: "Fecha",
      type: "text",
      value: "",
    },
    {
      key: "producto",
      label: "Producto",
      type: "text",
      value: "",
    },
    {
      key: "nombreBarco",
      label: "Barco",
      type: "text",
      value: "",
    },
    {
      key: "chequero",
      label: "Chequero",
      type: "text",
      value: "",
    },
    {
      key: "turnoInicio",
      label: "Turno",
      type: "text",
      value: "",
      render: (_: any) =>
        `${viewData?.turnoInicio || ""} - ${viewData?.turnoFin || ""}`,
    },
    {
      key: "puntoCarga",
      label: "Punto de Carga",
      type: "text",
      value: "",
    },
    {
      key: "puntoDescarga",
      label: "Punto de Descarga",
      type: "text",
      value: "",
    },
    {
      key: "bitacoras",
      label: "Bitácoras de Transporte",
      type: "object",
      value: [],
      fullWidth: true,
      render: (bitacoras: Bitacora[]) => {
        if (!Array.isArray(bitacoras) || bitacoras.length === 0) {
          return (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiFileText className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500">No hay bitácoras registradas</p>
            </div>
          );
        }
        return (
          <div className="space-y-4">
            {bitacoras.map((bitacora, index) => (
              <div
                key={index}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-bold text-sm">
                          {index + 1}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {bitacora.transporte}
                        </h4>
                        <p className="text-sm text-gray-500">
                          Placa: {bitacora.placa}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {bitacora.horaInicio} → {bitacora.horaFinal}
                      </div>
                      <div className="text-xs text-gray-500">
                        Duración: {bitacora.tiempoTotal}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Motorista</p>
                      <p className="font-medium text-gray-900">
                        {bitacora.motorista}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Ticket</p>
                      <p className="font-medium text-gray-900">
                        {bitacora.ticket}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Hora Inicio</p>
                      <p className="font-medium text-gray-900">
                        {bitacora.horaInicio}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Hora Final</p>
                      <p className="font-medium text-gray-900">
                        {bitacora.horaFinal}
                      </p>
                    </div>
                  </div>

                  {bitacora.observaciones && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-600 font-medium mb-1">
                        Observaciones
                      </p>
                      <p className="text-sm text-amber-800">
                        {bitacora.observaciones}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      },
    },
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
              <h1 className="text-xl font-bold">Recepciones & Traslados</h1>
            </div>
            <div className="grid grid-cols-2 md:flex md:flex-row items-center mt-4 md:mt-0 gap-3">
              {(roleId === 1 || roleId === 4) && (
                <button
                  onClick={handleExportarExcel}
                  className="bg-green-700 hover:bg-green-800 text-white px-3 py-2 rounded flex items-center gap-1 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
                  disabled={exportLoading}
                >
                  {exportLoading ? (
                    <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" />
                  ) : (
                    <FiFileText size={20} />
                  )}
                  <span>Reporte Excel</span>
                </button>
              )}
              <button
                onClick={refreshData}
                className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded flex items-center gap-1 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
                disabled={refreshLoading}
              >
                {refreshLoading ? (
                  <span className="inline-block animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4"></span>
                ) : (
                  <FiRefreshCw size={20} />
                )}
                <span>Actualizar</span>
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
                value={fechaFinal}
                onChange={(e) => {
                  setFechaFinal(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            {(roleId === 1 || roleId === 4) && (
              <div className="flex flex-col">
                <label className="text-sm">Buscar</label>
                <input
                  type="text"
                  placeholder="Buscar por producto, barco..."
                  value={searchInput}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
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
            <h2 className="text-lg font-semibold mb-2 md:mb-0">Bitácoras</h2>
          </div>
          <div>
            <DataTable<Recepcion>
              data={filtered}
              columns={columns}
              actions={actions}
              loading={loading}
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={limit}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setLimit(size);
                setPage(1);
              }}
              pageSizeOptions={[10, 25, 50, 100, 200]}
              emptyMessage="No hay registros"
              tableId="recepcion-table"
              tableClassName="min-w-full border text-sm bg-white rounded-lg shadow"
              headerClassName="bg-gray-200"
              rowClassName={(row: Recepcion) =>
                row.eliminado ? "bg-gray-100 text-red-400 italic" : ""
              }
              showPagination={true}
            />
          </div>
        </section>
      </div>

      {/* ViewModal para detalle de Recepción */}
      {viewData && (
        <ViewModal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setRenderPDFLink(false);
          }}
          title={`Detalle de Recepción #${viewData.id}`}
          data={viewData}
          fields={recepcionViewFields}
          size="3xl"
          actions={[
            ...(roleId === 1 || roleId === 4
              ? [
                  {
                    label: "Reporte PDF",
                    onClick: handleGenerarPDF,
                    className:
                      "flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md",
                  },
                ]
              : []),
            {
              label: "Cerrar",
              onClick: () => {
                setShowViewModal(false);
                setRenderPDFLink(false);
              },
              className:
                "bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md",
            },
          ]}
        />
      )}

      {/* PDF Download Component */}
      {renderPDFLink && viewData && (
        <DownloadPDF
          key={pdfKey}
          pdfKey={pdfKey}
          viewData={viewData}
          fileName={`Recepciones_Traslados-${viewData.id}-${new Date().toISOString()}.pdf`}
          onDownload={() => setRenderPDFLink(false)}
        />
      )}

      {/* Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
