'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import {
  FiUser,
  FiTag,
  FiAward,
  FiLogOut,
  FiMail,
  FiShield,
  FiClock,
  FiChevronRight
} from 'react-icons/fi';
import { useEffect, useState } from 'react';
import Loader from '../../components/Loader';

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  function logOut() {
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 2000);
    localStorage.clear();
    signOut();
  }

  if (status === 'loading') {
    return (
        <Loader />
    );
  }

  if (!session || !session.user) {
    return null;
  }

  const { username, nombreCompleto, codigo, roleName } = session.user;
  const initials = nombreCompleto
    .split(' ')
    .map(name => name[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const roleColor = getRoleColor(roleName);

  const lastSession = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Header />

      <div className="max-w-4xl mx-auto px-4 pt-24 pb-12">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className={`bg-gradient-to-r ${roleColor} h-40 relative`}>
            <div className="absolute inset-0 opacity-20"
                 style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.3\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E")' }} />
            <div className="flex justify-between items-start p-6">
              <div className="text-white">
                <h1 className="text-2xl font-bold">Perfil de Usuario</h1>
                <p className="text-white text-opacity-80">Información personal</p>
              </div>
              <div className="flex items-center bg-white bg-opacity-20 px-3 py-1 rounded-full backdrop-blur-sm text-white text-sm">
                <FiShield className="mr-1" />
                <span>{roleName}</span>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 md:flex md:gap-8">
            <div className="md:w-1/3 flex flex-col items-center">
              <div className="-mt-16 mb-4 relative">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-bold bg-gradient-to-r ${roleColor} border-4 border-white shadow-md`}>
                  {initials}
                </div>
                <div className="absolute bottom-0 right-0 bg-green-500 w-5 h-5 rounded-full border-2 border-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 text-center">{nombreCompleto}</h2>
              <p className="text-indigo-600 font-medium">@{username}</p>
              <div className="mt-6 w-full space-y-4">
                <div className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="p-2 rounded-md bg-indigo-100 text-indigo-600 mr-3">
                    <FiTag size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Código de Usuario</p>
                    <p className="font-medium text-gray-800">{codigo}</p>
                  </div>
                </div>
                <div className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="p-2 rounded-md bg-orange-100 text-orange-600 mr-3">
                    <FiAward size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Rol del Sistema</p>
                    <p className="font-medium text-gray-800">{roleName}</p>
                  </div>
                </div>
                <div className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="p-2 rounded-md bg-blue-100 text-blue-600 mr-3">
                    <FiClock size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Última Sesión</p>
                    <p className="font-medium text-gray-800">{lastSession}</p>
                  </div>
                </div>
              </div>
              <div className="relative mt-8 w-full">
                <button
                  onClick={logOut}
                  className="w-full flex items-center justify-center space-x-2 bg-white border border-red-500 text-red-500 px-6 py-3 rounded-lg hover:bg-red-50 transition-colors group"
                >
                  <FiLogOut className="transition-transform group-hover:rotate-90" />
                  <span>Cerrar Sesión</span>
                </button>
                {showTooltip && (
                  <div className="absolute -top-12 left-0 right-0 bg-gray-800 text-white text-center py-2 px-4 rounded-lg text-sm animate-fadeOut">
                    Cerrando sesión...
                  </div>
                )}
              </div>
            </div>

            <div className="md:w-2/3 mt-8 md:mt-0">
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Información de la cuenta</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 rounded-md bg-indigo-100 text-indigo-600 mr-3"><FiUser size={16} /></div>
                      <div>
                        <p className="text-sm text-gray-500">Nombre completo</p>
                        <p className="font-medium">{nombreCompleto}</p>
                      </div>
                    </div>
                    <FiChevronRight className="text-gray-400 hover:text-indigo-600 rounded-full hover:bg-gray-100 p-1" />
                  </div>
                  <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 rounded-md bg-blue-100 text-blue-600 mr-3"><FiMail size={16} /></div>
                      <div>
                        <p className="text-sm text-gray-500">Nombre de usuario</p>
                        <p className="font-medium">@{username}</p>
                      </div>
                    </div>
                    <FiChevronRight className="text-gray-400 hover:text-indigo-600 rounded-full hover:bg-gray-100 p-1" />
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Permisos del sistema</h3>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center">
                      <div className="p-2 rounded-md bg-green-100 text-green-600 mr-3"><FiShield size={16} /></div>
                      <div>
                        <p className="font-medium">{roleName}</p>
                        <p className="text-sm text-gray-500">{getRoleDescription(roleName)}</p>
                      </div>
                    </div>
                    <div className="mt-4 pl-11 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {getPermissions(roleName).map((perm, idx) => (
                        <div key={idx} className="flex items-center text-sm">
                          <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                          <span>{perm}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8 text-center">
                  <button
                    onClick={() => router.push('/')}
                    type="button"
                    className="inline-flex items-center text-indigo-600 hover:text-indigo-800 transition-colors text-sm cursor-pointer"
                  >
                    <span>Volver al inicio</span>
                    <FiChevronRight className="ml-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getRoleColor(role) {
  const roleMap = {
    'Administrador': 'from-red-700 to-yellow-600',
    'Muellero': 'from-teal-600 to-green-700',
    'Chequero': 'from-yellow-500 to-orange-600',
    'Muellero Chequero': 'from-cyan-600 to-lime-600',
    'Auditor de Procesos': 'from-orange-600 to-red-600',
    'Operador': 'from-green-600 to-green-800',
    'Supervisor de Mantenimiento': 'from-blue-600 to-blue-800',
    'default': 'from-gray-700 to-gray-900'
  };
  return roleMap[role] || roleMap.default;
}

function getRoleDescription(role) {
  const descriptions = {
    'Administrador': 'Acceso total al sistema',
    'Muellero': 'Encargado de las bitácoras de barcos',
    'Chequero': 'Gestión completa de recepciones',
    'Muellero Chequero': 'Realiza funciones de muelle y chequeo en recepciones de barcos',
    'Auditor de Procesos': 'Audita y supervisa recepciones',
    'Operador': 'Registra y gestiona mantenimiento de equipos',
    'Supervisor de Mantenimiento': 'Supervisa labores de mantenimiento',
    'default': 'Usuario del sistema de despachos'
  };
  return descriptions[role] || descriptions.default;
}

// Ajuste de permisos por rol, según grupos reales
function getPermissions(role) {
  const map = {
    'Administrador': [
      'Acceso al sistema',
      'Gestión de usuarios y roles',
      'Gestión de bitácoras de barcos',
      'Gestión de recepciones y traslados',
      'Gestion de inspeccion y mantenimiento de equipos',
      'Acceso a reportes',
      'Acceso a todas las funciones del sistema'
    ],
    'Muellero': [
      'Acceso al sistema',
      'Registro de bitácoras de barcos',
      'Gestión de bitácoras de barcos'
    ],
    'Chequero': [
      'Acceso al sistema',
      'Registro de recepciones y traslados',
      'Gestión de recepciones y traslados'
    ],
    'Muellero Chequero': [
      'Acceso al sistema',
      'Registro de bitácoras de barcos',
      'Gestión de bitácoras de barcos',
      'Registro de recepciones y traslados',
      'Gestión de recepciones y traslados'
    ],
    'Auditor de Procesos': [
      'Acceso al sistema',
      'Gestión de recepciones y traslados',
      'Acceso a reportes'
    ],
    'Operador': [
      'Acceso al sistema',
      'Registro de inspección y mantenimiento de equipos',
      'Gestion de inspeccion y mantenimiento de equipos'
    ],
    'Supervisor de Mantenimiento': [
      'Acceso al sistema',
      'Gestion de inspeccion y mantenimiento de equipos',
      'Acceso a reportes'
    ],
    'default': ['Acceso básico al sistema']
  };
  return map[role] || map.default;
}