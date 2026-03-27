'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const DEPARTAMENTOS = [
  'MKT & PROD',
  'BOOKING',
  'CRUCEROS',
  'USHUAIA',
  'TRAFICO',
  'MICE',
  'ADM',
  'SISTEMAS'
]

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'empleado',
    departamento: 'MKT & PROD',
    fecha_ingreso: '',
    supervisor_id: ''
  })
  const [supervisores, setSupervisores] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [editando, setEditando] = useState(null)
  const router = useRouter()

  useEffect(() => {
    verificarAcceso()
    cargarUsuarios()
    cargarSupervisores()
  }, [])

  const verificarAcceso = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
    if (data?.rol !== 'supervisor') router.push('/empleado')
  }

  const cargarUsuarios = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('*, supervisor:supervisor_id(nombre)')
      .order('nombre')
    setUsuarios(data || [])
  }

  const cargarSupervisores = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .eq('rol', 'supervisor')
    setSupervisores(data || [])
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMensaje('')
    setError('')

    if (editando) {
      // Editar usuario existente
      const { error } = await supabase
        .from('usuarios')
        .update({
          nombre: form.nombre,
          rol: form.rol,
          departamento: form.departamento,
          fecha_ingreso: form.fecha_ingreso || null,
          supervisor_id: form.supervisor_id || null
        })
        .eq('id', editando)

      if (error) {
        setError('Error al actualizar el usuario.')
      } else {
        setMensaje('✅ Usuario actualizado correctamente.')
        setEditando(null)
        resetForm()
        cargarUsuarios()
      }
    } else {
      // Crear usuario nuevo en Auth
      const { data, error: authError } = await supabase.auth.admin.createUser({
        email: form.email,
        password: form.password,
        user_metadata: {
          nombre: form.nombre,
          rol: form.rol
        }
      })

      if (authError) {
        // Fallback: crear solo en tabla usuarios
        const { error: dbError } = await supabase.from('usuarios').insert({
          nombre: form.nombre,
          email: form.email,
          password: '',
          rol: form.rol,
          departamento: form.departamento,
          fecha_ingreso: form.fecha_ingreso || null,
          supervisor_id: form.supervisor_id || null
        })
        if (dbError) {
          setError('Error al crear el usuario: ' + dbError.message)
          setLoading(false)
          return
        }
      } else {
        // Actualizar campos extra en tabla usuarios
        await supabase
          .from('usuarios')
          .update({
            departamento: form.departamento,
            fecha_ingreso: form.fecha_ingreso || null,
            supervisor_id: form.supervisor_id || null
          })
          .eq('id', data.user.id)
      }

      setMensaje('✅ Usuario creado correctamente.')
      resetForm()
      cargarUsuarios()
      cargarSupervisores()
    }
    setLoading(false)
  }

  const handleEditar = (u) => {
    setEditando(u.id)
    setForm({
      nombre: u.nombre,
      email: u.email,
      password: '',
      rol: u.rol,
      departamento: u.departamento || 'MKT & PROD',
      fecha_ingreso: u.fecha_ingreso || '',
      supervisor_id: u.supervisor_id || ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEliminar = async (id) => {
    if (!confirm('¿Seguro que querés eliminar este usuario?')) return
    await supabase.from('usuarios').delete().eq('id', id)
    cargarUsuarios()
  }

  const resetForm = () => {
    setForm({
      nombre: '',
      email: '',
      password: '',
      rol: 'empleado',
      departamento: 'MKT & PROD',
      fecha_ingreso: '',
      supervisor_id: ''
    })
  }

  const rolBadge = {
    supervisor: 'bg-purple-100 text-purple-700',
    empleado: 'bg-blue-100 text-blue-700'
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ABM de Usuarios</h1>
            <p className="text-gray-500 text-sm">Alta, baja y modificación de usuarios</p>
          </div>
          <button
            onClick={() => router.push('/supervisor')}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Volver al panel
          </button>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            {editando ? '✏️ Editar usuario' : '➕ Nuevo usuario'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Juan Pérez"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                disabled={!!editando}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                placeholder="juan@furlong.com"
                required={!editando}
              />
            </div>
            {!editando && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  required={!editando}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select
                name="rol"
                value={form.rol}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="empleado">Empleado</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
              <select
                name="departamento"
                value={form.departamento}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DEPARTAMENTOS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de ingreso</label>
              <input
                name="fecha_ingreso"
                type="date"
                value={form.fecha_ingreso}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor asignado</label>
              <select
                name="supervisor_id"
                value={form.supervisor_id}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin supervisor</option>
                {supervisores.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 flex gap-3">
              {mensaje && <p className="text-green-600 text-sm self-center">{mensaje}</p>}
              {error && <p className="text-red-500 text-sm self-center">{error}</p>}
              <div className="ml-auto flex gap-3">
                {editando && (
                  <button
                    type="button"
                    onClick={() => { setEditando(null); resetForm() }}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  {loading ? 'Guardando...' : editando ? 'Actualizar' : 'Crear usuario'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Lista de usuarios */}
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Nombre</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Email</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Departamento</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Ingreso</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Rol</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Supervisor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-8">No hay usuarios todavía.</td>
                </tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">{u.nombre}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3 text-gray-500">{u.departamento || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {u.fecha_ingreso ? new Date(u.fecha_ingreso).toLocaleDateString('es-AR') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${rolBadge[u.rol]}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.supervisor?.nombre || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditar(u)}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleEliminar(u.id)}
                          className="text-red-500 hover:underline text-xs"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}