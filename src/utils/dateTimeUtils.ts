// =====================================================
// UTILIDADES DE FECHA Y HORA
// =====================================================

/**
 * Obtiene la fecha y hora actual en formato ISO para El Salvador
 * Formato: YYYY-MM-DD HH:mm:ss
 */
export function getFechaInicio(): string {
  const now = new Date();
  return now.toLocaleString("en-CA", {
    timeZone: "America/El_Salvador",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD para El Salvador
 */
export function getFecha(): string {
  const now = new Date();
  return now.toLocaleDateString("en-CA", {
    timeZone: "America/El_Salvador",
  });
}

/**
 * Obtiene la hora actual en formato HH:mm:ss para El Salvador
 */
export function nowTime(): string {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: "America/El_Salvador",
    hour12: false,
  });
}

/**
 * Calcula la diferencia entre dos horas en formato HH:mm:ss
 * @param start Hora de inicio (HH:mm:ss)
 * @param end Hora de fin (HH:mm:ss)
 * @returns Diferencia en formato HH:mm:ss
 */
export function diffTime(start: string, end: string): string {
  if (!start || !end) return "00:00:00";
  
  const toSec = (t: string) => {
    const [h, m, s = "0"] = t.split(":");
    return +h * 3600 + +m * 60 + +s;
  };
  
  const d = toSec(end) - toSec(start);
  if (d < 0) return "00:00:00";
  
  const hh = String(Math.floor(d / 3600)).padStart(2, "0");
  const mm = String(Math.floor((d % 3600) / 60)).padStart(2, "0");
  const ss = String(d % 60).padStart(2, "0");
  
  return `${hh}:${mm}:${ss}`;
}