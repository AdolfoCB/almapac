"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import WeatherLoader from "./WeatherLoader";

// Iconos de Material Design
import {
  MdAir,
  MdRefresh,
  MdWaterDrop,
  MdVisibility,
  MdWbSunny,
  MdDeviceThermostat,
} from "react-icons/md";

// Iconos de Weather Icons
import {
  WiThermometer,
  WiHumidity,
  WiRain,
  WiBarometer,
  WiFog,
  WiDaySunny,
  WiSunrise,
  WiSunset,
  WiStrongWind,
  WiCloudy,
  WiDayCloudyHigh,
  WiMoonAltWaxingCrescent4,
  WiMoonAltFull,
  WiMoonAltNew,
  WiMoonAltWaningCrescent3,
} from "react-icons/wi";

// Iconos de FontAwesome
import {
  FaArrowUp,
  FaTemperatureLow,
  FaTemperatureHigh,
  FaWind,
  FaCloudSunRain,
} from "react-icons/fa";

// Otros iconos
import { IoMdTime } from "react-icons/io";
import { BsDropletHalf, BsSunrise, BsSunset } from "react-icons/bs";

// ——————————————
// Constantes de caché
const CACHE_KEY = "weatherDataPremium";
const CACHE_TIMESTAMP_KEY = "weatherDataTimestampPremium";
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutos

// ——————————————
// Funciones auxiliares

const getDayLength = (sunriseStr, sunsetStr) => {
  if (!sunriseStr || !sunsetStr) return "--";
  const today = new Date();
  const sunriseDate = new Date(`${today.toDateString()} ${sunriseStr}`);
  const sunsetDate = new Date(`${today.toDateString()} ${sunsetStr}`);
  const diffMs = sunsetDate.getTime() - sunriseDate.getTime();
  if (diffMs < 0) return "--";
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffM = Math.floor((diffMs / (1000 * 60)) % 60);
  return `${diffH}h ${diffM}m`;
};

const getUvIndexInfo = (uv = 0) => {
  if (uv < 3) return { level: "Bajo", protection: "No necesario", color: "text-emerald-400", bgColor: "bg-emerald-100" };
  if (uv < 6) return { level: "Moderado", protection: "Uso moderado", color: "text-yellow-400", bgColor: "bg-yellow-100" };
  if (uv < 8) return { level: "Alto", protection: "Recomendado", color: "text-orange-500", bgColor: "bg-orange-100" };
  if (uv < 11) return { level: "Muy alto", protection: "Obligatorio", color: "text-red-500", bgColor: "bg-red-100" };
  return { level: "Extremo", protection: "Extrema precaución", color: "text-purple-500", bgColor: "bg-purple-100" };
};

const getAirQualityInfo = (index = 0) => {
  switch (index) {
    case 1: return { label: "Excelente", description: "Aire puro y saludable", color: "#10b981", bgColor: "bg-emerald-50", emoji: "😊" };
    case 2: return { label: "Buena", description: "Calidad aceptable", color: "#84cc16", bgColor: "bg-lime-50", emoji: "🙂" };
    case 3: return { label: "Moderada", description: "Sensible para grupos de riesgo", color: "#f59e0b", bgColor: "bg-amber-50", emoji: "😐" };
    case 4: return { label: "Pobre", description: "Riesgo para toda la población", color: "#f97316", bgColor: "bg-orange-50", emoji: "😷" };
    case 5: return { label: "Muy Pobre", description: "Alerta de salud pública", color: "#ef4444", bgColor: "bg-red-50", emoji: "🤒" };
    case 6: return { label: "Peligrosa", description: "Emergencia de salud", color: "#b91c1c", bgColor: "bg-rose-50", emoji: "⚠️" };
    default: return { label: "--", description: "Datos no disponibles", color: "#6b7280", bgColor: "bg-gray-50", emoji: "❓" };
  }
};

const getMoonPhase = (phase = "") => {
  if (phase.includes("New")) return "Luna nueva";
  if (phase.includes("Full")) return "Luna llena";
  if (phase.includes("Waxing") || phase.includes("First")) return "Cuarto creciente";
  if (phase.includes("Waning") || phase.includes("Last")) return "Cuarto menguante";
  return phase || "--";
};

const getMoonIcon = (phase = "") => {
  if (phase.includes("New")) return <WiMoonAltNew className="text-2xl text-blue-300" />;
  if (phase.includes("Full")) return <WiMoonAltFull className="text-2xl text-yellow-300" />;
  if (phase.includes("Waxing") || phase.includes("First")) return <WiMoonAltWaxingCrescent4 className="text-2xl text-gray-300" />;
  return <WiMoonAltWaningCrescent3 className="text-2xl text-gray-400" />;
};

