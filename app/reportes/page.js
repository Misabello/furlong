'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useCategorias } from '../../lib/useCategorias'

export default function Reportes() {
  const hoy = new Date()
  const dosSemanasAdelante = new Date(hoy)
  dosSemanasAdelante.setDate(hoy.getDate() + 14)
  const formatDate = (d) => d.toISOString().split('T')[0]

  const [empleados, setEmpleados] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [filtroDept, setFiltroDept] = useState('Todos')
  const [filtroMotivo, setFiltroMotivo] = useState('todos')
  const [filtroDesde, setFiltroDesde] = useState(formatDate(hoy))
  const [filtroHasta, setFiltroHasta] = useState(formatDate(dosSemanasAdelante))
  const [loading, setLoading] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [exportandoSheets, setExportandoSheets] = useState(false)
  const [usuario, setUsuario] = useState(null)
  const { categorias } = useCategorias()
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: sup } = await supabase.from('usuarios').select('*').eq('id', user.id).single()
      if (sup?.rol !== 'supervisor' && sup?.rol !== 'admin') { router.push('/empleado'); return }
      setUsuario(sup)
      const { data: emps } = await supabase.from('usuarios').select('*').order('nombre')
      setEmpleados(emps || [])
      const { data: depts } = await supabase.from('departamentos').select('nombre').order('nombre')
      setDepartamentos(['Todos', ...(depts || []).map(d => d.nombre)])
    }
    init()
  }, [])

  const buscar = async () => {
    if (!filtroDesde || !filtroHasta) { alert('Por favor selecciona fecha desde y hasta.'); return }
    setLoading(true)
    setBuscado(true)
    const ids = empleados.filter(e => filtroDept === 'Todos' || e.departamento === filtroDept).map(e => e.id)
    let query = supabase.from('ausencias').select('*').in('empleado_id', ids).gte('fecha', filtroDesde).lte('fecha', filtroHasta)
    if (filtroMotivo !== 'todos') query = query.eq('motivo', filtroMotivo)
    const { data } = await query.order('fecha', { ascending: false })
    setAusencias(data || [])
    setLoading(false)
  }

  const getCat = (nombre) => categorias.find(c => c.nombre === nombre) || { emoji: '📝', color: 'bg-gray-100 text-gray-600' }

  const calcularDiasVacaciones = (fechaIngreso) => {
    if (!fechaIngreso) return 0
    const anios = (new Date() - new Date(fechaIngreso)) / (365.25 * 24 * 60 * 60 * 1000)
    if (anios < 5) return 14
    if (anios < 10) return 21
    if (anios < 20) return 28
    return 35
  }

  const esVacacion = (motivo) => motivo?.toLowerCase().includes('vacaci')

  const ausenciasFiltradas = ausencias.filter(a => {
    const emp = empleados.find(e => e.id === a.empleado_id)
    return filtroDept === 'Todos' || emp?.departamento === filtroDept
  })

  // Agrupar por empleado y motivo
  const resumenPorEmpleado = () => {
    const mapa = {}
    ausenciasFiltradas.forEach(a => {
      const emp = empleados.find(e => e.id === a.empleado_id)
      if (!emp) return
      if (!mapa[emp.id]) mapa[emp.id] = { nombre: emp.nombre, departamento: emp.departamento, fechaIngreso: emp.fecha_ingreso, motivos: {}, vacTomadas: 0 }
      if (!mapa[emp.id].motivos[a.motivo]) mapa[emp.id].motivos[a.motivo] = 0
      mapa[emp.id].motivos[a.motivo]++
      if (esVacacion(a.motivo)) mapa[emp.id].vacTomadas++
    })
    return Object.values(mapa).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }

  const rankingEmpleados = empleados
    .filter(e => filtroDept === 'Todos' || e.departamento === filtroDept)
    .map(emp => ({ ...emp, ausencias: ausenciasFiltradas.filter(a => a.empleado_id === emp.id).length }))
    .filter(e => e.ausencias > 0)
    .sort((a, b) => b.ausencias - a.ausencias)
    .slice(0, 5)

  const detalleAgrupado = () => {
    // Agrupar por empleado + motivo + descripcion
    const mapa = {}
    ausenciasFiltradas.forEach(a => {
      const k = `${a.empleado_id}|${a.motivo}|${a.descripcion || ''}`
      if (!mapa[k]) mapa[k] = []
      mapa[k].push(a)
    })

    const resultado = []
    Object.values(mapa).forEach(registros => {
      // Ordenar por fecha ascendente para detectar consecutivos
      registros.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      let i = 0
      while (i < registros.length) {
        let j = i + 1
        while (j < registros.length &&
          (new Date(registros[j].fecha) - new Date(registros[j - 1].fecha)) <= 3 * 24 * 60 * 60 * 1000
        ) { j++ }
        const grupo = registros.slice(i, j)
        resultado.push({
          empleado_id: grupo[0].empleado_id,
          motivo: grupo[0].motivo,
          descripcion: grupo[0].descripcion,
          fechaDesde: grupo[0].fecha,
          fechaHasta: grupo[grupo.length - 1].fecha,
          dias: grupo.length,
          fecha_carga: grupo[0].fecha_carga,
        })
        i = j
      }
    })

    // Ordenar resultado por nombre de empleado y fecha descendente
    return resultado.sort((a, b) => {
      const empA = empleados.find(e => e.id === a.empleado_id)?.nombre || ''
      const empB = empleados.find(e => e.id === b.empleado_id)?.nombre || ''
      return empA.localeCompare(empB) || new Date(b.fechaHasta) - new Date(a.fechaHasta)
    })
  }

  const statsPorDept = departamentos.slice(1).map(dept => ({
    dept,
    cantidad: ausenciasFiltradas.filter(a => empleados.find(e => e.id === a.empleado_id)?.departamento === dept).length
  })).filter(d => d.cantidad > 0).sort((a, b) => b.cantidad - a.cantidad)

  const exportarSheets = async () => {
    setExportandoSheets(true)
    const filas = ausenciasFiltradas.map(a => {
      const emp = empleados.find(e => e.id === a.empleado_id)
      return {
        nombre: emp?.nombre || '-',
        departamento: emp?.departamento || '-',
        fecha: new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-AR'),
        motivo: a.motivo,
        descripcion: a.descripcion || '-',
        fechaCarga: a.fecha_carga ? new Date(a.fecha_carga).toLocaleDateString('es-AR') : '-',
      }
    })
    const resumenFilas = resumenPorEmpleado().flatMap(emp => {
      const motivos = Object.entries(emp.motivos)
      const total = motivos.reduce((sum, [, d]) => sum + d, 0)
      const vacDisp = calcularDiasVacaciones(emp.fechaIngreso)
      const vacRest = Math.max(0, vacDisp - emp.vacTomadas)
      return motivos.map(([motivo, dias], mi) => ({
        nombre: mi === 0 ? emp.nombre : '',
        departamento: mi === 0 ? (emp.departamento || '-') : '',
        motivo,
        dias: String(dias),
        total: mi === 0 ? String(total) : '',
        vacDisponibles: mi === 0 ? String(vacDisp) : '',
        vacTomadas: mi === 0 ? String(emp.vacTomadas) : '',
        vacRestantes: mi === 0 ? String(vacRest) : '',
      }))
    })
    const res = await fetch('/api/google/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: usuario?.id, filas, resumenFilas, desde: filtroDesde, hasta: filtroHasta }),
    })
    const data = await res.json()
    if (data.ok) {
      window.open(data.url, '_blank')
    } else if (data.reason === 'not_connected') {
      alert('Conecta tu cuenta de Google desde tu perfil para exportar a Sheets.')
    } else {
      alert('Error al exportar. Intenta de nuevo.')
    }
    setExportandoSheets(false)
  }

  const exportarExcel = () => {
    const filas = ausenciasFiltradas.map(a => {
      const emp = empleados.find(e => e.id === a.empleado_id)
      return { Nombre: emp?.nombre || '-', Departamento: emp?.departamento || '-', Fecha: new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-AR'), Motivo: a.motivo, Descripcion: a.descripcion || '-', FechaCarga: a.fecha_carga ? new Date(a.fecha_carga).toLocaleDateString('es-AR') : '-' }
    })
    const headers = ['Nombre', 'Departamento', 'Fecha', 'Motivo', 'Descripcion', 'FechaCarga']
    const csv = [headers.join(','), ...filas.map(f => headers.map(h => '"' + (f[h] || '') + '"').join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ausencias_' + filtroDesde + '_' + filtroHasta + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Reportes y estadisticas</h1>
            <p className="text-gray-500 text-sm">Resumen de ausencias de tu equipo</p>
          </div>
          <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline">Volver al panel</button>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
              <input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
              <input type="date" value={filtroHasta} min={filtroDesde} onChange={e => setFiltroHasta(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Departamento</label>
              <select value={filtroDept} onChange={e => setFiltroDept(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Motivo</label>
              <select value={filtroMotivo} onChange={e => setFiltroMotivo(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="todos">Todos</option>
                {categorias.map(c => <option key={c.id} value={c.nombre}>{c.emoji} {c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 justify-end flex-wrap">
            {buscado && ausenciasFiltradas.length > 0 && (
              <>
                <button onClick={exportarExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium">Exportar CSV</button>
                <button onClick={exportarSheets} disabled={exportandoSheets} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition text-sm font-medium shadow-sm">
                  <svg width="16" height="16" viewBox="0 0 48 48"><rect width="48" height="48" rx="4" fill="#0F9D58"/><path d="M14 13h20v22H14z" fill="#fff"/><path d="M18 18h12M18 22h12M18 26h8" stroke="#0F9D58" strokeWidth="2" strokeLinecap="round"/></svg>
                  {exportandoSheets ? 'Exportando...' : 'Exportar a Sheets'}
                </button>
              </>
            )}
            <button onClick={buscar} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>

        {buscado && (
          <>
            {/* Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 text-white rounded-xl p-4 text-center shadow">
                <p className="text-3xl font-bold">{ausenciasFiltradas.length}</p>
                <p className="text-xs opacity-80 mt-1">Total ausencias</p>
              </div>
              {categorias.slice(0, 3).map(c => (
                <div key={c.id} className={c.color + ' rounded-xl p-4 text-center shadow'}>
                  <p className="text-2xl">{c.emoji}</p>
                  <p className="text-3xl font-bold">{ausenciasFiltradas.filter(a => a.motivo === c.nombre).length}</p>
                  <p className="text-xs opacity-80 mt-1">{c.nombre}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-xl shadow p-6">
                <h2 className="text-lg font-semibold text-gray-700 mb-4">Top 5 ausencias por empleado</h2>
                {rankingEmpleados.length === 0 ? <p className="text-gray-400 text-sm">Sin ausencias en este periodo.</p> : (
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
                {statsPorDept.length === 0 ? <p className="text-gray-400 text-sm">Sin ausencias en este periodo.</p> : (
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

            {/* Resumen agrupado por empleado */}
            <div className="bg-white rounded-xl shadow overflow-x-auto mb-6">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-700">Resumen por empleado</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Empleado</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Departamento</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Motivo</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Dias</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Total</th>
                    <th className="text-left px-4 py-3 text-green-700 font-semibold bg-green-50">Vac. Disponibles</th>
                    <th className="text-left px-4 py-3 text-orange-700 font-semibold bg-orange-50">Vac. Tomadas</th>
                    <th className="text-left px-4 py-3 text-blue-700 font-semibold bg-blue-50">Vac. Restantes</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenPorEmpleado().length === 0 ? (
                    <tr><td colSpan={8} className="text-center text-gray-400 py-8">Sin ausencias.</td></tr>
                  ) : (
                    resumenPorEmpleado().map((emp, ei) => {
                      const motivos = Object.entries(emp.motivos)
                      const total = motivos.reduce((sum, [, dias]) => sum + dias, 0)
                      const vacDisp = calcularDiasVacaciones(emp.fechaIngreso)
                      const vacRest = Math.max(0, vacDisp - emp.vacTomadas)
                      return motivos.map(([motivo, dias], mi) => {
                        const cat = getCat(motivo)
                        return (
                          <tr key={emp.nombre + motivo} className="border-b hover:bg-gray-50">
                            {mi === 0 && (
                              <>
                                <td className="px-4 py-3 font-medium text-gray-700" rowSpan={motivos.length}>{emp.nombre}</td>
                                <td className="px-4 py-3 text-gray-500 text-xs" rowSpan={motivos.length}>{emp.departamento || '-'}</td>
                              </>
                            )}
                            <td className="px-4 py-3">
                              <span className={cat.color + ' inline-block px-2 py-1 rounded-full text-xs font-medium'}>{cat.emoji} {motivo}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{dias} dia{dias > 1 ? 's' : ''}</td>
                            {mi === 0 && (
                              <>
                                <td className="px-4 py-3 font-bold text-gray-800" rowSpan={motivos.length}>{total} dia{total > 1 ? 's' : ''}</td>
                                <td className="px-4 py-3 font-semibold text-green-700 bg-green-50" rowSpan={motivos.length}>{vacDisp}</td>
                                <td className="px-4 py-3 font-semibold text-orange-700 bg-orange-50" rowSpan={motivos.length}>{emp.vacTomadas}</td>
                                <td className={`px-4 py-3 font-bold bg-blue-50 ${vacRest <= 0 ? 'text-red-600' : 'text-blue-700'}`} rowSpan={motivos.length}>{vacRest}</td>
                              </>
                            )}
                          </tr>
                        )
                      })
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Detalle completo */}
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-700">Detalle de ausencias</h2>
                <span className="text-sm text-gray-400">{detalleAgrupado().length} registros</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Empleado</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Departamento</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Fecha</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Dias</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Motivo</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Descripcion</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Cargado</th>
                  </tr>
                </thead>
                <tbody>
                  {ausenciasFiltradas.length === 0 ? (
                    <tr><td colSpan={7} className="text-center text-gray-400 py-8">Sin ausencias para los filtros seleccionados.</td></tr>
                  ) : (
                    detalleAgrupado().map((g, idx) => {
                      const emp = empleados.find(e => e.id === g.empleado_id)
                      const cat = getCat(g.motivo)
                      const esRango = g.dias > 1
                      return (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-700">{emp?.nombre || '-'}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{emp?.departamento || '-'}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {esRango
                              ? new Date(g.fechaDesde + 'T12:00:00').toLocaleDateString('es-AR') + ' al ' + new Date(g.fechaHasta + 'T12:00:00').toLocaleDateString('es-AR')
                              : new Date(g.fechaHasta + 'T12:00:00').toLocaleDateString('es-AR')}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{g.dias} dia{g.dias > 1 ? 's' : ''}</td>
                          <td className="px-4 py-3"><span className={cat.color + ' inline-block px-2 py-1 rounded-full text-xs font-medium'}>{cat.emoji} {g.motivo}</span></td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{g.descripcion || '-'}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{g.fecha_carga ? new Date(g.fecha_carga).toLocaleDateString('es-AR') : '-'}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!buscado && (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <p className="text-gray-400 text-lg">Selecciona un rango de fechas y hace clic en Buscar</p>
          </div>
        )}
      </div>
    </main>
  )
}