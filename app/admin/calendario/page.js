'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useCategorias } from '../../../lib/useCategorias'

const DEPARTAMENTOS = ['Todos', 'GERENCIA', 'MICE', 'PRODUCTO', 'ADM', 'BOOKING', 'TRAFICO', 'CRUCEROS', 'SISTEMAS']

export default function CalendarioAdmin() {
  const [empleados, setEmpleados] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [adjuntos, setAdjuntos] = useState([])
  const [mesOffset, setMesOffset] = useState(0)
  const [filtroDept, setFiltroDept] = useState('Todos')
  const [busqueda, setBusqueda] = useState('')
  const { categorias } = useCategorias()
  const router = useRouter()

  const getDiasMes = (offset = 0) => {
    const hoy = new Date()
    const año = hoy.getFullYear()
    const mes = hoy.getMonth() + offset
    const primero = new Date(año, mes, 1)
    const ultimo = new Date(año, mes + 1, 0)
    const dias = []
    for (let d = new Date(primero); d <= ultimo; d.setDate(d.getDate() + 1)) {
      dias.push(new Date(d))
    }
    return dias
  }

  const toLocalISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const dias = getDiasMes(mesOffset)
  const fechaInicio = toLocalISO(dias[0])
  const fechaFin = toLocalISO(dias[dias.length - 1])

  const mesNombre = dias[0].toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  useEffect(() => {
    const init = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      const user = session?.user
      if (!user || error) { await supabase.auth.signOut(); router.replace('/'); return }
      const { data } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
      if (!data || data.rol !== 'admin') { await supabase.auth.signOut(); router.replace('/'); return }
      const { data: emps } = await supabase.from('usuarios').select('*').neq('rol', 'admin').order('departamento').order('nombre')
      setEmpleados(emps || [])
    }
    init()
  }, [])

  useEffect(() => {
    if (empleados.length === 0) return
    let activo = true
    const ids = empleados.map(e => e.id)
    Promise.all([
      supabase.from('ausencias').select('*').in('empleado_id', ids).gte('fecha', fechaInicio).lte('fecha', fechaFin),
      fetch(`/api/adjuntos?empleadoIds=${ids.join(',')}`).then(r => r.json())
    ]).then(([{ data }, adj]) => {
      if (!activo) return
      setAusencias(data || [])
      setAdjuntos(adj || [])
    }).catch(() => {})
    return () => { activo = false }
  }, [empleados, mesOffset])

  const empleadosFiltrados = empleados
    .filter(e => filtroDept === 'Todos' || e.departamento === filtroDept)
    .filter(e => busqueda === '' || e.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  const tieneAusencia = (empleadoId, fecha) => {
    const fechaStr = toLocalISO(fecha)
    return ausencias.find(a => a.empleado_id === empleadoId && a.fecha === fechaStr)
  }

  const getAdjunto = (empleadoId, fecha) => {
    const fechaStr = toLocalISO(fecha)
    return adjuntos.find(a => a.empleado_id === empleadoId && a.fecha_desde <= fechaStr && (a.fecha_hasta || a.fecha_desde) >= fechaStr)
  }

  const getCat = (nombre) => categorias.find(c => c.nombre === nombre) || { emoji: '📝', color: 'bg-gray-100 text-gray-600' }

  const formatDia = (d) => {
    const wd = d.toLocaleDateString('es-AR', { weekday: 'short' })
    return { dia: d.getDate(), semana: wd.charAt(0).toUpperCase() + wd.slice(1) }
  }

  const esHoy = (d) => toLocalISO(d) === toLocalISO(new Date())
  const esFinde = (d) => d.getDay() === 0 || d.getDay() === 6

  const departamentosConEmpleados = [...new Set(empleadosFiltrados.map(e => e.departamento))].filter(Boolean)

  const totalAusentes = new Set(ausencias.filter(a => empleadosFiltrados.find(e => e.id === a.empleado_id)).map(a => a.empleado_id)).size
  const totalPresentes = empleadosFiltrados.length - totalAusentes

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-full mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 capitalize">{mesNombre}</h1>
            <p className="text-gray-500 text-sm">Vista completa de ausencias por departamento</p>
          </div>
          <button onClick={() => router.push('/admin')} className="text-sm text-blue-600 hover:underline">Volver al panel</button>
        </div>

        {/* Stats mes */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-3xl font-bold text-gray-800">{empleadosFiltrados.length}</p>
            <p className="text-xs text-gray-400 mt-1">Total empleados</p>
          </div>
          <div className="bg-green-500 text-white rounded-xl shadow p-4 text-center">
            <p className="text-3xl font-bold">{totalPresentes}</p>
            <p className="text-xs opacity-80 mt-1">Sin ausencias este mes</p>
          </div>
          <div className="bg-red-500 text-white rounded-xl shadow p-4 text-center">
            <p className="text-3xl font-bold">{totalAusentes}</p>
            <p className="text-xs opacity-80 mt-1">Con ausencias este mes</p>
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
          <div className="flex flex-wrap gap-2">
            {DEPARTAMENTOS.map(d => (
              <button key={d} onClick={() => setFiltroDept(d)} className={`px-3 py-1 rounded-full text-sm font-medium transition ${filtroDept === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Navegación mes */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow px-6 py-3 mb-4">
          <button onClick={() => setMesOffset(m => m - 1)} className="text-blue-600 hover:underline font-medium">← Mes anterior</button>
          <p className="text-gray-700 font-semibold capitalize">{mesNombre}</p>
          <button onClick={() => setMesOffset(m => m + 1)} className="text-blue-600 hover:underline font-medium">Mes siguiente →</button>
        </div>

        {/* Calendario agrupado por departamento */}
        {departamentosConEmpleados.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">No hay empleados para mostrar.</div>
        ) : (
          departamentosConEmpleados.map(dept => (
            <div key={dept} className="bg-white rounded-xl shadow mb-4">
              <div className="px-4 py-3 bg-gray-50 border-b rounded-t-xl">
                <h3 className="font-semibold text-gray-700">{dept}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse" style={{ minWidth: 'max-content' }}>
                  <thead>
                    <tr className="border-b bg-white">
                      <th className="sticky left-0 z-20 bg-white text-left px-4 py-3 text-gray-600 font-semibold border-r border-gray-200 min-w-[160px]">
                        Empleado
                      </th>
                      {dias.map((d, i) => {
                        const { dia, semana } = formatDia(d)
                        return (
                          <th key={i} className={`px-2 py-3 text-center font-semibold min-w-[52px] ${esHoy(d) ? 'bg-blue-50 text-blue-700' : esFinde(d) ? 'bg-gray-50 text-gray-400' : 'text-gray-600'}`}>
                            <div className="text-xs">{semana}</div>
                            <div className={`text-sm ${esHoy(d) ? 'font-bold' : ''}`}>{dia}</div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {empleadosFiltrados.filter(e => e.departamento === dept).map(emp => (
                      <tr key={emp.id} className="border-b hover:bg-gray-50">
                        <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium text-gray-700 border-r border-gray-200 min-w-[160px] whitespace-nowrap">
                          {emp.nombre}
                        </td>
                        {dias.map((d, i) => {
                          const ausencia = tieneAusencia(emp.id, d)
                          const cat = ausencia ? getCat(ausencia.motivo) : null
                          const adjunto = ausencia ? getAdjunto(emp.id, d) : null
                          return (
                            <td key={i} className={`px-1 py-2 text-center ${esFinde(d) ? 'bg-gray-50' : ''} ${esHoy(d) ? 'bg-blue-50' : ''}`}>
                              {ausencia ? (
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${cat.color}`} title={ausencia.descripcion || ausencia.motivo}>
                                  {cat.emoji}
                                  {adjunto && (
                                    <a href={adjunto.archivo_url} target="_blank" rel="noopener noreferrer" title={adjunto.archivo_nombre} onClick={e => e.stopPropagation()} className="opacity-70 hover:opacity-100">📎</a>
                                  )}
                                </span>
                              ) : (
                                esFinde(d)
                                  ? <span className="inline-block w-3 h-3 rounded-full bg-gray-200 mx-auto" title="Fin de semana" />
                                  : <span className="inline-block w-3 h-3 rounded-full bg-green-400 mx-auto" title="Presente" />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  )
}
