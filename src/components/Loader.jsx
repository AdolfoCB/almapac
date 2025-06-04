// Loader.jsx
import React from 'react';

const Loader = () => (
  <div className="flex flex-col items-center justify-center w-full h-screen bg-gray-100 p-4">
    {/* Logo animado - tamaño responsive ajustado para móviles */}
    <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 ml-4">
      <AnimatedLogoSVG />
    </div>
    
    {/* Texto ALMAPAC con efecto burbuja - tamaño responsive */}
    <div className="flex space-x-0.5">
      {['A', 'L', 'M', 'A', 'P', 'A', 'C'].map((letter, index) => (
        <div 
          key={index}
          className="animate-[bounce_1.2s_ease-in-out_infinite]"
          style={{ 
            animationDelay: `${index * 0.08}s`,
            transformOrigin: 'bottom center'
          }}
        >
          <span className="text-orange-500 text-sm sm:text-base md:text-lg lg:text-xl font-bold">
            {letter}
          </span>
        </div>
      ))}
    </div>
  </div>
);

// Componente SVG optimizado
const AnimatedLogoSVG = () => (
  <svg
    className="w-full h-full"
    viewBox="0 0 374 300"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid meet"
  >
    <g className="main-icon">
      {/* Flecha izquierda - animación inicial */}
      <path
        className="animate-[pulse_1.6s_ease-in-out_infinite]"
        d="M36.5 243L130 235.5L93.5 210L184.5 87.5L197.5 73L203 69.5L209 67.5L226 63L141 59H125.5L118 66L41 173.5L17 150.5L36.5 243Z"
        fill="#FF6508"
        stroke="white"
        strokeWidth="1.5"
      >
        <animate
          attributeName="stroke-width"
          values="1.5;3;1.5"
          dur="2s"
          repeatCount="indefinite"
          begin="0s"
        />
      </path>

      {/* Rectángulos en secuencia */}
      {[
        { x: 202.603, y: 73, fill: "#FF6508", delay: "0.5s" },
        { x: 181.603, y: 101, fill: "#D9D9D9", delay: "0.7s" },
        { x: 160.603, y: 129, fill: "#808082", delay: "0.9s" },
        { x: 139.603, y: 157, fill: "#D9D9D9", delay: "1.1s" },
        { x: 119.603, y: 184, fill: "#130C6F", delay: "1.3s" },
        { x: 189.603, y: 150, fill: "#111393", delay: "1.5s" },
        { x: 168.603, y: 178, fill: "#FF6508", delay: "1.7s" },
        { x: 231.603, y: 94, fill: "#D9D9D9", delay: "1.9s" },
        { x: 210.603, y: 122, fill: "#808082", delay: "2.1s" },
        { x: 251.603, y: 68, fill: "#0D1573", delay: "2.3s" }
      ].map((rect, index) => (
        <rect
          key={index}
          className="animate-[pulse_2s_ease-in-out_infinite]"
          style={{ animationDelay: rect.delay }}
          x={rect.x}
          y={rect.y}
          width="29.512"
          height="29.512"
          transform={`rotate(36.6166 ${rect.x} ${rect.y})`}
          fill={rect.fill}
        />
      ))}

      {/* Flecha derecha - animación final */}
      <path
        className="animate-[pulse_1.8s_ease-in-out_infinite]"
        d="M192 237H152.5L180 221L281 84.5L253 64L346 49.5L356.5 139L333 125L291 180.5L265.5 215L250 237H243H226H192Z"
        fill="#FF6508"
        stroke="white"
        strokeWidth="1.5"
      >
        <animate
          attributeName="stroke-width"
          values="1.5;3;1.5"
          dur="2s"
          repeatCount="indefinite"
          begin="2.5s"
        />
      </path>
    </g>
  </svg>
);

export default Loader;