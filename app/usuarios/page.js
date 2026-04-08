'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    departamento: '',
    fecha_ingreso: '',
    es_supervisor: false,
    vacaciones_saldo_anterior: '',
    francos_saldo_anterior: ''
  })
  const [editando, setEditando] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
    if (data?.rol !== 'supervisor') router.push('/empleado')
  }

  const cargarUsuarios = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('*, dept:departamento(nombre)')
      .order('nombre')
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

    const rol = form.es_supervisor ? 'supervisor' : 'empleado'

    // Buscar supervisor del departamento seleccionado
    const dept = departamentos.find(d => d.nombre === form.departamento)
    const supervisor_id = dept?.supervisor_id || null

    if (editando) {
      const { error } = await supabase
        .from('usuarios')
        .update({
          nombre: form.nombre,
          rol,
          departamento: form.departamento,
          fecha_ingreso: form.fecha_ingreso || null,
          supervisor_id,
          vacaciones_saldo_anterior: form.vacaciones_saldo_anterior !== '' ? Number(form.vacaciones_saldo_anterior) : null,
          francos_saldo_anterior: form.francos_saldo_anterior !== '' ? Number(form.francos_saldo_anterior) : null
        })
        .eq('id', editando)

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
          rol: form.es_supervisor ? 'supervisor' : 'empleado',
          departamento: form.departamento,
          fecha_ingreso: form.fecha_ingreso,
          supervisor_id,
          vacaciones_saldo_anterior: form.vacaciones_saldo_anterior !== '' ? Number(form.vacaciones_saldo_anterior) : null,
          francos_saldo_anterior: form.francos_saldo_anterior !== '' ? Number(form.francos_saldo_anterior) : null
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

  const handleEditar = (u) => {
    setEditando(u.id)
    setForm({
      nombre: u.nombre || '',
      email: u.email || '',
      password: '',
      departamento: u.departamento || '',
      fecha_ingreso: u.fecha_ingreso || '',
      es_supervisor: u.rol === 'supervisor',
      vacaciones_saldo_anterior: u.vacaciones_saldo_anterior ?? '',
      francos_saldo_anterior: u.francos_saldo_anterior ?? ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEliminar = async (id) => {
    if (!confirm('Seguro que queres eliminar este usuario?')) return
    await supabase.from('usuarios').delete().eq('id', id)
    cargarUsuarios()
  }

  const resetForm = () => setForm({
    nombre: '',
    email: '',
    password: '',
    departamento: '',
    fecha_ingreso: '',
    es_supervisor: false,
    vacaciones_saldo_anterior: '',
    francos_saldo_anterior: ''
  })

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ABM de Usuarios</h1>
            <p className="text-gray-500 text-sm">Alta, baja y modificacion de usuarios</p>
          </div>
          <button onClick={() => router.push('/supervisor')} className="text-sm text-blue-600 hover:underline">Volver al panel</button>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">{editando ? 'Editar usuario' : 'Nuevo usuario'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
              <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Juan Perez" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} disabled={!!editando} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" placeholder="juan@furlong.com" required={!editando} />
            </div>
            {!editando && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contrasena</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min. 6 caracteres" required={!editando} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
              <select value={form.departamento} onChange={e => setForm({...form, departamento: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                <option value="">Seleccionar departamento</option>
                {departamentos.map(d => <option key={d.id} value={d.nombre}>{d.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de ingreso</label>
              <input type="date" value={form.fecha_ingreso} onChange={e => setForm({...form, fecha_ingreso: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vac. adeudadas pre-sistema <span className="text-gray-400 font-normal text-xs">(dias no tomados antes de usar la app)</span></label>
              <input type="number" min="0" step="0.5" value={form.vacaciones_saldo_anterior} onChange={e => setForm({...form, vacaciones_saldo_anterior: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Francos adeudados pre-sistema <span className="text-gray-400 font-normal text-xs">(francos a favor acumulados antes de usar la app)</span></label>
              <input type="number" min="0" step="0.5" value={form.francos_saldo_anterior} onChange={e => setForm({...form, francos_saldo_anterior: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
            </div>
            <div className="flex items-center gap-3 mt-2">
              <input type="checkbox" id="es_supervisor" checked={form.es_supervisor} onChange={e => setForm({...form, es_supervisor: e.target.checked})} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
              <label htmlFor="es_supervisor" className="text-sm font-medium text-gray-700 cursor-pointer">Es supervisor</label>
            </div>

            {mensaje && <p className="text-green-600 text-sm md:col-span-2">{mensaje}</p>}
            {error && <p className="text-red-500 text-sm md:col-span-2">{error}</p>}

            <div className="md:col-span-2 flex gap-3 justify-end">
              {editando && (
                <button type="button" onClick={() => { setEditando(null); resetForm() }} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancelar</button>
              )}
              <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-medium">
                {loading ? 'Guardando...' : editando ? 'Actualizar' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </div>

        {/* Tabla */}
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
                <tr><td colSpan={6} className="text-center text-gray-400 py-8">No hay usuarios todavia.</td></tr>
              ) : (
                usuarios.map(u => (
                  <tr key={u.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">{u.nombre}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                    <td className="px-4 py-3 text-gray-500">{u.departamento || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{u.fecha_ingreso ? new Date(u.fecha_ingreso).toLocaleDateString('es-AR') : '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.rol === 'supervisor' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {u.rol === 'supervisor' ? 'Supervisor' : 'Empleado'}
                      </span>
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
      </div>
    </main>
  )
}