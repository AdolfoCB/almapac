"use client";
import { useRouter } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import SVGComponent from "../../components/SVGComponent";

export default function EnConstruccion() {
  const router = useRouter();

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center relative bg-white px-4 sm:px-6">
        {/* Cinta de construcción superior */}
        <div className="construction-tape top-tape"></div>
        {/* Cinta de construcción inferior */}
        <div className="construction-tape bottom-tape"></div>

        <div className="bg-white border border-gray-300 rounded-xl shadow-lg p-6 sm:p-8 max-w-lg w-full flex flex-col items-center space-y-4 sm:space-y-6 relative z-10">
          {/* Contenedor para 404 y el ícono en línea */}
          <div className="flex items-center space-x-2">
            <h1 className="text-5xl sm:text-6xl font-bold text-red-600">404</h1>
          </div>

          {/* SVG personalizado */}
          <div className="w-3/4 sm:w-full flex justify-center">
            <SVGComponent />
          </div>

          {/* Título con efecto máquina de escribir */}
          <h2 className="text-lg sm:text-xl font-bold text-orange-600 text-center uppercase">
            EN DESARROLLO
          </h2>

          <p className="text-sm sm:text-base text-gray-600 text-center">
            Estamos trabajando en esta sección. Vuelve más tarde para ver las novedades.
          </p>

          <button
            onClick={() => router.push("/")}
            className="flex items-center justify-center w-full bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-xl shadow transition transform hover:-translate-y-1"
          >
            <FiArrowLeft size={24} className="mr-3" />
            <span>Regresar</span>
          </button>
        </div>
      </div>

      <style jsx>{`

        .construction-tape {
          position: absolute;
          left: 0;
          width: 100%;
          background: repeating-linear-gradient(
            45deg,
            #f1c40f,
            #f1c40f 10px,
            #e67e22 10px,
            #e67e22 20px
          );
          z-index: 0;
        }

        .top-tape {
          top: 0;
          height: 10px;
        }

        .bottom-tape {
          bottom: 0;
          height: 10px;
        }

        @media (max-width: 640px) {
          .top-tape,
          .bottom-tape {
            height: 30px;
          }
        }
      `}</style>
    </>
  );
}
