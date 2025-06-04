// components/DetailModal.tsx - Modal reutilizable para mostrar detalles
import React from 'react';
import { FiShield } from 'react-icons/fi';

interface ModalButton {
  label: string;
  onClick: () => void;
  className?: string;
  icon?: React.ReactNode;
  condition?: () => boolean;
}

interface ModalSection {
  title: string;
  icon?: React.ReactNode;
  fields: Array<{
    label: string;
    value: string | React.ReactNode;
    className?: string;
  }>;
  className?: string;
}

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  sections: ModalSection[];
  buttons?: ModalButton[];
  maxWidth?: string;
  roleId?: number | null;
}

export default function DetailModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon = <FiShield className="w-5 h-5" />,
  sections,
  buttons = [],
  maxWidth = "max-w-4xl",
  roleId = null
}: DetailModalProps) {
  if (!isOpen) return null;

  const filteredButtons = buttons.filter(button => 
    !button.condition || button.condition()
  );

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4 animate-fadeIn">
      <div className={`bg-white w-full ${maxWidth} rounded-xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col animate-slideUp`}>
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-900 text-white p-6 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              {icon}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              {subtitle && (
                <p className="text-blue-100 text-sm">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center group"
          >
            <svg
              className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sections.map((section, sectionIndex) => (
              <div 
                key={sectionIndex} 
                className={`bg-gray-50 rounded-lg p-4 ${section.className || ''}`}
              >
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  {section.icon}
                  <span className={section.icon ? "ml-2" : ""}>{section.title}</span>
                </h3>
                <div className="space-y-3">
                  {section.fields.map((field, fieldIndex) => (
                    <div key={fieldIndex}>
                      <p className="text-sm text-gray-600">{field.label}</p>
                      <div className={`font-medium ${field.className || ''}`}>
                        {field.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        {filteredButtons.length > 0 && (
          <div className="bg-gray-50 border-t border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              {filteredButtons.map((button, index) => (
                <button
                  key={index}
                  onClick={button.onClick}
                  className={button.className || "bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"}
                >
                  {button.icon && (
                    <span className="mr-2 inline-flex items-center">
                      {button.icon}
                    </span>
                  )}
                  {button.label}
                </button>
              ))}
              <button
                onClick={onClose}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
              >
                Cerrar
              </button>
            </div>
          </div>
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
    </div>
  );
}