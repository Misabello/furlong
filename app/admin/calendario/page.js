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
  const [semanaOffset, setSemanaOffset] = useState(0)
  const [filtroDept, setFiltroDept] = useState('Todos')
  const [busqueda, setBusqueda] = useState('')
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
  const fechaInicio = dias[0].toISOString().split('T')[0]
  const fechaFin = dias[4].toISOString().split('T')[0]

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
      if (data?.rol !== 'admin') { router.push('/'); return }
      const { data: emps } = await supabase.from('usuarios').select('*').neq('rol', 'admin').order('departamento').order('nombre')
      setEmpleados(emps || [])
    }
    init()
  }, [])

  useEffect(() => {
    if (empleados.length === 0) return
    const cargarAusencias = async () => {
      const ids = empleados.map(e => e.id)
      const { data } = await supabase.from('ausencias').select('*').in('empleado_id', ids).gte('fecha', fechaInicio).lte('fecha', fechaFin)
      setAusencias(data || [])
    }
    cargarAusencias()
  }, [empleados, semanaOffset])

  const empleadosFiltrados = empleados
    .filter(e => filtroDept === 'Todos' || e.departamento === filtroDept)
    .filter(e => busqueda === '' || e.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  const tieneAusencia = (empleadoId, fecha) => {
    const fechaStr = fecha.toISOString().split('T')[0]
    return ausencias.find(a => a.empleado_id === empleadoId && a.fecha === fechaStr)
  }

  const getCat = (nombre) => categorias.find(c => c.nombre === nombre) || { emoji: '📝', color: 'bg-gray-100 text-gray-600' }

  const formatFecha = (d) => d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })

  // Agrupar empleados por departamento
  const departamentosConEmpleados = [...new Set(empleadosFiltrados.map(e => e.departamento))].filter(Boolean)

  // Stats de la semana
  const totalAusentes = new Set(ausencias.filter(a => empleadosFiltrados.find(e => e.id === a.empleado_id)).map(a => a.empleado_id)).size
  const totalPresentes = empleadosFiltrados.length - totalAusentes

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Calendario General</h1>
            <p className="text-gray-500 text-sm">Vista completa de ausencias por departamento</p>
          </div>
          <button onClick={() => router.push('/admin')} className="text-sm text-blue-600 hover:underline">Volver al panel</button>
        </div>

        {/* Stats semana */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-3xl font-bold text-gray-800">{empleadosFiltrados.length}</p>
            <p className="text-xs text-gray-400 mt-1">Total empleados</p>
          </div>
          <div className="bg-green-500 text-white rounded-xl shadow p-4 text-center">
            <p className="text-3xl font-bold">{totalPresentes}</p>
            <p className="text-xs opacity-80 mt-1">Presentes esta semana</p>
          </div>
          <div className="bg-red-500 text-white rounded-xl shadow p-4 text-center">
            <p className="text-3xl font-bold">{totalAusentes}</p>
            <p className="text-xs opacity-80 mt-1">Con ausencias esta semana</p>
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

        {/* Navegación semana */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow px-6 py-3 mb-4">
          <button onClick={() => setSemanaOffset(s => s - 1)} className="text-blue-600 hover:underline font-medium">Semana anterior</button>
          <p className="text-gray-700 font-medium">{formatFecha(dias[0])} - {formatFecha(dias[4])}</p>
          <button onClick={() => setSemanaOffset(s => s + 1)} className="text-blue-600 hover:underline font-medium">Semana siguiente</button>
        </div>

        {/* Calendario agrupado por departamento */}
        {departamentosConEmpleados.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">No hay empleados para mostrar.</div>
        ) : (
          departamentosConEmpleados.map(dept => (
            <div key={dept} className="bg-white rounded-xl shadow overflow-x-auto mb-4">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="font-semibold text-gray-700">{dept}</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Empleado</th>
                    {dias.map((d, i) => <th key={i} className="px-4 py-3 text-gray-600 font-semibold text-center">{formatFecha(d)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {empleadosFiltrados.filter(e => e.departamento === dept).map(emp => (
                    <tr key={emp.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-700">{emp.nombre}</td>
                      {dias.map((d, i) => {
                        const ausencia = tieneAusencia(emp.id, d)
                        const cat = ausencia ? getCat(ausencia.motivo) : null
                        return (
                          <td key={i} className="px-4 py-3 text-center">
                            {ausencia ? (
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${cat.color}`} title={ausencia.descripcion || ausencia.motivo}>
                                {cat.emoji} {ausencia.motivo}
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
          ))
        )}
      </div>
    </main>
  )
}