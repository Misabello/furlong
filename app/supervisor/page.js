'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useCategorias } from '../../lib/useCategorias'

const DEPARTAMENTOS = ['Todos', 'MKT & PROD', 'BOOKING', 'CRUCEROS', 'USHUAIA', 'TRAFICO', 'MICE', 'ADM', 'SISTEMAS']

export default function Supervisor() {
  const [usuario, setUsuario] = useState(null)
  const [empleados, setEmpleados] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [semanaOffset, setSemanaOffset] = useState(0)
  const [filtroDept, setFiltroDept] = useState('Todos')
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
      const { data: sup } = await supabase.from('usuarios').select('*').eq('id', user.id).single()
      if (sup?.rol !== 'supervisor') { router.push('/empleado'); return }
      setUsuario(sup)
      const { data: supData } = await supabase.from('departamentos').select('nombre').eq('supervisor_id', user.id).single()
      const { data: emps } = await supabase.from('usuarios').select('*').eq('departamento', supData?.nombre)
      setEmpleados(emps || [])
      .from('departamentos')
      .select('nombre')
      .eq('supervisor_id', user.id)
      .single()
    
    const { data: emps } = await supabase
      .from('usuarios')
      .select('*')
      .eq('departamento', dept?.nombre)
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

  const empleadosFiltrados = filtroDept === 'Todos' ? empleados : empleados.filter(e => e.departamento === filtroDept)

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

  if (!usuario) return <main className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-gray-500">Cargando...</p></main>

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Panel Supervisor</h1>
            <p className="text-gray-500 text-sm">Hola, {usuario?.nombre}</p>
          </div>
          <div className="flex gap-4 items-center">
            <button onClick={() => router.push('/perfil')} className="text-sm text-blue-600 hover:underline">Mi perfil</button>
            <button onClick={() => router.push('/reportes')} className="text-sm text-blue-600 hover:underline">Reportes</button>
            <button onClick={() => router.push('/categorias')} className="text-sm text-blue-600 hover:underline">Categorias</button>
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

        <div className="flex items-center justify-between bg-white rounded-xl shadow px-6 py-3 mb-4">
          <button onClick={() => setSemanaOffset(s => s - 1)} className="text-blue-600 hover:underline font-medium">Semana anterior</button>
          <p className="text-gray-700 font-medium">{formatFecha(dias[0])} - {formatFecha(dias[4])}</p>
          <button onClick={() => setSemanaOffset(s => s + 1)} className="text-blue-600 hover:underline font-medium">Semana siguiente</button>
        </div>

        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Empleado</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Depto.</th>
                {dias.map((d, i) => <th key={i} className="px-4 py-3 text-gray-600 font-semibold text-center">{formatFecha(d)}</th>)}
              </tr>
            </thead>
            <tbody>
              {empleadosFiltrados.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-8">No hay empleados en este departamento.</td></tr>
              ) : (
                empleadosFiltrados.map((emp) => (
                  <tr key={emp.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">{emp.nombre}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{emp.departamento || '-'}</td>
                    {dias.map((d, i) => {
                      const ausencia = tieneAusencia(emp.id, d)
                      const cat = ausencia ? getCat(ausencia.motivo) : null
                      return (
                        <td key={i} className="px-4 py-3 text-center">
                          {ausencia ? (
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${cat.color}`} title={ausencia.motivo}>
                              {cat.emoji} {ausencia.motivo}
                            </span>
                          ) : (
                            <span className="inline-block w-4 h-4 rounded-full bg-green-400 mx-auto" title="Presente" />
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