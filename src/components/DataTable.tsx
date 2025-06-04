import { useId } from "react";
import { FiEdit, FiEye, FiTrash2 } from "react-icons/fi";
import React from "react";

// Interfaces para la configuración del componente
interface ColorTag {
  value: string | number;
  color: string;
  textColor?: string;
  label?: string;
}

interface Column<T = any> {
  key: string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
  condition?: (row: any) => boolean;
  type?: "text" | "checkbox" | "colorTag";
  colorTags?: ColorTag[];
  onCheckboxChange?: (row: any, checked: boolean) => void;
  align?: "left" | "center" | "right";
  noWrap?: boolean;
  sanitize?: boolean;
}

interface ActionButton {
  type?: "view" | "edit" | "delete";
  onClick: (row: any) => void;
  icon?: React.ReactNode;
  className?: string;
  title?: string;
  condition?: (row: any) => boolean;
}

interface DataTableProps<T = any> {
  data: T[];
  columns: Column[];
  actions?: ActionButton[];
  loading?: boolean;
  // Props para paginación
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  // Props opcionales
  emptyMessage?: string;
  pageSizeOptions?: number[];
  showPagination?: boolean;
  tableClassName?: string;
  headerClassName?: string;
  rowClassName?: (row: T) => string;
  // Nueva prop para identificar la tabla
  tableId?: string;
}

