
// components/modals/ViewModal.tsx
import React from 'react';
import { BaseModal } from './BaseModal';

export interface ViewField {
  key: string;
  label: string;
  value: any;
  type?: 'text' | 'textarea' | 'array' | 'object' | 'date' | 'boolean';
  render?: (value: any) => React.ReactNode;
  fullWidth?: boolean;
}

interface ViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any;
  fields: ViewField[];
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  roleId?: number;
  actions?: {
    label: string;
    onClick: () => void;
    className?: string;
    condition?: () => boolean;
  }[];
}

export const ViewModal: React.FC<ViewModalProps> = ({
  isOpen,
  onClose,
  title,
  data,
  fields,
  size = 'lg',
  roleId,
  actions = [],
}) => {
  const renderFieldValue = (field: ViewField) => {
    const value = data?.[field.key] ?? field.value;

    if (field.render) {
      return field.render(value);
    }

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            readOnly
            value={value || ''}
            className="w-full border rounded px-3 py-2 bg-gray-50 resize-none"
            rows={3}
          />
        );
      case 'array':
        return (
          <div className="w-full border rounded px-3 py-2 bg-gray-50">
            {Array.isArray(value) ? value.join(', ') : value || ''}
          </div>
        );
      case 'object':
        return (
          <div className="w-full border rounded px-3 py-2 bg-gray-50">
            {Array.isArray(value) 
              ? value.map((item) => typeof item === 'object' ? item.nombre || item.name : item).join(', ')
              : typeof value === 'object' 
                ? JSON.stringify(value)
                : value || ''
            }
          </div>
        );
      case 'boolean':
        return (
          <div className="w-full border rounded px-3 py-2 bg-gray-50">
            {value ? 'Sí' : 'No'}
          </div>
        );
      case 'date':
        return (
          <input
            readOnly
            value={value || ''}
            className="w-full border rounded px-3 py-2 bg-gray-50"
            type="text"
          />
        );
      default:
        return (
          <input
            readOnly
            value={value || ''}
            className="w-full border rounded px-3 py-2 bg-gray-50"
            type="text"
          />
        );
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={title} size={size}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((field) => (
            <div key={field.key} className={field.fullWidth ? 'sm:col-span-2' : ''}>
              <label className="block font-medium mb-1">{field.label}</label>
              {renderFieldValue(field)}
            </div>
          ))}
        </div>

        {actions.length > 0 && (
          <div className="flex justify-end space-x-2 pt-4 border-t">
            {actions.map((action, index) => {
              const shouldShow = action.condition ? action.condition() : true;
              if (!shouldShow) return null;

              return (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={action.className || 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </BaseModal>
  );
};