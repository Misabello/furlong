'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useCategorias } from '../../lib/useCategorias'

const DEPARTAMENTOS = ['Todos', 'MKT & PROD', 'BOOKING', 'CRUCEROS', 'USHUAIA', 'TRAFICO', 'MICE', 'ADM', 'SISTEMAS']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Reportes() {
  const [empleados, setEmpleados] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [filtroDept, setFiltroDept] = useState('Todos')
  const [filtroMotivo, setFiltroMotivo] = useState('todos')
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth())
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const { categorias } = useCategorias()
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: sup } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
      if (sup?.rol !== 'supervisor') { router.push('/empleado'); return }
      const { data: emps } = await supabase.from('usuarios').select('*').eq('supervisor_id', user.id)
      setEmpleados(emps || [])
      if (emps && emps.length > 0) {
        const ids = emps.map(e => e.id)
        const { data: aus } = await supabase.from('ausencias').select('*').in('empleado_id', ids)
        setAusencias(aus || [])
      }
      setLoading(false)
    }
    init()
  }, [])

  const getCat = (nombre) => categorias.find(c => c.nombre === nombre) || { emoji: '📝', color: 'bg-gray-100 text-gray-600' }

  const ausenciasFiltradas = ausencias.filter(a => {
    const fecha = new Date(a.fecha)
    const emp = empleados.find(e => e.id === a.empleado_id)
    return (filtroDept === 'Todos' || emp?.departamento === filtroDept) &&
      (filtroMotivo === 'todos' || a.motivo === filtroMotivo) &&
      fecha.getMonth() === filtroMes &&
      fecha.getFullYear() === filtroAnio
  })

  const rankingEmpleados = empleados
    .map(emp => ({ ...emp, ausencias: ausenciasFiltradas.filter(a => a.empleado_id === emp.id).length }))
    .filter(e => filtroDept === 'Todos' || e.departamento === filtroDept)
    .sort((a, b) => b.ausencias - a.ausencias)
    .slice(0, 5)

  const statsPorDept = DEPARTAMENTOS.slice(1).map(dept => ({
    dept,
    cantidad: ausenciasFiltradas.filter(a => empleados.find(e => e.id === a.empleado_id)?.departamento === dept).length
  })).filter(d => d.cantidad > 0).sort((a, b) => b.cantidad - a.cantidad)

  if (loading) return <main className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-gray-500">Cargando reportes...</p></main>

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Reportes y estadisticas</h1>
            <p className="text-gray-500 text-sm">Resumen de ausencias de tu equipo</p>
          </div>
          <button onClick={() => router.push('/supervisor')} className="text-sm text-blue-600 hover:underline">Volver al panel</button>
        </div>

        <div className="bg-white rounded-xl shadow p-4 mb-6 flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mes</label>
            <select value={filtroMes} onChange={e => setFiltroMes(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Anio</label>
            <select value={filtroAnio} onChange={e => setFiltroAnio(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {[2024,2025,2026,2027].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Departamento</label>
            <select value={filtroDept} onChange={e => setFiltroDept(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Motivo</label>
            <select value={filtroMotivo} onChange={e => setFiltroMotivo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="todos">Todos</option>
              {categorias.map(c => <option key={c.id} value={c.nombre}>{c.emoji} {c.nombre}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Top 5 ausencias por empleado</h2>
            {rankingEmpleados.every(e => e.ausencias === 0) ? (
              <p className="text-gray-400 text-sm">Sin ausencias en este periodo.</p>
            ) : (
              <ul className="space-y-3">
                {rankingEmpleados.map((emp, i) => (
                  <li key={emp.id} className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400 w-6">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{emp.nombre}</span>
                        <span className="text-sm text-gray-500">{emp.ausencias} dias</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: rankingEmpleados[0].ausencias > 0 ? (emp.ausencias / rankingEmpleados[0].ausencias * 100) + '%' : '0%' }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Ausencias por departamento</h2>
            {statsPorDept.length === 0 ? (
              <p className="text-gray-400 text-sm">Sin ausencias en este periodo.</p>
            ) : (
              <ul className="space-y-3">
                {statsPorDept.map(({ dept, cantidad }) => (
                  <li key={dept} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{dept}</span>
                        <span className="text-sm text-gray-500">{cantidad} dias</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-purple-500 h-2 rounded-full" style={{ width: statsPorDept[0].cantidad > 0 ? (cantidad / statsPorDept[0].cantidad * 100) + '%' : '0%' }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-700">Detalle de ausencias</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Empleado</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Departamento</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Fecha</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Motivo</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Descripcion</th>
              </tr>
            </thead>
            <tbody>
              {ausenciasFiltradas.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-gray-400 py-8">Sin ausencias para los filtros seleccionados.</td></tr>
              ) : (
                ausenciasFiltradas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(a => {
                  const emp = empleados.find(e => e.id === a.empleado_id)
                  const cat = getCat(a.motivo)
                  return (
                    <tr key={a.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-700">{emp?.nombre || '-'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{emp?.departamento || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(a.fecha).toLocaleDateString('es-AR')}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${cat.color}`}>{cat.emoji} {a.motivo}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{a.descripcion || '-'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}