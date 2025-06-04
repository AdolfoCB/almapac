"use client";
import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import Swal from "sweetalert2";
import {
  FiArrowLeft,
  FiRefreshCw,
  FiUsers,
  FiTag,
} from "react-icons/fi";
import { FaPlus } from "react-icons/fa";
import Loader from "@/components/Loader";
import DataTable from "@/components/DataTable";
import { showErrorAlert } from "@/lib/errorAlert";

// Tipos para usuario y rol
interface Role {
  id: number;
  name: string;
}

interface User {
  id: number;
  username: string;
  nombreCompleto: string;
  codigo: string;
  email: string;
  password?: string;
  role?: Role | null;
  roleId?: number;
  activo: boolean;
}

// --- Helper: Toast Success Notification ---
const toastSuccess = (title: string) => {
  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "success",
    title,
    showConfirmButton: false,
    timer: 1500,
  });
};

// --- Helper: Confirm Deletion Dialog ---
const confirmDelete = async (title: string, text: string) => {
  return Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33", // red confirm
    cancelButtonColor: "#3085d6", // blue cancel
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "No, cancelar",
  });
};

// --- Helper: Show Error Message ---
const showError = (message?: string, defaultMsg = "Ocurrió un error") => {
  Swal.fire("Error", message || defaultMsg, "error");
};

