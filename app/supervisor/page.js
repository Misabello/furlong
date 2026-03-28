'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useCategorias } from '../../lib/useCategorias'
import Image from 'next/image'

export default function Supervisor() {
  const [usuario, setUsuario] = useState(null)
  const [empleados, setEmpleados] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [semanaOffset, setSemanaOffset] = useState(0)
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
      const { data: sup } = await supabase.from('usuarios').select('*').eq('id', user.id).single()
      if (sup?.rol !== 'supervisor') { router.push('/empleado'); return }
      setUsuario(sup)
      const { data: dept } = await supabase.from('departamentos').select('nombre').eq('supervisor_id', user.id).single()
      const { data: empList } = await supabase.from('usuarios').select('*').eq('departamento', dept?.nombre)
      setEmpleados(empList || [])
    }
    init()
  }, [])

  useEffect(() => {
    if (empleados.length === 0) return
    const cargarAusencias = async () => {
      const ids = empleados.map(e => e.id)
      let query = supabase.from('ausencias').select('*').in('empleado_id', ids).gte('fecha', fechaInicio).lte('fecha', fechaFin)
      if (filtroMotivo !== 'todos') query = query.eq('motivo', filtroMotivo)
      const { data } = await query
      setAusencias(data || [])
    }
    cargarAusencias()
  }, [empleados, semanaOffset, filtroMotivo, filtroDesde, filtroHasta, modoFiltro])

  const tieneAusencia = (empleadoId, fecha) => {
    const fechaStr = fecha.toISOString().split('T')[0]
    return ausencias.find(a => a.empleado_id === empleadoId && a.fecha === fechaStr)
  }

  const getCat = (nombre) => categorias.find(c => c.nombre === nombre) || { emoji: '📝', color: 'bg-gray-100 text-gray-600' }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const formatFecha = (d) => d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
  const formatFechaCarga = (f) => f ? new Date(f).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

  if (!usuario) return <main className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-gray-500">Cargando...</p></main>

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Panel Supervisor</h1>
            <p className="text-gray-500 text-sm">Hola, {usuario?.nombre}</p>
          </div>
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="Furlong" width={120} height={40} className="object-contain" />
            <a href="https://gamma.app/docs/Control-de-Asistencias-t9mqs084uhleedz" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-blue-600">❓ Ayuda</a>
            <button onClick={() => router.push('/perfil')} className="text-sm text-blue-600 hover:underline">Mi perfil</button>
            <button onClick={() => router.push('/reportes')} className="text-sm text-blue-600 hover:underline">Reportes</button>
            <button onClick={() => router.push('/usuarios')} className="text-sm text-blue-600 hover:underline">Usuarios</button>
            <button onClick={handleLogout} className="text-sm text-red-500 hover:underline">Cerrar sesion</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow px-6 py-4 mb-4 flex items-center gap-3">
          <span className="text-sm text-gray-500">Departamento:</span>
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-600 text-white">
            {empleados[0]?.departamento || 'Sin departamento'}
          </span>
        </div>

        <div className="bg-white rounded-xl shadow px-6 py-4 mb-4">
          <div className="flex flex-wrap gap-4 items-end">
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
              {empleados.filter(emp => diasMostrar.some(d => tieneAusencia(emp.id, d))).length === 0 ? (
                <tr><td colSpan={diasMostrar.length + 1} className="text-center text-gray-400 py-8">No hay ausencias en este periodo.</td></tr>
              ) : (
                empleados.filter(emp => diasMostrar.some(d => tieneAusencia(emp.id, d))).map(emp => (
                  <tr key={emp.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-700">{emp.nombre}</p>
                      {diasMostrar.map(d => tieneAusencia(emp.id, d)).find(a => a?.fecha_carga) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Cargado: {formatFechaCarga(diasMostrar.map(d => tieneAusencia(emp.id, d)).find(a => a?.fecha_carga)?.fecha_carga)}
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
      </div>
    </main>
  )
}