// =====================================================
// COMPONENTE DE ENCABEZADO DE PÁGINA REUTILIZABLE
// =====================================================

import React from "react";
import { FiRefreshCw } from "react-icons/fi";

interface PageHeaderProps {
  title: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  showRefreshButton?: boolean;
}

export default function PageHeader({
  title,
  onRefresh,
  isRefreshing = false,
  showRefreshButton = true,
}: PageHeaderProps) {
  return (
    <header className="bg-[#110885] px-4 py-6 text-white">
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-between gap-4">
        <img
          src="/logo.png"
          alt="ALMAPAC"
          className="h-12 sm:h-16 w-auto object-contain"
        />
        <h1 className="text-xl sm:text-2xl font-bold text-center uppercase">
          {title}
        </h1>
        {showRefreshButton && onRefresh && (
          <div className="w-full flex items-center justify-end">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="w-full sm:w-auto sm:absolute sm:right-4 sm:top-4 flex items-center justify-center gap-2 p-3 sm:p-2 rounded bg-blue-700 hover:bg-blue-800 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              aria-label="Actualizar datos"
            >
              <FiRefreshCw
                className={`text-white text-xl ${
                  isRefreshing ? "animate-spin" : ""
                }`}
              />
              <span>{isRefreshing ? "Actualizando..." : "Actualizar"}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}