export default function UserRoleManagement() {

  // Pestaña activa
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");

  // Usuarios y roles
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);

  // Búsquedas
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [roleSearchQuery, setRoleSearchQuery] = useState("");

  // Estados para modales y formularios Usuario
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    username: "",
    nombreCompleto: "",
    codigo: "",
    email: "",
    password: "",
    roleId: "",
  });

  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editUserForm, setEditUserForm] = useState({
    id: null as number | null,
    username: "",
    nombreCompleto: "",
    codigo: "",
    email: "",
    password: "",
    roleId: "",
  });

  const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);

  // Estados para modales y formularios Rol
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");

  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  const [editRoleForm, setEditRoleForm] = useState({
    id: null as number | null,
    name: "",
  });

  const [isDeleteRoleModalOpen, setIsDeleteRoleModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<number | null>(null);

  // Función para cargar usuarios
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/v1/users");
      const data = await res.json();
      setUsers(data.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
    setLoadingUsers(false);
  };

  // Función para cargar roles
  const fetchRoles = async () => {
    setLoadingRoles(true);
    try {
      const res = await fetch("/api/v1/roles");
      const data = await res.json();
      setRoles(data.data);
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
    setLoadingRoles(false);
  };

  // Función para Actualizar datos
  const refreshData = async () => {
    await Promise.all([fetchUsers(), fetchRoles()]);
    Swal.fire("Refrescado", "Datos actualizados", "success");
  };

  // Cargar todos los datos al montar el componente
  useEffect(() => {
    async function loadAllData() {
      await Promise.all([fetchUsers(), fetchRoles()]);
      setAllLoaded(true);
    }
    loadAllData();
  }, []);

  // Filtrar usuarios según la búsqueda
  const filteredUsers = users.filter((user) => {
    if (!user) return false;
    const query = userSearchQuery.toLowerCase();

    return (
      user.username?.toLowerCase().includes(query) ||
      user.nombreCompleto?.toLowerCase().includes(query) ||
      user.codigo?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  // Filtrar roles según la búsqueda
  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(roleSearchQuery.toLowerCase())
  );

  // Manejo del switch de activo en la tabla de usuarios
  const handleToggleActivo = async (user: User) => {
    const newActivo = !user.activo;
    const payload = {
      username: user.username,
      nombreCompleto: user.nombreCompleto,
      codigo: user.codigo,
      email: user.email,
      roleId: user.role?.id,
      activo: newActivo,
    };
    try {
      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const result = await res.json();
        const updatedUser = result.data;
        setUsers((prevUsers) =>
          prevUsers.map((u) => (u.id === user.id ? updatedUser : u))
        );
         toastSuccess(`Usuario ${newActivo ? "activado" : "desactivado"}`);
      }else{
        const err = await res.json();
        await showErrorAlert(err, "No se pudo actualizar el usuario");
        return;
      }
    } catch(error) {
      console.log(error);
      showError("No se pudo actualizar el usuario");
    }
  };

  // Función para asignar colores a la etiqueta de rol (colores distintos para cada rol)
  const getRoleBadgeClass = (roleName?: string) => {
    if (!roleName) return "bg-yellow-200 text-yellow-800";
    const r = roleName.toLowerCase();
    if (r.includes("administrador")) return "bg-blue-200 text-blue-800 font-bold";
    if (r.includes("asistente")) return "bg-green-200 text-green-800 font-bold";
    if (r.includes("muellero")) return "bg-orange-200 text-orange-800 font-bold";
    if (r.includes("operador")) return "bg-cyan-200 text-cyan-800 font-bold";
    if (r.includes("supervisor")) return "bg-red-200 text-red-800 font-bold";
    if (r.includes("chequero")) return "bg-indigo-200 text-indigo-800 font-bold";
    if (r.includes("auditor")) return "bg-amber-200 text-amber-800 font-bold";
    return "bg-gray-200 text-gray-800";
  };

  // Abrir modal para crear usuario
  const openCreateUserModal = () => {
    setCreateUserForm({
      username: "",
      nombreCompleto: "",
      codigo: "",
      email: "",
      password: "",
      roleId: "",
    });
    setIsCreateUserModalOpen(true);
  };

  const handleCreateUserChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCreateUserForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateUserSubmit = async (e: FormEvent) => {
    e.preventDefault();
    Swal.fire({
      title: "Procesando solicitud...",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
    try {
      const res = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createUserForm,
          roleId: parseInt(createUserForm.roleId, 10),
        }),
      });
      Swal.close();
      if (res.ok) {
        const result = await res.json();
        const createdUser = result.data;
        setUsers((prev) => [...prev, createdUser]);
        setIsCreateUserModalOpen(false);
        toastSuccess("Usuario registrado");
      } else {
        const err = await res.json();
        await showErrorAlert(err, "No se pudo registrar el usuario");
        return;
      }
    } catch(error) {
      console.log(error);
      showError("No se pudo registrar el usuario");
    }
  };

  // Abrir modal para editar usuario
  const openEditUserModal = (user: User) => {
    setEditUserForm({
      id: user.id,
      username: user.username,
      nombreCompleto: user.nombreCompleto,
      codigo: user.codigo,
      email: user.email || "",
      password: "",
      roleId: user.role?.id.toString() || "",
    });
    setIsEditUserModalOpen(true);
  };

  const handleEditUserChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditUserForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditUserSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const { id, username, nombreCompleto, codigo, email, password, roleId } = editUserForm;
    const payload: any = {
      username,
      nombreCompleto,
      codigo,
      email,
      roleId: parseInt(roleId, 10),
    };
    if (password.trim() !== "") {
      payload.password = password;
    }
    Swal.fire({
      title: "Procesando solicitud...",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
    try {
      const res = await fetch(`/api/v1/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      Swal.close();
      if (res.ok) {
        const result = await res.json();
        const updatedUser = result.data;
        setUsers((prevUsers) => prevUsers.map((u) => (u.id === id ? updatedUser : u)));
        setIsEditUserModalOpen(false);
        toastSuccess("Usuario actualizado");
      }else{
          const err = await res.json();
          await showErrorAlert(err, "No se pudo actualizar el usuario");
          return;
        }
      } catch(error) {
        console.log(error);
        showError("No se pudo actualizar el usuario");
      }
  };

  // Abrir modal para confirmar eliminación de usuario
  const openDeleteUserModal = (id: number) => {
    setUserToDelete(id);
    setIsDeleteUserModalOpen(true);
  };

  const handleDeleteUser = async () => {
    try {
      const res = await fetch(`/api/v1/users/${userToDelete}`, { method: "DELETE" });
      if (res.ok) {
        setUsers(users.filter((u) => u.id !== userToDelete));
        setIsDeleteUserModalOpen(false);
        toastSuccess("Usuario eliminado");
      } 
      else{
        const err = await res.json();
        Swal.close();
        return showErrorAlert(err || "No se pudo eliminar el usuario");
      }
    } catch(error) {
      console.log(error);
      Swal.close();
      showError("No se pudo eliminar el usuario");
    }
  };

  // Abrir modal para crear rol
  const openCreateRoleModal = () => {
    setNewRoleName("");
    setIsCreateRoleModalOpen(true);
  };

  const handleCreateRoleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    Swal.fire({
      title: "Procesando solicitud...",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
    try {
      const res = await fetch("/api/v1/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoleName }),
      });
      Swal.close();
      if (res.ok) {
        const result = await res.json();
        const createdRole = result.data;
        setRoles((prev) => [...prev, createdRole]);
        setIsCreateRoleModalOpen(false);
        toastSuccess("Rol registrado");
      } else {
        const err = await res.json();
        await showErrorAlert(err, "No se pudo registrar el rol");
        return;
      }
    } catch(error) {
      console.log(error);
      showError("No se pudo registrar el rol");
    }
  };

  // Abrir modal para editar rol
  const openEditRoleModal = (role: Role) => {
    setEditRoleForm({
      id: role.id,
      name: role.name,
    });
    setIsEditRoleModalOpen(true);
  };

  const handleEditRoleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEditRoleForm({ ...editRoleForm, name: e.target.value });
  };

  const handleEditRoleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const { id, name } = editRoleForm;
    Swal.fire({
      title: "Procesando solicitud...",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
    try {
      const res = await fetch(`/api/v1/roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      Swal.close();
      if (res.ok) {
        const result = await res.json();
        const updatedRole = result.data;
        setRoles((prevRoles) => prevRoles.map((r) => (r.id === id ? updatedRole : r)));
        setIsEditRoleModalOpen(false);
        toastSuccess("Rol actualizado");
      }else{
          const err = await res.json();
          await showErrorAlert(err, "No se pudo actualizar el rol");
          return;
        }
      } catch(error) {
        console.log(error);
        showError("No se pudo actualizar el rol");
      }
  };

  // Abrir modal para confirmar eliminación de rol
  const openDeleteRoleModal = (id: number) => {
    setRoleToDelete(id);
    setIsDeleteRoleModalOpen(true);
  };

  const handleDeleteRole = async () => {
    try {
      const res = await fetch(`/api/v1/roles/${roleToDelete}`, { method: "DELETE" });
      if (res.ok) {
        setRoles((prevRoles) => prevRoles.filter((r) => r.id !== roleToDelete));
        setIsDeleteRoleModalOpen(false);
        toastSuccess("Rol eliminado");
      } 
      else{
        const err = await res.json();
        Swal.close();
        return showErrorAlert(err || "No se pudo eliminar el rol");
      }
    } catch(error) {
      console.log(error);
      Swal.close();
      showError("No se pudo eliminar el rol");
    }
  };

  // Configuración columnas para usuarios
  const userColumns = [
    {
      key: "username",
      label: "Username",
      align: "left" as const,
      noWrap: true,
    },
    {
      key: "nombreCompleto",
      label: "Nombre Completo",
      align: "left" as const,
      noWrap: true,
    },
    {
      key: "codigo",
      label: "Código",
      align: "left" as const,
      noWrap: true,
    },
    {
      key: "email",
      label: "Email",
      align: "left" as const,
      noWrap: true,
    },
    {
      key: "role",
      label: "Rol",
      align: "center" as const,
      render: (_: any, row: User) => (
        <span
          className={`px-2 py-1 rounded-md text-sm font-medium ${getRoleBadgeClass(
            row.role?.name
          )}`}
        >
          {row.role?.name || "-"}
        </span>
      ),
    },
    {
      key: "activo",
      label: "Activo",
      align: "center" as const,
      type: "checkbox" as const,
      onCheckboxChange: (row: User, checked: boolean) => {
        handleToggleActivo(row);
      },
      noWrap: true,
    },
  ];

  // Acciones para usuarios
  const userActions = [
    {
      type: "edit" as const,
      onClick: openEditUserModal,
      title: "Editar usuario",
    },
    {
      type: "delete" as const,
      onClick: (row: User) => openDeleteUserModal(row.id),
      title: "Eliminar usuario",
    },
  ];

  // Configuración columnas para roles
  const roleColumns = [
    {
      key: "name",
      label: "Nombre",
      align: "left" as const,
      noWrap: true,
    },
  ];

  // Acciones para roles
  const roleActions = [
    {
      type: "edit" as const,
      onClick: openEditRoleModal,
      title: "Editar rol",
    },
    {
      type: "delete" as const,
      onClick: (row: Role) => openDeleteRoleModal(row.id),
      title: "Eliminar rol",
    },
  ];

  // Paginación local
  const [currentUserPage, setCurrentUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);

  const [currentRolePage, setCurrentRolePage] = useState(1);
  const [rolePageSize, setRolePageSize] = useState(10);

  // Función para paginar arrays
  const paginate = <T,>(items: T[], page: number, pageSize: number): T[] => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  };

  if (!allLoaded) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Encabezado principal */}
      <header className="bg-[#110885] text-white shadow-lg md:sticky md:top-0 z-50">
        <div className="mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <button
              onClick={() => (window.location.href = "/")}
              className="bg-white hover:bg-gray-200 text-blue-600 p-2 rounded-full mr-3 transition-all duration-300 transform hover:scale-105"
              title="Volver"
            >
              <FiArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold">Usuarios & Roles</h1>
          </div>
          <button
            onClick={refreshData}
            className="flex items-center bg-blue-900 hover:bg-blue-950 text-white px-4 py-2 rounded-full transition-all duration-300 transform hover:scale-105"
            title="Actualizar"
          >
            <FiRefreshCw className="mr-2 animate-spin-slow" size={20} />
            Actualizar
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="container mx-auto px-4 py-6">
        {/* TABS */}
        <nav className="flex space-x-6 mb-4 border-b">
              <button
                onClick={() => setActiveTab("users")}
                className={`flex items-center space-x-1 pb-1 border-b-2 transition-all duration-300 ${
                  activeTab === "users"
                    ? "text-blue-600 border-blue-600"
                    : "text-gray-500 border-transparent hover:text-blue-600 hover:border-blue-600"
                }`}
              >
                <FiUsers size={18} />
                <span>Usuarios</span>
              </button>
              <button
                onClick={() => setActiveTab("roles")}
                className={`flex items-center space-x-1 pb-1 border-b-2 transition-all duration-300 ${
                  activeTab === "roles"
                    ? "text-blue-600 border-blue-600"
                    : "text-gray-500 border-transparent hover:text-blue-600 hover:border-blue-600"
                }`}
              >
                <FiTag size={18} />
                <span>Roles</span>
              </button>
            </nav>

            {/* USERS SECTION */}
            {activeTab === "users" && (
            <section className="bg-white p-4 rounded-lg shadow space-y-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <h2 className="text-lg font-semibold">Usuarios</h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Buscar usuarios..."
                  value={userSearchQuery}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value);
                    setCurrentUserPage(1);
                  }}
                  className="w-full sm:max-w-xs border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  onClick={openCreateUserModal}
                  className="w-full sm:w-auto flex items-center justify-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-md transition"
                >
                  <FaPlus className="mr-2" />
                  Agregar
                </button>
              </div>
              </div>
              <DataTable<User>
                  data={paginate(filteredUsers, currentUserPage, userPageSize)}
                  columns={userColumns as any}
                  actions={userActions}
                  loading={loadingUsers}
                  currentPage={currentUserPage}
                  totalPages={Math.ceil(filteredUsers.length / userPageSize)}
                  totalCount={filteredUsers.length}
                  pageSize={userPageSize}
                  onPageChange={setCurrentUserPage}
                  onPageSizeChange={(size) => {
                  setUserPageSize(size);
                  setCurrentUserPage(1);
                  }}
                  pageSizeOptions={[10, 25, 50, 100, 200]}
                  emptyMessage="No hay registros"
                  tableId="usuarios-table"
                  tableClassName="min-w-full border text-sm bg-white rounded-lg shadow"
                  headerClassName="bg-gray-200"
                  showPagination={true}
                />
              </section>
            )}

                    {/* ROLES SECTION */}
            { activeTab === "roles" && (
            <section className="bg-white p-4 rounded-lg shadow space-y-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <h2 className="text-lg font-semibold">Roles</h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <input
                    type="text"
                    placeholder="Buscar roles..."
                    value={roleSearchQuery}
                    onChange={(e) => {
                      setRoleSearchQuery(e.target.value);
                      setCurrentRolePage(1);
                    }}
                    className="w-full sm:max-w-xs border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    onClick={openCreateRoleModal}
                    className="w-full sm:w-auto flex items-center justify-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-md transition"
                  >
                    <FaPlus className="mr-2" />
                    Agregar
                  </button>
                </div>
              </div>

            <DataTable<Role>
              data={paginate(filteredRoles, currentRolePage, rolePageSize)}
              columns={roleColumns as any}
              actions={roleActions}
              loading={loadingRoles}
              currentPage={currentRolePage}
              totalPages={Math.ceil(filteredRoles.length / rolePageSize)}
              totalCount={filteredRoles.length}
              pageSize={rolePageSize}
              onPageChange={setCurrentRolePage}
              onPageSizeChange={(size) => {
              setRolePageSize(size);
              setCurrentRolePage(1);
              }}
              pageSizeOptions={[10, 25, 50, 100, 200]}
              emptyMessage="No hay registros"
              tableId="roles-table"
              tableClassName="min-w-full border text-sm bg-white rounded-lg shadow"
              headerClassName="bg-gray-200"
              showPagination={true}
            />
          </section>
        )}
      </div>

      {/* Modal: Crear Usuario */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50 px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg">
            <div className="px-4 py-2 border-b">
              <h3 className="text-lg font-semibold">Crear Usuario</h3>
            </div>
            <div className="p-4">
              <form onSubmit={handleCreateUserSubmit}>
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    className="border p-2 rounded"
                    value={createUserForm.username}
                    onChange={handleCreateUserChange}
                    required
                  />
                  <input
                    type="text"
                    name="nombreCompleto"
                    placeholder="Nombre Completo"
                    className="border p-2 rounded"
                    value={createUserForm.nombreCompleto}
                    onChange={handleCreateUserChange}
                    required
                  />
                  <input
                    type="text"
                    name="codigo"
                    placeholder="Código Empleado"
                    className="border p-2 rounded"
                    value={createUserForm.codigo}
                    onChange={handleCreateUserChange}
                    required
                  />
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    className="border p-2 rounded"
                    value={createUserForm.email}
                    onChange={handleCreateUserChange}
                    required
                  />
                  <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    className="border p-2 rounded"
                    value={createUserForm.password}
                    onChange={handleCreateUserChange}
                    required
                  />
                  <select
                    name="roleId"
                    className="border p-2 rounded"
                    value={createUserForm.roleId}
                    onChange={handleCreateUserChange}
                    required
                  >
                    <option value="">Seleccione un rol</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreateUserModalOpen(false)}
                    className="px-4 py-2 bg-gray-500 text-white rounded"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">
                    Crear
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Usuario */}
      {isEditUserModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50 px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg">
            <div className="px-4 py-2 border-b">
              <h3 className="text-lg font-semibold">Editar Usuario</h3>
            </div>
            <div className="p-4">
              <form onSubmit={handleEditUserSubmit}>
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    className="border p-2 rounded"
                    value={editUserForm.username}
                    onChange={handleEditUserChange}
                    required
                  />
                  <input
                    type="text"
                    name="nombreCompleto"
                    placeholder="Nombre Completo"
                    className="border p-2 rounded"
                    value={editUserForm.nombreCompleto}
                    onChange={handleEditUserChange}
                    required
                  />
                  <input
                    type="text"
                    name="codigo"
                    placeholder="Código Empleado"
                    className="border p-2 rounded"
                    value={editUserForm.codigo}
                    onChange={handleEditUserChange}
                    required
                  />
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    className="border p-2 rounded"
                    value={editUserForm.email}
                    onChange={handleEditUserChange}
                    required
                  />
                  <input
                    type="password"
                    name="password"
                    placeholder="Password (opcional)"
                    className="border p-2 rounded"
                    value={editUserForm.password}
                    onChange={handleEditUserChange}
                  />
                  <select
                    name="roleId"
                    className="border p-2 rounded"
                    value={editUserForm.roleId}
                    onChange={handleEditUserChange}
                    required
                  >
                    <option value="">Seleccione un rol</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditUserModalOpen(false)}
                    className="px-4 py-2 bg-gray-500 text-white rounded"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">
                    Actualizar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación de Usuario */}
      {isDeleteUserModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50 px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-4 py-2 border-b">
              <h3 className="text-lg font-semibold">Confirmar Eliminación</h3>
            </div>
            <div className="p-4">
              <p>¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede revertir.</p>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsDeleteUserModalOpen(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  className="px-4 py-2 bg-red-600 text-white rounded"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear Rol */}
      {isCreateRoleModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50 px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-4 py-2 border-b">
              <h3 className="text-lg font-semibold">Crear Rol</h3>
            </div>
            <div className="p-4">
              <form onSubmit={handleCreateRoleSubmit}>
                <input
                  type="text"
                  placeholder="Nombre del rol"
                  className="border p-2 rounded w-full"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  required
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreateRoleModalOpen(false)}
                    className="px-4 py-2 bg-gray-500 text-white rounded"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">
                    Crear
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Rol */}
      {isEditRoleModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50 px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-4 py-2 border-b">
              <h3 className="text-lg font-semibold">Editar Rol</h3>
            </div>
            <div className="p-4">
              <form onSubmit={handleEditRoleSubmit}>
                <input
                  type="text"
                  placeholder="Nuevo nombre para el rol"
                  className="border p-2 rounded w-full"
                  value={editRoleForm.name}
                  onChange={handleEditRoleChange}
                  required
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditRoleModalOpen(false)}
                    className="px-4 py-2 bg-gray-500 text-white rounded"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">
                    Actualizar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación de Rol */}
      {isDeleteRoleModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50 px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-4 py-2 border-b">
              <h3 className="text-lg font-semibold">Confirmar Eliminación</h3>
            </div>
            <div className="p-4">
              <p>¿Estás seguro de que deseas eliminar este rol? Esta acción no se puede revertir.</p>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsDeleteRoleModalOpen(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRole}
                  className="px-4 py-2 bg-red-600 text-white rounded"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estilos para animaciones y switch */}
      <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 2s linear infinite;
        }
      `}</style>
    </div>
  );
}