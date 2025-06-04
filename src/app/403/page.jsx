// pages/403.jsx
"use client";

import Head from "next/head";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { FaLock, FaArrowLeft, FaHome, FaSignInAlt } from "react-icons/fa";

export default function ForbiddenPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isLoading = status === "loading";

  const handleGoBack = () => router.back();
  const handleHome = () => router.push("/");
  const handleLogin = () => router.push("/login");

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-90 z-50"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="h-12 w-12 border-4 border-red-500 border-t-transparent rounded-full"
        />
      </motion.div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { when: "beforeChildren", staggerChildren: 0.15 },
    },
  };
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 120 } },
  };

  const holesCoords = [
    "top-4 left-4",
    "top-4 right-4",
    "bottom-4 left-4",
    "bottom-4 right-4",
  ];

  return (
    <>
      <Head>
        <title>Acceso prohibido | Error 403</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://fonts.googleapis.com/css?family=Montserrat:500,700,900"
          rel="stylesheet"
        />
      </Head>

      <AnimatePresence>
        <motion.div
          className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 flex items-center justify-center p-2"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={containerVariants}
        >
          <div
            className="relative w-full max-w-lg bg-white shadow-xl rounded-2xl overflow-hidden"
            style={{ fontFamily: "Montserrat, sans-serif" }}
          >
            {/* Marchamos estáticos con z-index elevado */}
            {holesCoords.map((coords, i) => (
              <div
                key={i}
                className={`absolute rounded-full rotate-45 w-4 h-4 sm:w-6 sm:h-6 ${coords} z-20`}
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 99%, #f4f4f4 10%, grey 70%)",
                }}
              />
            ))}

            {/* Encabezado estático, SIN ANIMACIÓN */}
            <div className="bg-red-600 text-white text-center py-6">
              <FaLock className="mx-auto mb-2 text-6xl animate-pulse" />
              <h1 className="text-3xl sm:text-4xl font-extrabold">403 Prohibido</h1>
            </div>

            {/* Mensaje principal animado */}
            <motion.div
              className="p-4 flex flex-row items-center"
              variants={itemVariants}
            >
              <div className="flex-1 text-center">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 uppercase">
                  Solo personal autorizado
                </h2>
                <p className="mt-2 text-gray-600">
                  <strong>Error 403:</strong> Forbidden. No tienes permiso para ver este recurso.
                </p>
              </div>
              <div className="flex-1 mt-4 md:mt-0 flex justify-center">
                <svg
                  viewBox="0 0 500 500"
                  className="w-32 h-32 sm:w-40 sm:h-40"
                  preserveAspectRatio="xMinYMin meet"
                >
                  <defs>
                    <pattern
                      id="img"
                      patternUnits="userSpaceOnUse"
                      width="450"
                      height="450"
                    >
                      <image
                        x="25"
                        y="25"
                        width="450"
                        height="450"
                        xlinkHref="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
                      />
                    </pattern>
                  </defs>
                  <circle
                    cx="250"
                    cy="250"
                    r="200"
                    stroke="#ef5350"
                    strokeWidth="30"
                    fill="url(#img)"
                  />
                  <line
                    x1="100"
                    y1="100"
                    x2="400"
                    y2="400"
                    stroke="#ef5350"
                    strokeWidth="30"
                  />
                </svg>
              </div>
            </motion.div>

            {/* Botones animados */}
            <motion.div
              className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8"
              variants={itemVariants}
            >
              <button
                onClick={handleGoBack}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-transform transform hover:scale-105"
              >
                <FaArrowLeft /> Volver
              </button>

              {session ? (
                <button
                  onClick={handleHome}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-transform transform hover:scale-105"
                >
                  <FaHome /> Inicio
                </button>
              ) : (
                <button
                  onClick={handleLogin}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-transform transform hover:scale-105"
                >
                  <FaSignInAlt /> Ingresar
                </button>
              )}
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}