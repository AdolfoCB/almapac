// =====================================================
// COMPONENTE DE ACCIONES DE PIE DE PÁGINA
// =====================================================

import React from "react";

interface PageActionsProps {
  onCancel: () => void;
  onSubmit?: () => void;
  cancelText?: string;
  submitText?: string;
  cancelClassName?: string;
  submitClassName?: string;
  disabled?: boolean;
  showSubmit?: boolean;
}

export default function PageActions({
  onCancel,
  onSubmit,
  cancelText = "Cancelar",
  submitText = "Terminar turno",
  cancelClassName = "px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors",
  submitClassName = "px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors",
  disabled = false,
  showSubmit = true,
}: PageActionsProps) {
  return (
    <div className={showSubmit ? "flex justify-between" : "flex justify-center"}>
      <button
        onClick={onCancel}
        disabled={disabled}
        className={`${cancelClassName} ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {cancelText}
      </button>
      {showSubmit && onSubmit && (
        <button
          onClick={onSubmit}
          disabled={disabled}
          className={`${submitClassName} ${
            disabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {submitText}
        </button>
      )}
    </div>
  );
}