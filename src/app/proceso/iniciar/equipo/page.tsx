"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import dynamic from "next/dynamic";
import { FaSave } from "react-icons/fa";

// Importar react-select de forma dinámica para evitar problemas de SSR/hidratación
const Select = dynamic(() => import("react-select"), { ssr: false });

interface OptionType {
  value: string;
  label: string;
}

const equipoOptions: OptionType[] = [
  { value: "CAT 1", label: "CAT 1" },
  { value: "CAT 2", label: "CAT 2" },
  { value: "CAT 3", label: "CAT 3" },
  { value: "J 1", label: "J 1" },
  { value: "J 2", label: "J 2" },
  { value: "J 3", label: "J 3" },
  { value: "K-II", label: "K-II" },
  { value: "621 H", label: "621 H" },
  { value: "544 H", label: "544 H" },
];

interface InspeccionItem {
  id: number;
  titulo: string;
  cumple: boolean | null;
  observaciones: string;
}

const inspeccionInicial: InspeccionItem[] = [
  { id: 1, titulo: "Revisar si hay fuga de aceite en el equipo.", cumple: null, observaciones: "" },
  { id: 2, titulo: "Revisar si hay fuga de combustible.", cumple: null, observaciones: "" },
  { id: 3, titulo: "Revisar fuga de refrigerante.", cumple: null, observaciones: "" },
  { id: 4, titulo: "Revisar pedal de freno.", cumple: null, observaciones: "" },
  { id: 5, titulo: "Limpieza del equipo (lavado y sopleteado).", cumple: null, observaciones: "" },
  { id: 6, titulo: "Revisar el interruptor del freno de estacionamiento.", cumple: null, observaciones: "" },
  { id: 7, titulo: "Revisar que el interruptor de las baterías esté en apagado antes de iniciar el trabajo del equipo.", cumple: null, observaciones: "" },
  { id: 8, titulo: "Revisar que el nivel de refrigerante del motor esté correcto.", cumple: null, observaciones: "" },
  { id: 9, titulo: "Verificar estado de ventilador de enfriamiento.", cumple: null, observaciones: "" },
  { id: 10, titulo: "Revisar los faros y luces de trabajo.", cumple: null, observaciones: "" },
  { id: 11, titulo: "Revisar que funcione el claxon (pito).", cumple: null, observaciones: "" },
  { id: 12, titulo: "Revisar la luz de alto y de parqueo.", cumple: null, observaciones: "" },
  { id: 13, titulo: "Revisar el funcionamiento de la alarma de retroceso.", cumple: null, observaciones: "" },
  { id: 14, titulo: "Revisar luces de señal de dirección.", cumple: null, observaciones: "" },
  { id: 15, titulo: "Revisar luces de retroceso.", cumple: null, observaciones: "" },
  { id: 16, titulo: "Revisar que el nivel de aceite de motor esté de acuerdo con la marca.", cumple: null, observaciones: "" },
  { id: 17, titulo: "Inspeccionar que no haya daños estructurales en la carrocería del equipo.", cumple: null, observaciones: "" },
  { id: 18, titulo: "Revisar el estado del cinturón de seguridad.", cumple: null, observaciones: "" },
  { id: 19, titulo: "Revisar espejos retrovisores.", cumple: null, observaciones: "" },
  { id: 20, titulo: "Revisar que el nivel de aceite hidráulico esté correcto.", cumple: null, observaciones: "" },
  { id: 21, titulo: "Revisar el nivel de aceite de los ejes de transmisión.", cumple: null, observaciones: "" },
  { id: 22, titulo: "Revisar el estado y apriete de los pernos de las cuchillas del cucharón.", cumple: null, observaciones: "" },
  { id: 23, titulo: "Revisar que el volante y columna de la dirección estén suaves.", cumple: null, observaciones: "" },
  { id: 24, titulo: "Revisar el nivel de aceite de transmisión.", cumple: null, observaciones: "" },
  { id: 25, titulo: "Revisar el apriete de las tuercas de las ruedas.", cumple: null, observaciones: "" },
  { id: 26, titulo: "Revisar el estado de las llantas.", cumple: null, observaciones: "" },
  { id: 27, titulo: "Revisar presión de las llantas y regular (del: 60 psi tras: 50 psi).", cumple: null, observaciones: "" },
  { id: 28, titulo: "Revisar la faja de transmisión del motor.", cumple: null, observaciones: "" },
  { id: 29, titulo: "Inspeccionar y limpiar (de ser necesario) el filtro de aire primario.", cumple: null, observaciones: "" },
  { id: 30, titulo: "Verificar el funcionamiento de los limpiaparabrisas.", cumple: null, observaciones: "" },
  { id: 31, titulo: "Revisar y drenar (de ser necesario) la presencia de agua en el filtro de separador del combustible.", cumple: null, observaciones: "" },
  { id: 32, titulo: "Lubricar todos los pines y puntos de engrase del equipo.", cumple: null, observaciones: "" }
];

