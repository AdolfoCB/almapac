import Swal from "sweetalert2";

function parseErrorMessage(errData, defaultMsg = "Ocurrió un error") {
  if (!errData) return defaultMsg;

  const message = errData.message;
  const errors = errData.errors;

  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    return Object.entries(errors)
      .map(([campo, msg]) => {
        const campoLegible = campo
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase());
        return `${campoLegible}: ${msg}`;
      })
      .join(", ");
  } else if (Array.isArray(errors)) {
    return errors
      .map((e) =>
        e.message || (typeof e === "object" ? JSON.stringify(e) : e)
      )
      .join(", ");
  } else if (errors) {
    return typeof errors === "object" ? JSON.stringify(errors) : errors;
  }

  return message || defaultMsg;
}

/**
 * Muestra un alert normal con botón "Entendido"
 * @param {Response|object|null} responseOrErrorData Response fetch o error JSON
 * @param {string} defaultMsg Mensaje por defecto si no hay info
 */
export async function showErrorAlert(responseOrErrorData, defaultMsg = "Error inesperado") {
  try {
    let errData = null;

    if (!responseOrErrorData) {
      errData = null;
    } else if (
      typeof responseOrErrorData.json === "function"
    ) {
      // Es un Response
      errData = await responseOrErrorData.json().catch(() => null);
    } else {
      // Es un objeto con message/errors
      errData = responseOrErrorData;
    }

    const errorMsg = parseErrorMessage(errData, defaultMsg);

    await Swal.fire({
      icon: "error",
      title: "Error",
      text: errorMsg,
      confirmButtonText: "Entendido",
      allowOutsideClick: false,
    });
  } catch {
    await Swal.fire({
      icon: "error",
      title: "Error",
      text: defaultMsg,
      confirmButtonText: "Entendido",
      allowOutsideClick: false,
    });
  }
}