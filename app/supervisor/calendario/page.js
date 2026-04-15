'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useCategorias } from '../../../lib/useCategorias'

export default function CalendarioSupervisor() {
  const [empleados, setEmpleados] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [adjuntos, setAdjuntos] = useState([])
  const [semanaOffset, setSemanaOffset] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [modoFiltro, setModoFiltro] = useState(false)
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [departamento, setDepartamento] = useState('')
  const { categorias } = useCategorias()
  const router = useRouter()

  const getDiasSemana = (offset = 0) => {
    const hoy = new Date()
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - hoy.getDay() + 1 + offset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes)
      d.setDate(lunes.getDate() + i)
      return d
    })
  }

  const toLocalISO = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

  const dias = getDiasSemana(semanaOffset)

  const diasMostrar = modoFiltro && filtroDesde && filtroHasta
    ? (() => {
        const result = []
        const current = new Date(filtroDesde)
        const end = new Date(filtroHasta)
        while (current <= end) {
          result.push(new Date(current))
          current.setDate(current.getDate() + 1)
        }
        return result
      })()
    : dias

  const fechaInicio = modoFiltro && filtroDesde ? filtroDesde : toLocalISO(dias[0])
  const fechaFin = modoFiltro && filtroHasta ? filtroHasta : toLocalISO(dias[6])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: sup } = await supabase.from('usuarios').select('*').eq('id', user.id).single()
      if (sup?.rol !== 'supervisor') { router.push('/'); return }
      const { data: dept } = await supabase.from('departamentos').select('nombre').eq('supervisor_id', user.id).single()
      if (!dept) {
        setEmpleados([sup])
        setDepartamento(sup.departamento || '')
      } else {
        const { data: emps } = await supabase.from('usuarios').select('*').eq('departamento', dept.nombre).order('nombre')
        setEmpleados(emps || [sup])
        setDepartamento(dept.nombre)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (empleados.length === 0) return
    const cargarAusencias = async () => {
      const ids = empleados.map(e => e.id)
      const [{ data }, adj] = await Promise.all([
        supabase.from('ausencias').select('*').in('empleado_id', ids).gte('fecha', fechaInicio).lte('fecha', fechaFin),
        fetch(`/api/adjuntos?empleadoIds=${ids.join(',')}`).then(r => r.json())
      ])
      setAusencias(data || [])
      setAdjuntos(adj || [])
    }
    cargarAusencias()
  }, [empleados, semanaOffset, filtroDesde, filtroHasta, modoFiltro])

  const empleadosFiltrados = empleados.filter(e =>
    busqueda === '' || e.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  const tieneAusencia = (empleadoId, fecha) => {
    const fechaStr = typeof fecha === 'string' ? fecha : toLocalISO(fecha)
    return ausencias.find(a => a.empleado_id === empleadoId && a.fecha === fechaStr)
  }

  const getAdjunto = (empleadoId, fecha) => {
    const fechaStr = typeof fecha === 'string' ? fecha : toLocalISO(fecha)
    return adjuntos.find(a => a.empleado_id === empleadoId && a.fecha_desde <= fechaStr && (a.fecha_hasta || a.fecha_desde) >= fechaStr)
  }

  const getCat = (nombre) => categorias.find(c => c.nombre === nombre) || { emoji: '📝', color: 'bg-gray-100 text-gray-600' }

  const formatFecha = (d) => d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })

  const totalAusentes = new Set(ausencias.filter(a => empleadosFiltrados.find(e => e.id === a.empleado_id)).map(a => a.empleado_id)).size
  const totalPresentes = empleadosFiltrados.length - totalAusentes

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Calendario — {departamento}</h1>
            <p className="text-gray-500 text-sm">Vista de ausencias del departamento</p>
          </div>
          <button onClick={() => router.push('/supervisor')} className="text-sm text-blue-600 hover:underline">Volver al panel</button>
        </div>

        {/* Stats semana */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-3xl font-bold text-gray-800">{empleadosFiltrados.length}</p>
            <p className="text-xs text-gray-400 mt-1">Total empleados</p>
          </div>
          <div className="bg-green-500 text-white rounded-xl shadow p-4 text-center">
            <p className="text-3xl font-bold">{totalPresentes}</p>
            <p className="text-xs opacity-80 mt-1">Presentes</p>
          </div>
          <div className="bg-red-500 text-white rounded-xl shadow p-4 text-center">
            <p className="text-3xl font-bold">{totalAusentes}</p>
            <p className="text-xs opacity-80 mt-1">Con ausencias</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow px-6 py-4 mb-4 flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="Buscar empleado..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
          <button
            onClick={() => { setModoFiltro(!modoFiltro); setFiltroDesde(''); setFiltroHasta('') }}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${modoFiltro ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Filtrar por fecha
          </button>
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

        {/* Navegación semana */}
        {!modoFiltro && (
          <div className="flex items-center justify-between bg-white rounded-xl shadow px-6 py-3 mb-4">
            <button onClick={() => setSemanaOffset(s => s - 1)} className="text-blue-600 hover:underline font-medium">Semana anterior</button>
            <p className="text-gray-700 font-medium">{formatFecha(dias[0])} - {formatFecha(dias[6])}</p>
            <button onClick={() => setSemanaOffset(s => s + 1)} className="text-blue-600 hover:underline font-medium">Semana siguiente</button>
          </div>
        )}

        {/* Calendario */}
        {empleadosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">No hay empleados para mostrar.</div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">Empleado</th>
                  {diasMostrar.map((d, i) => (
                    <th key={i} className="px-3 py-3 text-gray-600 font-semibold text-center text-xs">
                      {formatFecha(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empleadosFiltrados.map(emp => (
                  <tr key={emp.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">{emp.nombre.split(',')[0]}</td>
                    {diasMostrar.map((d, i) => {
                      const ausencia = tieneAusencia(emp.id, d)
                      const cat = ausencia ? getCat(ausencia.motivo) : null
                      const adjunto = ausencia ? getAdjunto(emp.id, d) : null
                      return (
                        <td key={i} className="px-2 py-3 text-center">
                          {ausencia ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cat.color}`}
                              title={ausencia.descripcion || ausencia.motivo}
                            >
                              {cat.emoji} {ausencia.motivo}
                              {adjunto && (
                                <a href={adjunto.archivo_url} target="_blank" rel="noopener noreferrer" title={adjunto.archivo_nombre} onClick={e => e.stopPropagation()} className="opacity-70 hover:opacity-100">📎</a>
                              )}
                            </span>
                          ) : (
                            <span className="inline-block w-4 h-4 rounded-full bg-green-400 mx-auto" title="Presente" />
                          )}
                        </td>
                      )
                    })}
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
