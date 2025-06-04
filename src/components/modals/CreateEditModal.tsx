// components/modals/CreateEditModal.tsx
import React, { FormEvent, ChangeEvent } from 'react';
import { BaseModal } from './BaseModal';
import dynamic from 'next/dynamic';

const Select = dynamic(() => import('react-select'), { ssr: false });

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'number' | 'select' | 'multiselect' | 'date' | 'datetime-local' | 'checkbox';
  required?: boolean;
  placeholder?: string;
  options?: { value: any; label: string }[] | { label: string; options: { value: any; label: string }[] }[];
  rows?: number;
  disabled?: boolean;
  fullWidth?: boolean;
  value?: any;
  onChange?: (value: any) => void;
  validation?: (value: any) => string | null;
}

interface CreateEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  formData: any;
  fields: FormField[];
  onSubmit: (e: FormEvent) => void | Promise<void>;
  onFieldChange?: (key: string, value: any) => void;
  isLoading?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  roleId?: number;
  submitButtonText?: string;
  cancelButtonText?: string;
  submitCondition?: () => boolean;
  additionalActions?: {
    label: string;
    onClick: () => void;
    className?: string;
    condition?: () => boolean;
  }[];
}

export const CreateEditModal: React.FC<CreateEditModalProps> = ({
  isOpen,
  onClose,
  title,
  formData,
  fields,
  onSubmit,
  onFieldChange,
  isLoading = false,
  size = 'lg',
  submitButtonText = 'Guardar',
  cancelButtonText = 'Cancelar',
  submitCondition,
  additionalActions = [],
}) => {
  const handleFieldChange = (key: string, value: any) => {
    if (onFieldChange) {
      onFieldChange(key, value);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    handleFieldChange(name, finalValue);
  };

  const renderField = (field: FormField) => {
    const value = field.value !== undefined ? field.value : formData?.[field.key] || '';

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            name={field.key}
            value={value}
            onChange={field.onChange || handleInputChange}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            placeholder={field.placeholder}
            required={field.required}
            disabled={field.disabled}
            rows={field.rows || 3}
          />
        );

      case 'select':
        if (field.options) {
          // Check if it's grouped options
          const isGrouped = field.options.some(opt => 'options' in opt);
          if (isGrouped) {
            return (
              <Select
                options={field.options as { label: string; options: { value: any; label: string }[] }[]}
                value={field.options.flatMap(g => 'options' in g ? g.options : [g]).find(opt => opt.value === value) || null}
                onChange={(selectedOption: any) => {
                  const newValue = selectedOption ? selectedOption.value : '';
                  if (field.onChange) field.onChange(newValue);
                  else handleFieldChange(field.key, newValue);
                }}
                placeholder={field.placeholder}
                isDisabled={field.disabled}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
              />
            );
          } else {
            return (
              <Select
                options={field.options as { value: any; label: string }[]}
                value={(field.options as { value: any; label: string }[]).find(opt => opt.value === value) || null}
                onChange={(selectedOption: any) => {
                  const newValue = selectedOption ? selectedOption.value : '';
                  if (field.onChange) field.onChange(newValue);
                  else handleFieldChange(field.key, newValue);
                }}
                placeholder={field.placeholder}
                isDisabled={field.disabled}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
              />
            );
          }
        }
        return null;

      case 'multiselect':
        if (field.options) {
          // Check if it's grouped options
          const isGrouped = field.options.some(opt => 'options' in opt);
          if (isGrouped) {
            return (
              <Select
                isMulti
                options={field.options as { label: string; options: { value: any; label: string }[] }[]}
                value={field.options.flatMap(g => 'options' in g ? g.options : [g]).filter(opt => 
                  Array.isArray(value) ? value.includes(opt.value) : false
                )}
                onChange={(selectedOptions: any) => {
                  const newValue = selectedOptions ? selectedOptions.map((opt: any) => opt.value) : [];
                  if (field.onChange) field.onChange(newValue);
                  else handleFieldChange(field.key, newValue);
                }}
                placeholder={field.placeholder}
                isDisabled={field.disabled}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
              />
            );
          } else {
            return (
              <Select
                isMulti
                options={field.options as { value: any; label: string }[]}
                value={(field.options as { value: any; label: string }[]).filter(opt => 
                  Array.isArray(value) ? value.includes(opt.value) : false
                )}
                onChange={(selectedOptions: any) => {
                  const newValue = selectedOptions ? selectedOptions.map((opt: any) => opt.value) : [];
                  if (field.onChange) field.onChange(newValue);
                  else handleFieldChange(field.key, newValue);
                }}
                placeholder={field.placeholder}
                isDisabled={field.disabled}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
              />
            );
          }
        }
        return null;

      case 'checkbox':
        return (
          <input
            type="checkbox"
            name={field.key}
            checked={!!value}
            onChange={field.onChange || handleInputChange}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            disabled={field.disabled}
          />
        );

      default:
        return (
          <input
            type={field.type}
            name={field.key}
            value={value}
            onChange={field.onChange || handleInputChange}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            placeholder={field.placeholder}
            required={field.required}
            disabled={field.disabled}
          />
        );
    }
  };

  const canSubmit = submitCondition ? submitCondition() : true;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={title} size={size}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((field) => (
            <div key={field.key} className={field.fullWidth ? 'sm:col-span-2' : ''}>
              <label className="block font-medium mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {renderField(field)}
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          {additionalActions.map((action, index) => {
            const shouldShow = action.condition ? action.condition() : true;
            if (!shouldShow) return null;

            return (
              <button
                key={index}
                type="button"
                onClick={action.onClick}
                className={action.className || 'px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700'}
              >
                {action.label}
              </button>
            );
          })}
          
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            disabled={isLoading}
          >
            {cancelButtonText}
          </button>
          
          {canSubmit && (
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Procesando solicitud...' : submitButtonText}
            </button>
          )}
        </div>
      </form>
    </BaseModal>
  );
};