export default function DataTable<T = any>({
  data,
  columns,
  actions = [],
  loading = false,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  emptyMessage = "No hay registros",
  pageSizeOptions = [10, 20, 50, 100, 200],
  showPagination = true,
  tableClassName = "min-w-full border text-sm bg-white",
  headerClassName = "bg-gray-300",
  rowClassName,
  tableId,
}: DataTableProps<T>) {
  // Generar un ID único para esta instancia de tabla
  const uniqueId = useId();
  const finalTableId = tableId || `datatable-${uniqueId}`;

  // Función para sanitizar texto
  const sanitizeText = (text: any): string => {
    if (text === null || text === undefined) return "";

    const str = String(text);

    // Reemplazar caracteres especiales con espacios, pero mantener espacios existentes
    const sanitized = str
      // Reemplazar comas, guiones, guiones bajos y otros caracteres especiales con espacios
      .replace(/[,\-_]/g, " ")
      // Reemplazar cualquier otro carácter especial (excepto letras, números y espacios) con espacios
      .replace(/[^\w\s]/g, " ")
      // Reemplazar múltiples espacios consecutivos con un solo espacio
      .replace(/\s+/g, " ")
      // Eliminar espacios al inicio y final
      .trim();

    return sanitized;
  };

  // Función para obtener el icono según el tipo de acción
  const getDefaultActionIcon = (type: ActionButton["type"]) => {
    switch (type) {
      case "view":
        return <FiEye size={18} />;
      case "edit":
        return <FiEdit size={18} />;
      case "delete":
        return <FiTrash2 size={18} />;
      default:
        return null;
    }
  };

  // Función para obtener la clase CSS según el tipo de acción
  const getActionClassName = (
    type: ActionButton["type"],
    customClassName?: string
  ) => {
    if (customClassName) return customClassName;

    const baseClasses =
      "p-2 rounded ml-2 transition-all duration-300 transform hover:scale-105 text-xs";

    switch (type) {
      case "view":
        return `bg-blue-500 hover:bg-blue-600 text-white ${baseClasses}`;
      case "edit":
        return `bg-amber-500 hover:bg-amber-600 text-white ${baseClasses}`;
      case "delete":
        return `bg-red-500 hover:bg-red-600 text-white ${baseClasses}`;
      default:
        return `bg-gray-500 hover:bg-gray-600 text-white ${baseClasses}`;
    }
  };

  // Función para obtener el título por defecto según el tipo de acción
  const getActionTitle = (
    type: ActionButton["type"],
    customTitle?: string
  ) => {
    if (customTitle) return customTitle;

    switch (type) {
      case "view":
        return "Ver detalles";
      case "edit":
        return "Editar";
      case "delete":
        return "Eliminar";
      default:
        return "";
    }
  };

  // Función para obtener las clases de alineación y formato de texto
  const getTextFormattingClasses = (column: Column) => {
    let classes: string[] = [];

    // Alineación
    switch (column.align) {
      case "left":
        classes.push("text-left");
        break;
      case "right":
        classes.push("text-right");
        break;
      case "center":
      default:
        classes.push("text-center");
        break;
    }

    // NoWrap
    if (column.noWrap) {
      classes.push("whitespace-nowrap");
    }

    return classes.join(" ");
  };

  // Función para renderizar etiquetas de colores
  const renderColorTag = (value: any, colorTags: ColorTag[]) => {
    const tag = colorTags.find((tag) => tag.value === value);
    if (!tag) return value || "-";

    return (
      <span
        className="px-2 py-1 rounded-full text-xs font-medium"
        style={{
          backgroundColor: tag.color,
          color: tag.textColor || "white",
        }}
      >
        {tag.label || value}
      </span>
    );
  };

  // Función para renderizar checkbox
  const renderCheckbox = (
    value: any,
    row: any,
    column: Column,
    rowIndex: number
  ) => {
    const checked = Boolean(value);
    const checkboxId = `${finalTableId}-checkbox-${rowIndex}-${column.key}`;

    return (
      <label
        className={`dt-switch dt-switch-${finalTableId}`}
        htmlFor={checkboxId}
      >
        <input
          id={checkboxId}
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            if (column.onCheckboxChange) {
              column.onCheckboxChange(row, e.target.checked);
            }
          }}
        />
        <span className="dt-slider"></span>
      </label>
    );
  };

  // Función para renderizar el contenido de la celda según el tipo
  const renderCellContent = (
    column: Column,
    value: any,
    row: any,
    rowIndex: number
  ) => {
    if (column.render) {
      return column.render(value, row);
    }

    let content;
    switch (column.type) {
      case "checkbox":
        return renderCheckbox(value, row, column, rowIndex);
      case "colorTag":
        content = column.colorTags
          ? renderColorTag(value, column.colorTags)
          : value || "-";
        break;
      default:
        content = value || "-";
        break;
    }

    // Aplicar sanitización si está habilitada para esta columna
    if (column.sanitize && content !== "-") {
      if (column.type === "colorTag" && column.colorTags) {
        // Para colorTags, solo sanitizar si no se encontró una etiqueta correspondiente
        const tag = column.colorTags.find((tag) => tag.value === value);
        if (!tag) {
          content = sanitizeText(content);
        }
      } else {
        content = sanitizeText(content);
      }
    }

    return content;
  };

  // Función para filtrar columnas que deben mostrarse para una fila específica
  const getVisibleColumns = (row: any) => {
    return columns.filter((column) => !column.condition || column.condition(row));
  };

  // Función para obtener todas las columnas únicas que podrían mostrarse
  const getAllPossibleColumns = () => {
    const allColumns = new Set<string>();

    // Agregar columnas que no tienen condición
    columns.forEach((column) => {
      if (!column.condition) {
        allColumns.add(column.key);
      }
    });

    // Verificar columnas condicionales contra todos los datos
    data.forEach((row) => {
      columns.forEach((column) => {
        if (column.condition && column.condition(row)) {
          allColumns.add(column.key);
        }
      });
    });

    // Retornar las columnas en el orden original
    return columns.filter((column) => allColumns.has(column.key));
  };

  // Obtener columnas que se mostrarán en el header
  const headerColumns = getAllPossibleColumns();

  return (
    <div className={`datatable-container datatable-${finalTableId}`}>
      {/* Estilos específicos para esta instancia de tabla */}
      <style>{`
        @keyframes dt-spin-slow-${finalTableId} {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .datatable-${finalTableId} .dt-animate-spin-slow {
          animation: dt-spin-slow-${finalTableId} 2s linear infinite;
        }

        .datatable-${finalTableId} .dt-switch {
          position: relative;
          display: inline-block;
          width: 40px;
          height: 20px;
        }

        .datatable-${finalTableId} .dt-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .datatable-${finalTableId} .dt-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.4s;
          border-radius: 20px;
        }

        .datatable-${finalTableId} .dt-slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 2px;
          bottom: 2px;
          background-color: white;
          transition: 0.4s;
          border-radius: 50%;
        }

        .datatable-${finalTableId} .dt-switch input:checked + .dt-slider {
          background-color: #4caf50;
        }

        .datatable-${finalTableId} .dt-switch input:checked + .dt-slider:before {
          transform: translateX(20px);
        }
      `}</style>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className={tableClassName}>
          <thead className={headerClassName}>
            <tr>
              {headerColumns.map((column) => (
                <th
                  key={column.key}
                  className={`p-2 border uppercase text-gray-700 ${getTextFormattingClasses(
                    column
                  )} ${column.className || ""}`}
                >
                  {column.label}
                </th>
              ))}
              {actions.length > 0 && (
                <th className="p-2 border text-center uppercase text-gray-700 whitespace-nowrap">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  className="p-2 border text-center"
                  colSpan={headerColumns.length + (actions.length > 0 ? 1 : 0)}
                >
                  <div className="flex justify-center items-center py-4">
                    <span className="inline-block animate-spin border-2 border-blue-500 border-t-transparent rounded-full w-6 h-6 mr-2"></span>
                    Cargando...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  className="p-2 border text-center"
                  colSpan={headerColumns.length + (actions.length > 0 ? 1 : 0)}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={index}
                  className={`border-b ${
                    rowClassName ? rowClassName(row) : ""
                  }`}
                >
                  {headerColumns.map((column) => {
                    // Verificar si esta columna debe mostrarse para esta fila específica
                    const shouldShowColumn =
                      !column.condition || column.condition(row);

                    return (
                      <td
                        key={column.key}
                        className={`p-2 border ${getTextFormattingClasses(
                          column
                        )} ${column.className || ""}`}
                      >
                        {shouldShowColumn ? (
                          renderCellContent(
                            column,
                            // @ts-ignore
                            row[column.key],
                            row,
                            index
                          )
                        ) : (
                          "-"
                        )}
                      </td>
                    );
                  })}
                  {actions.length > 0 && (
                    <td className="p-2 border text-center whitespace-nowrap">
                      {actions.map((action, actionIndex) => {
                        // Verificar si se debe mostrar el botón según la condición
                        if (action.condition && !action.condition(row)) {
                          return null;
                        }

                        return (
                          <button
                            key={actionIndex}
                            onClick={() => action.onClick(row)}
                            className={getActionClassName(
                              action.type,
                              action.className
                            )}
                            title={getActionTitle(
                              action.type,
                              action.title
                            )}
                          >
                            {action.icon || getDefaultActionIcon(action.type)}
                          </button>
                        );
                      })}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {showPagination && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 space-y-2 sm:space-y-0">
          <div className="flex overflow-x-auto space-x-2 w-full sm:w-auto">
            <button
              className="px-3 py-1 bg-white border rounded disabled:opacity-50 flex-shrink-0"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading || totalCount === 0}
            >
              Anterior
            </button>
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index}
                className={`px-3 py-1 border rounded flex-shrink-0 ${
                  currentPage === index + 1
                    ? "bg-blue-500 text-white"
                    : "bg-white"
                }`}
                onClick={() => onPageChange(index + 1)}
                disabled={loading}
              >
                {index + 1}
              </button>
            ))}
            <button
              className="px-3 py-1 bg-white border rounded disabled:opacity-50 flex-shrink-0"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || loading || totalCount === 0}
            >
              Siguiente
            </button>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 text-center">
            <span className="text-sm">
              Mostrando {data.length} de {totalCount} registros.
            </span>
            <div className="flex items-center gap-1">
              <label
                htmlFor={`recordsPerPage-${finalTableId}`}
                className="text-sm"
              >
                Mostrar:
              </label>
              <select
                id={`recordsPerPage-${finalTableId}`}
                value={pageSize}
                onChange={(e) =>
                  onPageSizeChange(parseInt(e.target.value, 10))
                }
                className="text-black px-2 py-1 rounded border"
                disabled={loading}
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}