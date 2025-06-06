"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { FiHome, FiChevronDown, FiLogOut, FiUser, FiHelpCircle } from "react-icons/fi";

export default function Header() {
  const router = useRouter();
  const [cachedUser, setCachedUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);

  // Recuperar datos del usuario desde localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("userName");
      if (cached) {
        setCachedUser(cached);
      }
    }
  }, []);

  // Cerrar el menú al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function logOut() {
    sessionStorage.removeItem("user");
    // limpiamos todo el localStorage
    localStorage.clear();
    signOut();
  }

  // Inicial para avatar
  const userInitial = cachedUser ? cachedUser.charAt(0).toUpperCase() : "U";

  return (
    <header className="fixed top-0 left-0 right-0 bg-white shadow-md z-50">
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button onClick={() => router.push("/")} className="mr-1">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200">
              <FiHome size={20} className="text-white" />
            </div>
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-blue-900">ALMAPAC</h1>
            <p className="text-xs sm:text-sm text-gray-600">Almacenadora del Pacífico</p>
          </div>
        </div>
        <div className="flex items-center space-x-4 mt-2 sm:mt-0">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 rounded-full transition-all duration-300 transform hover:scale-105"
              title="Opciones de usuario"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-medium shadow-md">
                {userInitial}
              </div>
              <span className="uppercase hidden sm:inline text-gray-700 font-medium">{cachedUser || "Usuario"}</span>
              <FiChevronDown size={16} className="text-gray-700" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                {cachedUser && (
                  <div className="block sm:hidden px-4 py-2 text-sm uppercase text-gray-900 border-b border-gray-100 font-medium">
                    {cachedUser}
                  </div>
                )}
                <a
                  href="/perfil"
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <FiUser className="mr-2" size={16} />
                  Mi Perfil
                </a>
                <div className="border-t border-gray-100 my-1"></div>
                <button
                  onClick={logOut}
                  className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <FiLogOut className="mr-2" size={16} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}