const getTemperatureRange = (min = 0, max = 0, current = 0) => {
  const range = max - min;
  if (range === 0) return 50;
  return Math.min(100, Math.max(0, ((current - min) / range) * 100));
};

// Mapea texto de condición a un icono
const getConditionIcon = (text, size = "w-24 h-24") => {
  const t = (text || "").toLowerCase();
  if (t.includes("rain")) return <WiRain className={`${size} text-blue-500`} />;
  if (t.includes("cloud")) return <WiCloudy className={`${size} text-gray-400`} />;
  if (t.includes("sun") || t.includes("clear")) return <WiDaySunny className={`${size} text-yellow-400`} />;
  if (t.includes("storm") || t.includes("thunder")) return <WiStrongWind className={`${size} text-indigo-500`} />;
  if (t.includes("fog") || t.includes("mist")) return <WiFog className={`${size} text-gray-500`} />;
  if (t.includes("snow")) return <WiDayCloudyHigh className={`${size} text-blue-200`} />;
  return <WiDaySunny className={`${size} text-yellow-400`} />;
};

// ——————————————
// Componente principal

export default function WeatherWidget() {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);
  const hourlyForecastRef = useRef(null);
  const [currentHourIndex, setCurrentHourIndex] = useState(0);

  const API_KEY = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
  const url = `/api/weather/forecast.json?key=${API_KEY}&q=13.571590310635003,-89.83056926998199&days=7&aqi=yes&alerts=yes&lang=es`;

  const fetchWeather = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await fetch(url);
      const data = await response.json();
      // Validar que venga al menos current.condition
      if (!data?.current?.condition) {
        console.error("Datos incompletos de la API:", data);
        throw new Error("Datos meteorológicos incompletos");
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
      setWeatherData(data);

      // Determinar índice de la hora actual en el forecast
      const hours = data.forecast?.forecastday?.[0]?.hour;
      if (hours) {
        const now = new Date();
        const idx = hours.findIndex(h => new Date(h.time).getHours() === now.getHours());
        setCurrentHourIndex(idx >= 0 ? idx : 0);
      }
    } catch (error) {
      console.error("Error fetching weather data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [url]);

  // Carga inicial y caché
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    const ts = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    const now = Date.now();
    if (cached && ts && now - parseInt(ts, 10) < CACHE_DURATION) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.current?.condition) {
          setWeatherData(parsed);
          setLoading(false);
        } else {
          fetchWeather();
        }
      } catch {
        fetchWeather();
      }
    } else {
      fetchWeather();
    }
    const interval = setInterval(fetchWeather, CACHE_DURATION);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  // Reloj interno
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Scroll al pronóstico de la hora actual
  useEffect(() => {
    if (hourlyForecastRef.current && !loading) {
      const container = hourlyForecastRef.current;
      const elem = container.children[currentHourIndex];
      if (elem) {
        container.scrollTo({
          left: elem.offsetLeft - container.offsetWidth / 2 + elem.offsetWidth / 2,
          behavior: "smooth",
        });
      }
    }
  }, [loading, currentHourIndex]);

  // Estados de carga y error
  if (loading) return <WeatherLoader />;
  if (!weatherData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center p-6 bg-white rounded-xl shadow-lg">
          <p className="text-red-500 font-medium">Error al cargar los datos meteorológicos</p>
          <button onClick={fetchWeather} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Destructuración y cálculos
  const { location, current, forecast, alerts } = weatherData;
  const hour = currentTime.getHours();
  const saludo = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const localDateStr = currentTime.toISOString().split("T")[0];
  const todayData = forecast?.forecastday?.find(d => d.date === localDateStr) || forecast?.forecastday?.[0] || {};
  const { day: todayForecast = {}, astro = {}, hour: hourlyData = [] } = todayData;

  const uvInfo = getUvIndexInfo(current.uv);
  const airQualityData = getAirQualityInfo(current.air_quality?.["us-epa-index"]);
  const moonPhase = getMoonPhase(astro.moon_phase);
  const moonIcon = getMoonIcon(astro.moon_phase);
  const temps = hourlyData.map(h => h.feelslike_c);
  const apparentMin = temps.length ? Math.min(...temps) : "--";
  const apparentMax = temps.length ? Math.max(...temps) : "--";
  const tempPos = getTemperatureRange(todayForecast.mintemp_c, todayForecast.maxtemp_c, current.temp_c);

  // Métricas para grid
  const weatherMetrics = [
    {
      icon: <MdDeviceThermostat className="text-2xl text-rose-500" />,
      title: "Sensación Térmica",
      value: `${current.feelslike_c ?? "--"}°C`,
      description: `Min ${apparentMin}° / Max ${apparentMax}°`,
    },
    {
      icon: <WiHumidity className="text-2xl text-blue-500" />,
      title: "Humedad",
      value: `${current.humidity ?? "--"}%`,
      description: `Punto de rocío: ${current.dewpoint_c ?? "--"}°C`,
    },
    {
      icon: <FaWind className="text-xl text-sky-500" />,
      title: "Viento",
      value: `${current.wind_kph ?? "--"} km/h`,
      description: `Dirección: ${current.wind_dir ?? "--"} - Ráfagas: ${current.gust_kph ?? "--"} km/h`,
    },
    {
      icon: <FaCloudSunRain className="text-xl text-indigo-500" />,
      title: "Precipitación",
      value: `${current.precip_mm ?? "--"} mm`,
      description: `Probabilidad: ${todayForecast.daily_chance_of_rain ?? "--"}%`,
    },
    {
      icon: <WiBarometer className="text-2xl text-purple-500" />,
      title: "Presión",
      value: `${current.pressure_mb ?? "--"} mb`,
      description: `Tendencia: ${current.pressure_in > 30 ? "Alta" : "Baja"}`,
    },
    {
      icon: <MdVisibility className="text-xl text-gray-500" />,
      title: "Visibilidad",
      value: `${current.vis_km ?? "--"} km`,
      description:
        current.vis_km > 10 ? "Excelente" :
        current.vis_km > 5 ? "Buena" : "Limitada",
    },
  ];

  const additionalMetrics = [
    {
      icon: (
        <div className={`p-2 rounded-full ${uvInfo.bgColor}`}>
          <WiDaySunny className={`text-xl ${uvInfo.color}`} />
        </div>
      ),
      title: "Índice UV",
      value: current.uv ?? "--",
      description: uvInfo.level,
    },
    {
      icon: (
        <div className={`p-2 rounded-full ${uvInfo.bgColor}`}>
          <MdWbSunny className={`text-xl ${uvInfo.color}`} />
        </div>
      ),
      title: "Protección Solar",
      value: uvInfo.protection,
      description: `Radiación: ${current.uv ?? "--"} UV`,
    },
    {
      icon: <BsSunrise className="text-xl text-amber-400" />,
      title: "Amanecer",
      value: astro.sunrise ?? "--",
      description: `Inicio del día`,
    },
    {
      icon: <BsSunset className="text-xl text-orange-500" />,
      title: "Atardecer",
      value: astro.sunset ?? "--",
      description: `Duración: ${getDayLength(astro.sunrise, astro.sunset)}`,
    },
    {
      icon: moonIcon,
      title: "Fase Lunar",
      value: moonPhase,
      description: `Iluminación: ${astro.moon_illumination ?? "--"}%`,
    },
    {
      icon: <WiDayCloudyHigh className="text-2xl text-gray-400" />,
      title: "Nubosidad",
      value: `${current.cloud ?? "--"}%`,
      description:
        current.cloud < 30 ? "Despejado" :
        current.cloud < 70 ? "Parcial" : "Nublado",
    },
  ];

  const airQualityMetrics = current.air_quality
    ? [
        {
          name: "CO",
          value: current.air_quality.co?.toFixed(1) ?? "--",
          unit: "µg/m³",
          safeLevel: 4,
        },
        {
          name: "NO₂",
          value: current.air_quality.no2?.toFixed(1) ?? "--",
          unit: "µg/m³",
          safeLevel: 25,
        },
        {
          name: "O₃",
          value: current.air_quality.o3?.toFixed(1) ?? "--",
          unit: "µg/m³",
          safeLevel: 60,
        },
        {
          name: "SO₂",
          value: current.air_quality.so2?.toFixed(1) ?? "--",
          unit: "µg/m³",
          safeLevel: 20,
        },
        {
          name: "PM2.5",
          value: current.air_quality.pm2_5?.toFixed(1) ?? "--",
          unit: "µg/m³",
          safeLevel: 12,
        },
        {
          name: "PM10",
          value: current.air_quality.pm10?.toFixed(1) ?? "--",
          unit: "µg/m³",
          safeLevel: 20,
        },
      ]
    : [];

  return (
    <div className="mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
      {/* Header */}
      <div className="bg-white text-black px-5 py-6 md:px-8 md:py-8">
        <div className="flex justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              {saludo}, {location.name}
            </h1>
            <p className="text-base md:text-lg">
              {location.region}, {location.country}
            </p>
            <p className="text-sm text-gray-700 mb-1">
              Planta Almapac:{" "}
              {currentTime.toLocaleTimeString("es-ES", {
                timeZone: "America/El_Salvador",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })}
            </p>
          </div>
          <button
            onClick={fetchWeather}
            className={`p-2 rounded-full bg-gray-200 hover:bg-blue-700 transition-colors ${
              refreshing ? "animate-spin" : ""
            }`}
            aria-label="Refresh"
          >
            <MdRefresh className="text-2xl" />
          </button>
        </div>
      </div>

      {/* Vista rápida */}
      <div className="px-5 py-6 md:px-8 md:py-8 border-b border-gray-200">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              {getConditionIcon(current.condition.text, "w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28")}
              <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-sm">
                <div
                  className={`text-xs px-2 py-1 rounded-full ${uvInfo.bgColor} ${uvInfo.color}`}
                >
                  UV {current.uv ?? "--"}
                </div>
              </div>
            </div>
            <div>
              <p className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-800">
                {current.temp_c ?? "--"}°C
              </p>
              <p className="text-lg text-gray-600">
                {current.condition.text ?? "--"}
              </p>
              <p className="text-sm text-gray-500">
                Sensación: {current.feelslike_c ?? "--"}°C
              </p>
            </div>
          </div>

          {/* Barra de temperatura con degradado */}
          <div className="w-full">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Mín: {todayForecast.mintemp_c ?? "--"}°C</span>
              <span>
                Media:{" "}
                {todayForecast.mintemp_c != null && todayForecast.maxtemp_c != null
                  ? (((todayForecast.mintemp_c + todayForecast.maxtemp_c) / 2).toFixed(1))
                  : "--"}{" "}
                °C
              </span>
              <span>Máx: {todayForecast.maxtemp_c ?? "--"}°C</span>
            </div>
            <div className="relative h-6 rounded-full overflow-hidden bg-gray-200">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to right, #3B82F6, #60A5FA, #93C5FD, #6EE7B7, #FDE047, #FB923C, #F87171)",
                }}
              />
              <div
                className="absolute top-0 bottom-0 w-1 bg-gray-900 transform -translate-x-1/2 shadow-lg"
                style={{ left: `${tempPos}%` }}
              >
                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-sm font-bold whitespace-nowrap">
                  {current.temp_c ?? "--"}°C
                  <div className="absolute left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-l-transparent border-r-transparent border-b-4 border-b-gray-900"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Condiciones actuales */}
      <div className="px-5 py-6 md:px-8 md:py-8">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <WiDaySunny className="text-2xl text-yellow-400 mr-2" />
          Condiciones Actuales
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {weatherMetrics.map((metric, i) => (
            <div
              key={i}
              className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  {metric.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700">
                    {metric.title}
                  </h3>
                  <p className="text-2xl font-bold text-gray-800">
                    {metric.value}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {metric.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Información adicional */}
      <div className="px-5 py-6 md:px-8 md:py-8 border-t border-gray-200">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <WiDayCloudyHigh className="text-2xl text-blue-400 mr-2" />
          Información Adicional
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {additionalMetrics.map((metric, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="flex justify-center mb-2">{metric.icon}</div>
              <h3 className="text-xs font-medium text-gray-500">
                {metric.title}
              </h3>
              <p className="text-lg font-semibold text-gray-800">
                {metric.value}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {metric.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Calidad del Aire */}
      <div className="px-5 py-6 md:px-8 md:py-8 border-t border-gray-200">
        <div
          className={`${airQualityData.bgColor} rounded-xl p-5 cursor-pointer`}
          onClick={() =>
            setExpandedSection(expandedSection === "air" ? null : "air")
          }
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <MdAir
                className="text-3xl"
                style={{ color: airQualityData.color }}
              />
              <div>
                <h2
                  className="text-xl font-bold"
                  style={{ color: airQualityData.color }}
                >
                  Calidad del Aire: {airQualityData.label}{" "}
                  {airQualityData.emoji}
                </h2>
                <p className="text-gray-700">
                  {airQualityData.description}
                </p>
              </div>
            </div>
            <div
              className={`transform transition-transform ${
                expandedSection === "air" ? "rotate-180" : ""
              }`}
            >
              <svg
                className="w-6 h-6 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>

          {expandedSection === "air" && (
            <div className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {airQualityMetrics.map((metric, i) => (
                  <div
                    key={i}
                    className="bg-white bg-opacity-80 rounded-lg p-3 flex flex-col items-center text-center"
                  >
                    <h3 className="text-sm font-medium text-gray-700 mb-1">
                      {metric.name}
                    </h3>
                    <p
                      className={`text-xl font-bold ${
                        parseFloat(metric.value) > metric.safeLevel
                          ? "text-red-500"
                          : "text-green-500"
                      }`}
                    >
                      {metric.value}
                      <span className="text-xs ml-1">{metric.unit}</span>
                    </p>
                    <div className="mt-1 w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          parseFloat(metric.value) > metric.safeLevel
                            ? "bg-red-300"
                            : "bg-green-300"
                        }`}
                        style={{
                          width: `${Math.min(
                            (parseFloat(metric.value) / metric.safeLevel) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {parseFloat(metric.value) > metric.safeLevel
                        ? `Supera en ${(parseFloat(metric.value) - metric.safeLevel).toFixed(1)}µg`
                        : "Dentro de lo seguro"}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-gray-600 text-center">
                <p>
                  Niveles seguros según OMS: CO ≤4µg/m³ • NO₂ ≤25µg/m³<br />
                  O₃ ≤60µg/m³ • SO₂ ≤20µg/m³ • PM2.5 ≤12µg/m³ • PM10 ≤20µg/m³
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pronóstico por Horas */}
      <div className="px-5 py-6 md:px-8 md:py-8 border-t border-gray-200">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <IoMdTime className="text-2xl text-blue-500 mr-2" />
          Pronóstico por Horas
        </h2>
        <div className="overflow-x-auto">
          <div className="flex space-x-4 pb-4" ref={hourlyForecastRef}>
            {hourlyData.map((hour, i) => {
              const hourDate = new Date(hour.time);
              const isCurrentHour = hourDate.getHours() === currentTime.getHours();
              return (
                <div
                  key={i}
                  className={`flex-shrink-0 rounded-xl p-3 w-20 sm:w-24 md:w-28 flex flex-col items-center ${
                    isCurrentHour
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-gray-50"
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      isCurrentHour ? "text-blue-600" : "text-gray-500"
                    }`}
                  >
                    {hourDate.getHours()}h
                  </p>
                  {hour.condition?.icon ? (
                    <img
                      src={`https:${hour.condition.icon}`}
                      alt={hour.condition.text}
                      className="w-10 h-10 sm:w-12 sm:h-12 object-contain my-1"
                    />
                  ) : (
                    <WiDaySunny className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-400 my-1" />
                  )}
                  <p
                    className={`text-lg font-semibold ${
                      isCurrentHour ? "text-blue-700" : "text-gray-800"
                    }`}
                  >
                    {hour.temp_c ?? "--"}°
                  </p>
                  {hour.chance_of_rain > 0 && (
                    <div className="flex items-center space-x-1">
                      <BsDropletHalf className="text-blue-400 text-xs" />
                      <span className="text-xs text-blue-500">
                        {hour.chance_of_rain}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Alertas */}
      {alerts?.alert?.length > 0 && (
        <div className="px-5 py-6 md:px-8 md:py-8 border-t border-red-200 bg-red-50">
          <div
            className="cursor-pointer"
            onClick={() =>
              setExpandedSection(expandedSection === "alerts" ? null : "alerts")
            }
          >
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-red-600 flex items-center">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Alertas Meteorológicas ({alerts.alert.length})
              </h2>
              <div
                className={`transform transition-transform ${
                  expandedSection === "alerts" ? "rotate-180" : ""
                }`}
              >
                <svg
                  className="w-6 h-6 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>
          {expandedSection === "alerts" && (
            <div className="mt-4 space-y-4">
              {alerts.alert.map((alert, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg p-4 border border-red-200"
                >
                  <h3 className="font-bold text-red-700">
                    {alert.headline}
                  </h3>
                  <p className="text-sm text-red-600 mt-1">
                    {alert.desc}
                  </p>
                  <div className="flex flex-col sm:flex-row justify-between mt-2 text-xs text-red-500 gap-1">
                    <span>Inicio: {alert.effective}</span>
                    <span>Fin: {alert.expires}</span>
                  </div>
                  {alert.instruction && (
                    <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700">
                      <p className="font-semibold">Recomendación:</p>
                      <p>{alert.instruction}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="bg-gray-50 py-4 text-center text-xs text-gray-500">
        <p>Datos proporcionados por WeatherAPI.com</p>
        <p className="mt-1">
          Actualizado:{" "}
          {current.last_updated
            ? new Date(current.last_updated).toLocaleString("es-ES")
            : "--"}
        </p>
      </div>
    </div>
  );
}