// components/modals/TableModal.tsx - Para casos como transportes con tablas editables
import React from 'react';
import { BaseModal } from './BaseModal';
import { FiTrash2, FiPlus } from 'react-icons/fi';

export interface TableColumn {
  key: string;
  label: string;
  type?: 'text' | 'select';
  required?: boolean;
  options?: { value: any; label: string }[];
  render?: (value: any, item: any, index: number) => React.ReactNode;
}

interface TableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any[];
  columns: TableColumn[];
  onDataChange: (newData: any[]) => void;
  onSubmit?: () => void;
  readOnly?: boolean;
  canAddRows?: boolean;
  canDeleteRows?: boolean;
  roleId?: number;
  submitButtonText?: string;
  submitCondition?: () => boolean;
  additionalFields?: React.ReactNode;
}

export const TableModal: React.FC<TableModalProps> = ({
  isOpen,
  onClose,
  title,
  data,
  columns,
  onDataChange,
  onSubmit,
  readOnly = false,
  canAddRows = true,
  canDeleteRows = true,
  roleId,
  submitButtonText = 'Guardar',
  submitCondition,
  additionalFields,
}) => {
  const updateItem = (index: number, key: string, value: any) => {
    const newData = [...data];
    newData[index] = { ...newData[index], [key]: value };
    onDataChange(newData);
  };

  const addRow = () => {
    const newItem = columns.reduce((acc, col) => {
      acc[col.key] = '';
      return acc;
    }, {} as any);
    onDataChange([...data, newItem]);
  };

  const removeRow = (index: number) => {
    const newData = data.filter((_, i) => i !== index);
    onDataChange(newData);
  };

  const canSubmit = submitCondition ? submitCondition() : true;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <div className="space-y-4">
        {additionalFields}
        
        <div className="overflow-x-auto">
          <table className="w-full table-auto bg-white border">
            <thead className="bg-gray-100">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="px-2 py-2 text-left border">
                    {col.label}
                    {col.required && <span className="text-red-500 ml-1">*</span>}
                  </th>
                ))}
                {!readOnly && canDeleteRows && (
                  <th className="px-2 py-2 text-center border">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col.key} className="p-2 border">
                      {col.render ? (
                        col.render(item[col.key], item, index)
                      ) : col.type === 'select' && col.options ? (
                        <select
                          value={item[col.key] || ''}
                          onChange={(e) => updateItem(index, col.key, e.target.value)}
                          className="w-full border rounded px-2 py-1"
                          disabled={readOnly}
                          required={col.required}
                        >
                          <option value="">Seleccionar...</option>
                          {col.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={item[col.key] || ''}
                          onChange={(e) => updateItem(index, col.key, e.target.value)}
                          className="w-full border rounded px-2 py-1"
                          disabled={readOnly}
                          required={col.required}
                        />
                      )}
                    </td>
                  ))}
                  {!readOnly && canDeleteRows && (
                    <td className="p-2 text-center border">
                      <button
                        onClick={() => removeRow(index)}
                        className="text-red-500 hover:text-red-700"
                        type="button"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!readOnly && canAddRows && (
          <button
            onClick={addRow}
            className="flex items-center text-blue-600 hover:underline text-sm"
            type="button"
          >
            <FiPlus className="mr-1" /> Agregar fila
          </button>
        )}

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            type="button"
          >
            {readOnly ? 'Cerrar' : 'Cancelar'}
          </button>
          {!readOnly && onSubmit && canSubmit && (
            <button
              onClick={onSubmit}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              type="button"
            >
              {submitButtonText}
            </button>
          )}
        </div>
      </div>
    </BaseModal>
  );
};