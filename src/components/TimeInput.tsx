// =====================================================
// COMPONENTE DE INPUT DE TIEMPO CON BOTÓN "AHORA"
// =====================================================

import React from "react";
import { nowTime } from "@/utils/dateTimeUtils";
import { showWarning } from "@/utils/alertUtils";

interface TimeInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  showNowButton?: boolean;
  compareTime?: string; // Para validar que no sea menor
  compareLabel?: string; // Label del tiempo de comparación
  step?: number;
  className?: string;
  disabled?: boolean;
}

export default function TimeInput({
  label,
  value,
  onChange,
  showNowButton = true,
  compareTime,
  compareLabel = "inicio",
  step = 1,
  className = "",
  disabled = false,
}: TimeInputProps) {
  
  const handleTimeChange = (newTime: string) => {
    // Validar que no sea menor al tiempo de comparación
    if (compareTime && newTime < compareTime) {
      showWarning(
        `La hora ${label.toLowerCase()} no puede ser menor que la de ${compareLabel}`,
        "Error de validación"
      );
      return;
    }
    onChange(newTime);
  };

  const handleNowClick = () => {
    const now = nowTime();
    handleTimeChange(now);
  };

  return (
    <div className={className}>
      <label className="block mb-1 font-semibold">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="time"
          step={step}
          value={value}
          onChange={(e) => handleTimeChange(e.target.value)}
          disabled={disabled}
          className="w-full border rounded p-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        {showNowButton && !disabled && (
          <button
            type="button"
            onClick={handleNowClick}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md whitespace-nowrap transition-colors"
          >
            Ahora
          </button>
        )}
      </div>
    </div>
  );
}