export default function InspeccionDeEquipo() {
  const router = useRouter();

  // Estados para campos principales
  const [equipo, setEquipo] = useState<string>("");
  const [horometro, setHorometro] = useState<string>("");
  const [operador, setOperador] = useState<string>("");
  const [fecha, setFecha] = useState<string>("");
  const [hora, setHora] = useState<string>("");       // Se usará formato HH:MM:SS
  const [turnoInicio, setturnoInicio] = useState<string>("");   // Se mantiene HH:MM
  const [turnoFin, setHoraA] = useState<string>("");       // Se mantiene HH:MM
  const [recomendaciones, setRecomendaciones] = useState<string>("");
  const [inspecciones, setInspecciones] = useState<InspeccionItem[]>(inspeccionInicial);

  // Pre-cargar datos y configurar fecha/hora inicial (incluyendo segundos)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentTime = new Date();
      const hours = currentTime.getHours().toString().padStart(2, '0');
      const minutes = currentTime.getMinutes().toString().padStart(2, '0');
      const seconds = currentTime.getSeconds().toString().padStart(2, '0');
      const hourToday = `${hours}:${minutes}:${seconds}`;
      const userName = localStorage.getItem("userNameAll") || "";
      const storedData = localStorage.getItem("inspeccionData");
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        setEquipo(parsedData.equipo || "");
        setHorometro(parsedData.horometro || "");
        setOperador(parsedData.operador || userName);
        setFecha(parsedData.fecha || getFecha());
        setHora(parsedData.hora || hourToday);
        setturnoInicio(parsedData.turnoInicio || "");
        setHoraA(parsedData.turnoFin || "");
        setRecomendaciones(parsedData.recomendaciones || "");
        setInspecciones(parsedData.inspecciones || inspeccionInicial);
      } else {
        setOperador(userName);
        setFecha(getFecha());
        setHora(hourToday);
      }
    }
  }, []);

  // Guardar los datos en localStorage
  useEffect(() => {
    const data = { equipo, horometro, operador, fecha, hora, turnoInicio, turnoFin, recomendaciones, inspecciones };
    localStorage.setItem("inspeccionData", JSON.stringify(data));
  }, [equipo, horometro, operador, fecha, hora, turnoInicio, turnoFin, recomendaciones, inspecciones]);

  // Prevenir salida accidental
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const handleCumpleChange = (id: number, value: boolean) => {
    setInspecciones(prev =>
      prev.map(item =>
        item.id === id ? { ...item, cumple: item.cumple === value ? null : value } : item
      )
    );
  };

  const handleObservacionesChange = (id: number, value: string) => {
    setInspecciones(prev =>
      prev.map(item => (item.id === id ? { ...item, observaciones: value } : item))
    );
  };

  function getFecha() {
    const now = new Date();
    return now.toLocaleDateString("en-CA", { timeZone: "America/El_Salvador" });
  }

  // Función para calcular la diferencia entre dos tiempos en formato "HH:MM:SS"
  function calcularTiempoTotal(horaInicio: string, horaFin: string) {
    // Función auxiliar para parsear el tiempo a segundos
    const parseTime = (timeStr: string) => {
      const parts = timeStr.split(':').map(Number);
      const h = parts[0] || 0;
      const m = parts[1] || 0;
      const s = parts[2] || 0;
      return h * 3600 + m * 60 + s;
    };
    const inicio = parseTime(horaInicio);
    const fin = parseTime(horaFin);
    let diffSeconds = fin - inicio;
    if (diffSeconds < 0) diffSeconds += 24 * 3600;
    const horas = Math.floor(diffSeconds / 3600);
    const minutos = Math.floor((diffSeconds % 3600) / 60);
    const segundos = diffSeconds % 60;
    return `${horas.toString().padStart(2,'0')}:${minutos.toString().padStart(2,'0')}:${segundos.toString().padStart(2,'0')}`;
  }

  const handleGuardar = async () => {
    if (!equipo || !operador || !fecha || !hora || !turnoInicio || !turnoFin) {
      Swal.fire({ icon: "error", title: "Error", text: "Por favor, complete todos los campos principales." });
      return;
    }
    const inspeccionesIncompletas = inspecciones.filter(item => item.cumple === null);
    if (inspeccionesIncompletas.length > 0) {
      const mensajes = inspeccionesIncompletas.map(item => `[${item.id}]`);
      Swal.fire({ icon: "error", title: "Error", text: `Complete las siguientes inspecciones:\n${mensajes.join("\n")}` });
      return;
    }
    const confirmResult = await Swal.fire({
      title: "Confirmar guardado",
      text: "Los datos se enviarán y la acción no se puede revertir. ¿Desea continuar?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, enviar",
      cancelButtonText: "Cancelar",
    });
    if (!confirmResult.isConfirmed) return;

    Swal.fire({ title: "Procesando solicitud...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    const currentTime = new Date();
    const hoursNow = currentTime.getHours().toString().padStart(2, '0');
    const minutesNow = currentTime.getMinutes().toString().padStart(2, '0');
    const secondsNow = currentTime.getSeconds().toString().padStart(2, '0');
    const horaFin = `${hoursNow}:${minutesNow}:${secondsNow}`;

    const tiempoTotal = calcularTiempoTotal(hora, horaFin);

    const payload = {
      equipo, horometro, operador, fecha, hora, horaFin, tiempoTotal, turnoInicio, turnoFin, recomendaciones,
      inspecciones: inspecciones.map(item => ({
        id: item.id, titulo: item.titulo, cumple: item.cumple, observaciones: item.observaciones,
      })),
    };

    try {
      const res = await fetch("/api/v1/equipos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      Swal.close();
      if (res.ok) {
        localStorage.removeItem("inspeccionData");
        Swal.fire("Enviado", "Datos enviados y guardados correctamente.", "success").then(() => {
          router.push("/proceso/iniciar");
        });
      } else {
        const errorData = await res.json();
        Swal.fire({ icon: "error", title: "Error", text: errorData.error || "No se pudo guardar la inspección." });
      }
    } catch (error) {
      Swal.close();
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo guardar la inspección." });
    }
  };

  const handleCancelar = () => {
    Swal.fire({
      title: "¿Estás seguro?",
      text: "Se perderán todos los datos guardados.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, salir",
      cancelButtonText: "Cancelar",
    }).then(result => {
      if (result.isConfirmed) {
        localStorage.removeItem("inspeccionData");
        router.push("/proceso/iniciar");
      }
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 bg-white">
      <h1 className="text-2xl md:text-3xl font-bold text-blue-800 mb-6 text-center">Inspección de Equipo</h1>
      
      {/* Formulario para móvil */}
      <div className="md:hidden flex flex-col space-y-4 mb-6">
        <div className="border-2 border-gray-500 p-2 rounded-md">
          <label className="block mb-1 text-base font-semibold text-gray-800">Equipo:</label>
          <Select
            className="react-select-container text-base border-2 border-gray-500 rounded-md"
            classNamePrefix="react-select"
            options={equipoOptions}
            required
            placeholder="Seleccione Equipo"
            value={equipo ? { value: equipo, label: equipo } : null}
            onChange={(option: OptionType | null) => setEquipo(option ? option.value : "")}
          />
        </div>
        <div className="border-2 border-gray-500 p-2 rounded-md">
          <label className="block mb-1 text-base font-semibold text-gray-800">Horómetro:</label>
          <input
            type="number"
            value={horometro}
            required
            onChange={e => setHorometro(e.target.value)}
            className="w-full p-2 text-base border-2 border-gray-500 rounded-md"
            placeholder="Ingrese Horómetro del equipo"
          />
        </div>
        <div className="border-2 border-gray-500 p-2 rounded-md">
          <label className="block mb-1 text-base font-semibold text-gray-800">Operador:</label>
          <input
            type="text"
            value={operador}
            readOnly
            onChange={e => setOperador(e.target.value)}
            className="w-full p-2 text-base border-2 border-gray-500 rounded-md"
            placeholder="Ingrese nombre del operador"
          />
        </div>
        <div className="border-2 border-gray-500 p-2 rounded-md">
          <label className="block mb-1 text-base font-semibold text-gray-800">Fecha:</label>
          <input
            type="date"
            value={fecha}
            readOnly
            onChange={e => setFecha(e.target.value)}
            className="w-full h-9 text-base border-2 border-gray-500 rounded-md px-2 py-1"
          />
        </div>
        <div className="border-2 border-gray-500 p-2 rounded-md">
          <label className="block mb-1 text-base font-semibold text-gray-800">Hora:</label>
          {/* Agregado step="1" para incluir segundos */}
          <input
            type="time"
            step="1"
            value={hora}
            readOnly
            onChange={e => setHora(e.target.value)}
            className="w-full h-9 text-base border-2 border-gray-500 rounded-md px-2 py-1"
          />
        </div>
        <div className="border-2 border-gray-500 p-2 rounded-md">
          <div className="flex flex-col space-y-4">
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1 uppercase">Inicio Turno</label>
              <input
                type="time"
                name="turnoInicio"
                required
                value={turnoInicio}
                onChange={e => setturnoInicio(e.target.value)}
                className="w-full text-base border-2 border-gray-500 rounded-md px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-800 mb-1 uppercase">Termina Turno</label>
              <input
                type="time"
                name="turnoFin"
                required
                value={turnoFin}
                onChange={e => setHoraA(e.target.value)}
                className="w-full text-base border-2 border-gray-500 rounded-md px-2 py-1"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Vista para PC */}
      <div className="hidden md:block mb-6">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="px-4 py-3 border-2 border-gray-500 text-base font-bold text-gray-800">Equipo</th>
              <th className="px-4 py-3 border-2 border-gray-500 text-base font-bold text-gray-800">Horómetro</th>
              <th className="px-4 py-3 border-2 border-gray-500 text-base font-bold text-gray-800">Fecha</th>
              <th className="px-4 py-3 border-2 border-gray-500 text-base font-bold text-gray-800">Hora</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-3 border-2 border-gray-500">
                <Select
                  className="react-select-container text-base border-2 border-gray-500 rounded-md"
                  classNamePrefix="react-select"
                  options={equipoOptions}
                  required
                  placeholder="Seleccione Equipo"
                  value={equipo ? { value: equipo, label: equipo } : null}
                  onChange={(option: OptionType | null) => setEquipo(option ? option.value : "")}
                />
              </td>
              <td className="px-4 py-3 border-2 border-gray-500">
                <input
                  type="number"
                  value={horometro}
                  required
                  onChange={e => setHorometro(e.target.value)}
                  className="w-full p-2 text-base border-2 border-gray-500 rounded-md"
                  placeholder="Ingrese Horómetro del equipo"
                />
              </td>
              <td className="px-4 py-3 border-2 border-gray-500">
                <input
                  type="date"
                  value={fecha}
                  readOnly
                  onChange={e => setFecha(e.target.value)}
                  className="w-full h-9 text-base border-2 border-gray-500 rounded-md px-2 py-1"
                />
              </td>
              <td className="px-4 py-3 border-2 border-gray-500">
                {/* Agregado step="1" para incluir segundos */}
                <input
                  type="time"
                  step="1"
                  value={hora}
                  readOnly
                  onChange={e => setHora(e.target.value)}
                  className="w-full h-9 text-base border-2 border-gray-500 rounded-md px-2 py-1"
                />
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 border-2 border-gray-500">
                <label className="block text-base font-semibold text-gray-800 mb-1 uppercase">Operador</label>
                <input
                  type="text"
                  value={operador}
                  readOnly
                  onChange={e => setOperador(e.target.value)}
                  className="w-full p-2 text-base border-2 border-gray-500 rounded-md"
                  placeholder="Ingrese nombre del operador"
                />
              </td>
              <td className="px-4 py-3 border-2 border-gray-500" colSpan={3}>
                <div className="flex flex-row space-x-4">
                  <div className="flex-1">
                    <label className="block text-base font-semibold text-gray-800 mb-1 uppercase">Inicio Turno</label>
                    <input
                      type="time"
                      name="turnoInicio"
                      required
                      value={turnoInicio}
                      onChange={e => setturnoInicio(e.target.value)}
                      className="w-full text-base border-2 border-gray-500 rounded-md px-2 py-1"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-base font-semibold text-gray-800 mb-1 uppercase">Termina Turno</label>
                    <input
                      type="time"
                      name="turnoFin"
                      required
                      value={turnoFin}
                      onChange={e => setHoraA(e.target.value)}
                      className="w-full text-base border-2 border-gray-500 rounded-md px-2 py-1"
                    />
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Inspecciones para móvil */}
      <div className="block md:hidden mb-6">
        {inspecciones.map((item, index) => (
          <div key={item.id} className="p-4 border-2 border-gray-500 rounded-md mb-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-blue-600 text-white text-base mr-2">
                {index + 1}
              </div>
              <span className="font-semibold text-gray-800 text-base">{item.titulo}</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-800 text-base">¿Cumple condición?</span>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-1 text-gray-800 text-base">
                  <input
                    type="checkbox"
                    checked={item.cumple === true}
                    onChange={() => handleCumpleChange(item.id, true)}
                    className="form-checkbox h-6 w-6 accent-orange-500"
                  />
                  <span>SI</span>
                </label>
                <label className="flex items-center space-x-1 text-gray-800 text-base">
                  <input
                    type="checkbox"
                    checked={item.cumple === false}
                    onChange={() => handleCumpleChange(item.id, false)}
                    className="form-checkbox h-6 w-6 accent-orange-500"
                  />
                  <span>NO</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-gray-800 font-semibold text-base mb-1">Observaciones:</label>
              <textarea
                placeholder="Agregar observación..."
                value={item.observaciones}
                onChange={e => handleObservacionesChange(item.id, e.target.value)}
                className="w-full text-base border-2 border-gray-500 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y min-h-[10px]"
              />
            </div>
          </div>
        ))}
      </div>
      
      {/* Inspecciones para PC */}
      <div className="hidden md:block overflow-x-auto mb-6">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="px-4 py-3 border-2 border-gray-500 text-base font-bold text-gray-800">N°</th>
              <th className="px-4 py-3 border-2 border-gray-500 text-base font-bold text-gray-800">Parte Evaluada</th>
              <th className="px-4 py-3 border-2 border-gray-500 text-base font-bold text-gray-800">Cumple</th>
              <th className="px-4 py-3 border-2 border-gray-500 text-base font-bold text-gray-800">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {inspecciones.map((item, index) => (
              <tr key={item.id}>
                <th className="px-4 py-3 border-2 border-gray-500 text-base text-gray-700">{index + 1}</th>
                <td className="px-4 py-3 border-2 border-gray-500 text-base text-gray-700">{item.titulo}</td>
                <td className="px-4 py-3 border-2 border-gray-500 text-base text-gray-700">
                  <div className="flex justify-center items-center space-x-4">
                    <label className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={item.cumple === true}
                        onChange={() => handleCumpleChange(item.id, true)}
                        className="form-checkbox h-6 w-6 accent-orange-500"
                      />
                      <span className="text-base">SI</span>
                    </label>
                    <label className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={item.cumple === false}
                        onChange={() => handleCumpleChange(item.id, false)}
                        className="form-checkbox h-6 w-6 accent-orange-500"
                      />
                      <span className="text-base">NO</span>
                    </label>
                  </div>
                </td>
                <td className="px-4 py-3 border-2 border-gray-500 text-base text-gray-700">
                  <textarea
                    value={item.observaciones}
                    onChange={e => handleObservacionesChange(item.id, e.target.value)}
                    className="w-full text-base border-2 border-gray-500 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y min-h-[10px]"
                    placeholder="Agregar observación"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recomendaciones */}
      <div className="mb-6">
        <label className="block mb-1 text-base font-semibold text-gray-800">
          Recomendaciones:
        </label>
        <textarea
          value={recomendaciones}
          onChange={e => setRecomendaciones(e.target.value)}
          className="w-full text-base border-2 border-gray-500 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y min-h-[120px]"
          placeholder="Ingrese recomendaciones aquí..."
        />
      </div>

      {/* Botones */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={handleCancelar}
          className="inline-flex items-center justify-center bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-base font-semibold transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleGuardar}
          className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-base font-semibold transition-colors"
        >
          <FaSave className="mr-2" />
          Guardar
        </button>
      </div>
    </div>
  );
}
