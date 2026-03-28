'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useCategorias } from '../../lib/useCategorias'
import Image from 'next/image'

export default function Admin() {
  const [usuario, setUsuario] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [form, setForm] = useState({ nombre: '', email: '', password: '', departamento: '', fecha_ingreso: '', rol: 'empleado' })
  const [editando, setEditando] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('calendario')
  const [semanaOffset, setSemanaOffset] = useState(0)
  const [filtroDept, setFiltroDept] = useState('Todos')
  const [filtroMotivo, setFiltroMotivo] = useState('todos')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [modoFiltro, setModoFiltro] = useState(false)
  const { categorias } = useCategorias()
  const router = useRouter()

  const getDiasSemana = (offset = 0) => {
    const hoy = new Date()
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - hoy.getDay() + 1 + offset * 7)
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(lunes)
      d.setDate(lunes.getDate() + i)
      return d
    })
  }

  const dias = getDiasSemana(semanaOffset)
  const fechaInicio = modoFiltro && filtroDesde ? filtroDesde : dias[0].toISOString().split('T')[0]
  const fechaFin = modoFiltro && filtroHasta ? filtroHasta : dias[4].toISOString().split('T')[0]
  const formatFecha = (d) => d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
  const getCat = (nombre) => categorias.find(c => c.nombre === nombre) || { emoji: '📝', color: 'bg-gray-100 text-gray-600' }

  const diasMostrar = modoFiltro && filtroDesde && filtroHasta
    ? (() => {
        const result = []
        const current = new Date(filtroDesde)
        const end = new Date(filtroHasta)
        while (current <= end) {
          if (current.getDay() !== 0 && current.getDay() !== 6) result.push(new Date(current))
          current.setDate(current.getDate() + 1)
        }
        return result
      })()
    : dias

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data } = await supabase.from('usuarios').select('rol, nombre').eq('id', user.id).single()
      if (data?.rol !== 'admin') { router.push('/'); return }
      setUsuario(data)
      cargarUsuarios()
      cargarDepartamentos()
    }
    init()
  }, [])

  useEffect(() => {
    if (usuarios.length === 0) return
    const ids = usuarios
      .filter(u => u.rol === 'empleado' || u.rol === 'supervisor')
      .map(u => u.id)
    let query = supabase.from('ausencias').select('*').in('empleado_id', ids).gte('fecha', fechaInicio).lte('fecha', fechaFin)
    if (filtroMotivo !== 'todos') query = query.eq('motivo', filtroMotivo)
    query.then(({ data }) => setAusencias(data || []))
  }, [usuarios, semanaOffset, filtroMotivo, filtroDesde, filtroHasta, modoFiltro])

  const cargarUsuarios = async () => {
    const { data } = await supabase.from('usuarios').select('*').order('nombre')
    setUsuarios(data || [])
  }

  const cargarDepartamentos = async () => {
    const { data } = await supabase.from('departamentos').select('*').order('nombre')
    setDepartamentos(data || [])
  }

  const tieneAusencia = (empleadoId, fecha) => {
    const fechaStr = fecha.toISOString().split('T')[0]
    return ausencias.find(a => a.empleado_id === empleadoId && a.fecha === fechaStr)
  }

  const empleadosFiltrados = usuarios.filter(u =>
    (u.rol === 'empleado' || u.rol === 'supervisor') &&
    (filtroDept === 'Todos' || u.departamento === filtroDept)
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMensaje('')
    setError('')
    const dept = departamentos.find(d => d.nombre === form.departamento)
    const supervisor_id = dept?.supervisor_id || null

    if (editando) {
      const { error } = await supabase.from('usuarios').update({
        nombre: form.nombre, rol: form.rol, departamento: form.departamento,
        fecha_ingreso: form.fecha_ingreso || null, supervisor_id
      }).eq('id', editando)
      if (error) { setError('Error al actualizar.') }
      else { setMensaje('Usuario actualizado.'); setEditando(null); resetForm() }
    } else {
      const res = await fetch('/api/crear-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email, password: form.password, nombre: form.nombre,
          rol: form.rol, departamento: form.departamento,
          fecha_ingreso: form.fecha_ingreso, supervisor_id
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
    setForm({ nombre: u.nombre || '', email: u.email || '', password: '', departamento: u.departamento || '', fecha_ingreso: u.fecha_ingreso || '', rol: u.rol || 'empleado' })
    setTab('usuarios')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEliminar = async (id) => {
    if (!confirm('Seguro que queres eliminar este usuario?')) return
    await supabase.from('usuarios').delete().eq('id', id)
    cargarUsuarios()
  }

  const handleEditarDept = async (id, campo, valor) => {
    await supabase.from('departamentos').update({ [campo]: valor }).eq('id', id)
    cargarDepartamentos()
  }

  const resetForm = () => setForm({ nombre: '', email: '', password: '', departamento: '', fecha_ingreso: '', rol: 'empleado' })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const supervisores = usuarios.filter(u => u.rol === 'supervisor')
  const rolColor = { admin: 'bg-red-100 text-red-700', supervisor: 'bg-purple-100 text-purple-700', empleado: 'bg-blue-100 text-blue-700' }
  const deptos = ['Todos', ...departamentos.map(d => d.nombre)]

  if (!usuario) return <main className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-gray-500">Cargando...</p></main>

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Panel Admin</h1>
            <p className="text-gray-500 text-sm">Hola, {usuario.nombre}</p>
          </div>
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Furlong" width={120} height={40} className="object-contain" />
            {['calendario','usuarios','departamentos','categorias','ausencias'].map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                {t === 'calendario' ? '📅 Calendario' : t === 'usuarios' ? '👥 Usuarios' : t === 'departamentos' ? '🏢 Departamentos' : t === 'categorias' ? '🏷️ Categorias' : '📊 Reportes'}
              </button>
            ))}
            <button onClick={handleLogout} className="text-sm text-red-500 hover:underline ml-2">Salir</button>
          </div>
        </div>

        {/* CALENDARIO */}
        {tab === 'calendario' && (
          <>
            <div className="bg-white rounded-xl shadow px-6 py-4 mb-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Departamento</label>
                  <select value={filtroDept} onChange={e => setFiltroDept(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {deptos.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de ausencia</label>
                  <select value={filtroMotivo} onChange={e => setFiltroMotivo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="todos">Todos</option>
                    {categorias.map(c => <option key={c.id} value={c.nombre}>{c.emoji} {c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <button onClick={() => { setModoFiltro(!modoFiltro); setFiltroDesde(''); setFiltroHasta('') }} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${modoFiltro ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    Filtrar por fecha
                  </button>
                </div>
                {modoFiltro && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                      <input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                      <input type="date" value={filtroHasta} min={filtroDesde} onChange={e => setFiltroHasta(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </>
                )}
              </div>
            </div>

            {!modoFiltro && (
              <div className="flex items-center justify-between bg-white rounded-xl shadow px-6 py-3 mb-4">
                <button onClick={() => setSemanaOffset(s => s - 1)} className="text-blue-600 hover:underline font-medium">Semana anterior</button>
                <p className="text-gray-700 font-medium">{formatFecha(dias[0])} - {formatFecha(dias[4])}</p>
                <button onClick={() => setSemanaOffset(s => s + 1)} className="text-blue-600 hover:underline font-medium">Semana siguiente</button>
              </div>
            )}

            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Empleado</th>
                    {diasMostrar.map((d, i) => <th key={i} className="px-4 py-3 text-gray-600 font-semibold text-center">{formatFecha(d)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {empleadosFiltrados.filter(emp => diasMostrar.some(d => tieneAusencia(emp.id, d))).length === 0 ? (
                    <tr><td colSpan={diasMostrar.length + 1} className="text-center text-gray-400 py-8">No hay ausencias en este periodo.</td></tr>
                  ) : (
                    empleadosFiltrados.filter(emp => diasMostrar.some(d => tieneAusencia(emp.id, d))).map(emp => (
                      <tr key={emp.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-700">{emp.nombre}</p>
                          {emp.rol === 'supervisor' && <span className="text-xs text-purple-500">Supervisor</span>}
                          {diasMostrar.map(d => tieneAusencia(emp.id, d)).find(a => a?.fecha_carga) && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Cargado: {new Date(diasMostrar.map(d => tieneAusencia(emp.id, d)).find(a => a?.fecha_carga)?.fecha_carga).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </td>
                        {diasMostrar.map((d, i) => {
                          const ausencia = tieneAusencia(emp.id, d)
                          const cat = ausencia ? getCat(ausencia.motivo) : null
                          return (
                            <td key={i} className="px-4 py-3 text-center">
                              {ausencia ? (
                                <span className={cat.color + ' inline-block px-2 py-1 rounded-full text-xs font-medium'}>
                                  {cat.emoji} {ausencia.motivo}
                                </span>
                              ) : (
                                <span className="text-gray-200 text-xs">—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* USUARIOS */}
        {tab === 'usuarios' && (
          <>
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
                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${rolColor[u.rol]}`}>{u.rol}</span></td>
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

        {/* DEPARTAMENTOS */}
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
                      <select value={d.supervisor_id || ''} onChange={e => handleEditarDept(d.id, 'supervisor_id', e.target.value || null)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
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

        {/* CATEGORIAS */}
        {tab === 'categorias' && (
          <iframe src="/categorias" className="w-full h-screen rounded-xl shadow border-0" />
        )}

        {/* AUSENCIAS / REPORTES */}
        {tab === 'ausencias' && (
          <iframe src="/reportes" className="w-full h-screen rounded-xl shadow border-0" />
        )}

      </div>
    </main>
  )
}