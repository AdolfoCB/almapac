// components/modals/ConfirmModal.tsx
import React from 'react';
import { BaseModal } from './BaseModal';
import { FiAlertTriangle } from 'react-icons/fi';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  roleId?: number;
  confirmCondition?: () => boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'warning',
  confirmCondition,
}) => {
  const typeStyles = {
    danger: {
      icon: <FiAlertTriangle className="text-red-500" size={48} />,
      confirmClass: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      icon: <FiAlertTriangle className="text-yellow-500" size={48} />,
      confirmClass: 'bg-yellow-600 hover:bg-yellow-700',
    },
    info: {
      icon: <FiAlertTriangle className="text-blue-500" size={48} />,
      confirmClass: 'bg-blue-600 hover:bg-blue-700',
    },
  };

  const canConfirm = confirmCondition ? confirmCondition() : true;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={title} size="sm" showCloseButton={false}>
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          {typeStyles[type].icon}
        </div>
        <p className="text-gray-700">{message}</p>
        <div className="flex justify-center space-x-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            {cancelText}
          </button>
          {canConfirm && (
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`px-4 py-2 text-white rounded ${typeStyles[type].confirmClass}`}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </BaseModal>
  );
};
