// alertUtils

// =====================================================
// UTILIDADES DE ALERTAS Y NOTIFICACIONES
// =====================================================

import Swal, { SweetAlertIcon } from "sweetalert2";

/**
 * Muestra un alert de error estandarizado
 * @param message Mensaje personalizado (opcional)
 * @param defaultMsg Mensaje por defecto
 */
export const showError = (message?: string, defaultMsg = "Ocurrió un error"): void => {
  Swal.fire({
    icon: "error",
    title: "Error",
    text: message || defaultMsg,
    confirmButtonText: "Entendido",
    allowOutsideClick: false,
  });
};

/**
 * Muestra un alert de éxito estandarizado
 * @param message Mensaje de éxito
 * @param title Título del alert (opcional)
 */
export const showSuccess = (message: string, title = "Éxito"): void => {
  Swal.fire({
    icon: "success",
    title,
    text: message,
    confirmButtonText: "Entendido",
  });
};

/**
 * Muestra un alert de advertencia estandarizado
 * @param message Mensaje de advertencia
 * @param title Título del alert (opcional)
 */
export const showWarning = (message: string, title = "Advertencia"): void => {
  Swal.fire({
    icon: "warning",
    title,
    text: message,
    confirmButtonText: "Entendido",
  });
};

/**
 * Muestra un alert de confirmación con opciones personalizadas
 * @param title Título del alert
 * @param text Texto del alert
 * @param icon Icono del alert
 * @param onConfirm Función a ejecutar al confirmar
 * @param onCancel Función a ejecutar al cancelar (opcional)
 * @param showDenyButton Mostrar botón de denegar (opcional)
 * @param denyButtonText Texto del botón denegar (opcional)
 * @param onDeny Función a ejecutar al denegar (opcional)
 */
export const showModal = (
  title: string,
  text: string,
  icon: SweetAlertIcon,
  onConfirm: () => void,
  onCancel?: () => void,
  showDenyButton = false,
  denyButtonText = "Generar Nota",
  onDeny?: () => void
): void => {
  Swal.fire({
    title,
    text,
    icon,
    showDenyButton,
    showCancelButton: true,
    confirmButtonColor: "#3838b0",
    cancelButtonColor: "#d33",
    denyButtonColor: "#16A34A",
    confirmButtonText: "Confirmar",
    denyButtonText,
    cancelButtonText: "Cancelar",
  }).then((result) => {
    if (result.isDenied && onDeny) {
      onDeny();
    } else if (result.isConfirmed) {
      onConfirm();
    } else if (onCancel) {
      onCancel();
    }
  });
};

/**
 * Muestra un loading spinner
 * @param title Título del loading (opcional)
 */
export const showLoading = (title = "Procesando solicitud..."): void => {
  Swal.fire({
    title,
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
};

/**
 * Cierra el alert actual
 */
export const closeAlert = (): void => {
  Swal.close();
};

/**
 * Muestra un toast de éxito temporal
 * @param message Mensaje del toast
 * @param timer Tiempo en ms (default: 1500)
 */
export const showSuccessToast = (message: string, timer = 1500): void => {
  Swal.fire({
    icon: "success",
    title: message,
    showConfirmButton: false,
    timer,
  });
};