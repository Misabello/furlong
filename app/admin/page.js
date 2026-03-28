'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Admin() {
  const [usuarios, setUsuarios] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    departamento: '',
    fecha_ingreso: '',
    rol: 'empleado'
  })
  const [editando, setEditando] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('usuarios')
  const router = useRouter()

  useEffect(() => {
    verificarAcceso()
    cargarUsuarios()
    cargarDepartamentos()
  }, [])

  const verificarAcceso = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
    if (data?.rol !== 'admin') router.push('/')
  }

  const cargarUsuarios = async () => {
    const { data } = await supabase.from('usuarios').select('*').order('nombre')
    setUsuarios(data || [])
  }

  const cargarDepartamentos = async () => {
    const { data } = await supabase.from('departamentos').select('*').order('nombre')
    setDepartamentos(data || [])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMensaje('')
    setError('')

    const dept = departamentos.find(d => d.nombre === form.departamento)
    const supervisor_id = dept?.supervisor_id || null

    if (editando) {
      const { error } = await supabase.from('usuarios').update({
        nombre: form.nombre,
        rol: form.rol,
        departamento: form.departamento,
        fecha_ingreso: form.fecha_ingreso || null,
        supervisor_id
      }).eq('id', editando)

      if (error) { setError('Error al actualizar.') }
      else { setMensaje('Usuario actualizado.'); setEditando(null); resetForm() }
    } else {
        const res = await fetch('/api/crear-usuario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: form.email,
              password: form.password,
              nombre: form.nombre,
              rol: form.rol,
              departamento: form.departamento,
              fecha_ingreso: form.fecha_ingreso,
              supervisor_id
            })
          })
          
          const result = await res.json()
          if (!result.ok) { setError('Error: ' + result.error); setLoading(false); return }
          
          setMensaje('Usuario creado correctamente.')
          resetForm()
    }

    cargarUsuarios()
    setLoading(false)
  }

  const handleEditarDept = async (id, campo, valor) => {
    await supabase.from('departamentos').update({ [campo]: valor }).eq('id', id)
    cargarDepartamentos()
  }

  const handleEditar = (u) => {
    setEditando(u.id)
    setForm({
      nombre: u.nombre || '',
      email: u.email || '',
      password: '',
      departamento: u.departamento || '',
      fecha_ingreso: u.fecha_ingreso || '',
      rol: u.rol || 'empleado'
    })
    setTab('usuarios')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEliminar = async (id) => {
    if (!confirm('Seguro que queres eliminar este usuario?')) return
    await supabase.from('usuarios').delete().eq('id', id)
    cargarUsuarios()
  }

  const resetForm = () => setForm({
    nombre: '', email: '', password: '', departamento: '', fecha_ingreso: '', rol: 'empleado'
  })

  const supervisores = usuarios.filter(u => u.rol === 'supervisor')

  const rolColor = {
    admin: 'bg-red-100 text-red-700',
    supervisor: 'bg-purple-100 text-purple-700',
    empleado: 'bg-blue-100 text-blue-700'
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Panel Administrador</h1>
            <p className="text-gray-500 text-sm">Gestion completa del sistema</p>
          </div>
          <button onClick={handleLogout} className="text-sm text-red-500 hover:underline">Cerrar sesion</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('usuarios')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'usuarios' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            Usuarios
          </button>
          <button onClick={() => setTab('departamentos')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'departamentos' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            Departamentos
          </button>
        </div>

        {tab === 'usuarios' && (
          <>
            {/* Formulario usuario */}
            <div className="bg-white rounded-xl shadow p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">{editando ? 'Editar usuario' : 'Nuevo usuario'}</h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                  <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Juan Perez" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} disabled={!!editando} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" required={!editando} />
                </div>
                {!editando && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contrasena</label>
                    <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min. 6 caracteres" required={!editando} />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                  <select value={form.departamento} onChange={e => setForm({...form, departamento: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Sin departamento</option>
                    {departamentos.map(d => <option key={d.id} value={d.nombre}>{d.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de ingreso</label>
                  <input type="date" value={form.fecha_ingreso} onChange={e => setForm({...form, fecha_ingreso: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                  <select value={form.rol} onChange={e => setForm({...form, rol: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="empleado">Empleado</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {mensaje && <p className="text-green-600 text-sm md:col-span-2">{mensaje}</p>}
                {error && <p className="text-red-500 text-sm md:col-span-2">{error}</p>}

                <div className="md:col-span-2 flex gap-3 justify-end">
                  {editando && <button type="button" onClick={() => { setEditando(null); resetForm() }} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancelar</button>}
                  <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-medium">
                    {loading ? 'Guardando...' : editando ? 'Actualizar' : 'Crear usuario'}
                  </button>
                </div>
              </form>
            </div>

            {/* Tabla usuarios */}
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Nombre</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Email</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Departamento</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Ingreso</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Rol</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-gray-400 py-8">No hay usuarios.</td></tr>
                  ) : (
                    usuarios.map(u => (
                      <tr key={u.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-700">{u.nombre}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                        <td className="px-4 py-3 text-gray-500">{u.departamento || '-'}</td>
                        <td className="px-4 py-3 text-gray-500">{u.fecha_ingreso ? new Date(u.fecha_ingreso).toLocaleDateString('es-AR') : '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${rolColor[u.rol]}`}>{u.rol}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => handleEditar(u)} className="text-blue-600 hover:underline text-xs">Editar</button>
                            <button onClick={() => handleEliminar(u.id)} className="text-red-500 hover:underline text-xs">Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'departamentos' && (
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">Departamento</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">Supervisor asignado</th>
                </tr>
              </thead>
              <tbody>
                {departamentos.map(d => (
                  <tr key={d.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">{d.nombre}</td>
                    <td className="px-4 py-3">
                      <select
                        value={d.supervisor_id || ''}
                        onChange={e => handleEditarDept(d.id, 'supervisor_id', e.target.value || null)}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Sin supervisor</option>
                        {supervisores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}