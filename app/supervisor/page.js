'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useCategorias } from '../../lib/useCategorias'
import Image from 'next/image'

export default function Supervisor() {
  const [usuario, setUsuario] = useState(null)
  const [empleados, setEmpleados] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [adjuntosCalendario, setAdjuntosCalendario] = useState([])
  const [semanaOffset, setSemanaOffset] = useState(0)
  const [filtroMotivo, setFiltroMotivo] = useState('todos')
  const [busquedaUsuario, setBusquedaUsuario] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [modoFiltro, setModoFiltro] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [tab, setTab] = useState('calendario')
  const [fechaDesdeAus, setFechaDesdeAus] = useState('')
  const [fechaHastaAus, setFechaHastaAus] = useState('')
  const [motivoAus, setMotivoAus] = useState('')
  const [descripcionAus, setDescripcionAus] = useState('')
  const [usarRangoAus, setUsarRangoAus] = useState(false)
  const [mensajeAus, setMensajeAus] = useState('')
  const [loadingAus, setLoadingAus] = useState(false)
  const [misAusencias, setMisAusencias] = useState([])
  const [archivoAus, setArchivoAus] = useState(null)
  const [adjuntosAus, setAdjuntosAus] = useState([])
  const [subiendoAdjIdx, setSubiendoAdjIdx] = useState(null)
  const [adjGrupoActual, setAdjGrupoActual] = useState(null)
  const adjInputRef = useRef(null)
  const [editandoAusIdx, setEditandoAusIdx] = useState(null)
  const [editAusMotivo, setEditAusMotivo] = useState('')
  const [editAusDescripcion, setEditAusDescripcion] = useState('')
  const [editAusFechaDesde, setEditAusFechaDesde] = useState('')
  const [editAusFechaHasta, setEditAusFechaHasta] = useState('')
  const [editAusUsarRango, setEditAusUsarRango] = useState(false)
  const [paraColaborador, setParaColaborador] = useState(false)
  const [empColaboradorId, setEmpColaboradorId] = useState('')
  const [misAusFiltroDesde, setMisAusFiltroDesde] = useState('')
  const [misAusFiltroHasta, setMisAusFiltroHasta] = useState('')
  const [misAusFiltroMotivo, setMisAusFiltroMotivo] = useState('todos')
  const [filtroEmpleadoAus, setFiltroEmpleadoAus] = useState('')
  const [editandoCal, setEditandoCal] = useState(null)
  const [editCalMotivo, setEditCalMotivo] = useState('')
  const [editCalDescripcion, setEditCalDescripcion] = useState('')
  const [editCalFecha, setEditCalFecha] = useState('')
  const [editCalLoading, setEditCalLoading] = useState(false)
  const { categorias } = useCategorias()
  const router = useRouter()

  const getDiasSemana = (offset = 0) => {
    const hoy = new Date()
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - hoy.getDay() + 1 + offset * 15)
    return Array.from({ length: 15 }, (_, i) => {
      const d = new Date(lunes)
      d.setDate(lunes.getDate() + i)
      return d
    })
  }

  const toLocalISO = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

  const dias = getDiasSemana(semanaOffset)
  const fechaInicio = modoFiltro && filtroDesde ? filtroDesde : toLocalISO(dias[0])
  const fechaFin = modoFiltro && filtroHasta ? filtroHasta : toLocalISO(dias[14])

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

  const getBsasTime = () => {
    const now = new Date()
    now.setHours(now.getHours() - 3)
    return now
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: sup } = await supabase.from('usuarios').select('*').eq('id', user.id).single()
      if (sup?.rol !== 'supervisor') { router.push('/empleado'); return }
      setUsuario(sup)
      let empList
      const { data: dept } = await supabase.from('departamentos').select('nombre').eq('supervisor_id', user.id).single()
      if (!dept) {
        empList = [sup]
      } else {
        const { data } = await supabase.from('usuarios').select('*').eq('departamento', dept.nombre)
        empList = data
      }
      setEmpleados(empList || [])
      cargarMisAusencias(empList || [])
      cargarAdjuntosAus(empList || [])
    }
    init()
  }, [])

  useEffect(() => {
    if (categorias.length > 0 && !motivoAus) setMotivoAus(categorias[0].nombre)
  }, [categorias])

  useEffect(() => {
    if (empleados.length === 0) return
    const cargarAusencias = async () => {
      const ids = empleados.map(e => e.id)
      let query = supabase.from('ausencias').select('*').in('empleado_id', ids).gte('fecha', fechaInicio).lte('fecha', fechaFin)
      if (filtroMotivo !== 'todos') query = query.eq('motivo', filtroMotivo)
      const [{ data }, adj] = await Promise.all([query, fetch(`/api/adjuntos?empleadoIds=${ids.join(',')}`).then(r => r.json())])
      setAusencias(data || [])
      setAdjuntosCalendario(adj || [])
    }
    cargarAusencias()
  }, [empleados, semanaOffset, filtroMotivo, filtroDesde, filtroHasta, modoFiltro])

  const cargarMisAusencias = async (empList) => {
    const list = empList || empleados
    const ids = list.map(e => e.id)
    if (ids.length === 0) return
    const { data } = await supabase.from('ausencias').select('*').in('empleado_id', ids).order('fecha', { ascending: false })
    setMisAusencias(data || [])
  }

  const cargarAdjuntosAus = async (empList) => {
    const list = empList || empleados
    const ids = list.map(e => e.id)
    if (ids.length === 0) return
    const data = await fetch(`/api/adjuntos?empleadoIds=${ids.join(',')}`).then(r => r.json())
    setAdjuntosAus(data || [])
  }

  const generarFechas = (desde, hasta) => {
    const fechas = []
    const [yd, md, dd] = desde.split('-').map(Number)
    const [yh, mh, dh] = hasta.split('-').map(Number)
    const current = new Date(yd, md - 1, dd)
    const end = new Date(yh, mh - 1, dh)
    while (current <= end) {
      const y = current.getFullYear()
      const m = String(current.getMonth() + 1).padStart(2, '0')
      const d = String(current.getDate()).padStart(2, '0')
      fechas.push(`${y}-${m}-${d}`)
      current.setDate(current.getDate() + 1)
    }
    return fechas
  }

  const cantidadDiasAus = () => {
    if (!fechaDesdeAus) return 0
    return generarFechas(fechaDesdeAus, usarRangoAus && fechaHastaAus ? fechaHastaAus : fechaDesdeAus).length
  }

  const handleSubmitAusencia = async (e) => {
    e.preventDefault()
    setLoadingAus(true)
    setMensajeAus('')
    const destinatarioId = paraColaborador && empColaboradorId ? empColaboradorId : usuario.id
    const hasta = usarRangoAus && fechaHastaAus ? fechaHastaAus : fechaDesdeAus
    const fechas = generarFechas(fechaDesdeAus, hasta)
    if (fechas.length === 0) { setLoadingAus(false); return }
    const { data: conflictos, error: errConflictos } = await supabase.from('ausencias').select('fecha').eq('empleado_id', destinatarioId).in('fecha', fechas)
    if (errConflictos) { setMensajeAus('Error al verificar ausencias existentes. Intentá de nuevo.'); setLoadingAus(false); return }
    if (conflictos.length > 0) {
      setMensajeAus('Ya hay ausencias en: ' + conflictos.map(c => new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR')).join(', '))
      setLoadingAus(false)
      return
    }
    const bsas = getBsasTime()
    const registros = fechas.map(f => ({ empleado_id: destinatarioId, fecha: f, motivo: motivoAus, descripcion: descripcionAus, fecha_carga: bsas.toISOString() }))
    const { error } = await supabase.from('ausencias').insert(registros)
    if (error) { setMensajeAus('Error al registrar.'); setLoadingAus(false); return }

    if (archivoAus) {
      const fd = new FormData()
      fd.append('file', archivoAus)
      fd.append('empleadoId', destinatarioId)
      fd.append('fechaDesde', fechaDesdeAus)
      fd.append('fechaHasta', hasta)
      fd.append('motivo', motivoAus)
      const uploadRes = await fetch('/api/drive/upload', { method: 'POST', body: fd })
      const uploadData = await uploadRes.json()
      setMensajeAus(uploadData.ok
        ? (fechas.length > 1 ? 'Se registraron ' + fechas.length + ' dias.' : 'Ausencia registrada.') + ' Archivo subido.'
        : 'Ausencia registrada, pero no se pudo subir el archivo: ' + (uploadData.reason || 'error'))
      cargarAdjuntosAus()
    } else {
      setMensajeAus(fechas.length > 1 ? 'Se registraron ' + fechas.length + ' dias.' : 'Ausencia registrada.')
    }

    setFechaDesdeAus('')
    setFechaHastaAus('')
    setDescripcionAus('')
    setArchivoAus(null)
    const fileInput = document.getElementById('archivo-input-sup')
    if (fileInput) fileInput.value = ''
    cargarMisAusencias()
    fetch('/api/google/evento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: destinatarioId, fechaDesde: fechaDesdeAus, fechaHasta: hasta, motivo: motivoAus, descripcion: descripcionAus }),
    }).catch(() => {})
    setLoadingAus(false)
  }

  const handleEliminarAus = async (ids) => {
    if (!confirm('¿Eliminar esta ausencia?')) return
    await supabase.from('ausencias').delete().in('id', ids)
    cargarMisAusencias()
  }

  const handleGuardarEdicionAus = async (ids, empleadoId) => {
    const hasta = editAusUsarRango && editAusFechaHasta ? editAusFechaHasta : editAusFechaDesde
    const nuevasFechas = generarFechas(editAusFechaDesde, hasta)
    if (nuevasFechas.length === 0) return
    const { data: conflictos, error: errConflictos } = await supabase.from('ausencias').select('fecha, id').eq('empleado_id', empleadoId).in('fecha', nuevasFechas)
    if (errConflictos) { setMensajeAus('Error al verificar ausencias. Intentá de nuevo.'); return }
    const reales = conflictos.filter(c => !ids.includes(c.id))
    if (reales.length > 0) { setMensajeAus('Ya tenes ausencias en: ' + reales.map(c => new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR')).join(', ')); return }
    const bsas = getBsasTime()
    await supabase.from('ausencias').delete().in('id', ids)
    await supabase.from('ausencias').insert(nuevasFechas.map(f => ({ empleado_id: empleadoId, fecha: f, motivo: editAusMotivo, descripcion: editAusDescripcion, fecha_carga: bsas.toISOString() })))
    setEditandoAusIdx(null)
    cargarMisAusencias()
  }

  const tieneAusencia = (empleadoId, fecha) => {
    const fechaStr = toLocalISO(fecha)
    return ausencias.find(a => a.empleado_id === empleadoId && a.fecha === fechaStr)
  }

  const getAdjunto = (empleadoId, fecha) => {
    const fechaStr = toLocalISO(fecha)
    return adjuntosCalendario.find(a => a.empleado_id === empleadoId && a.fecha_desde <= fechaStr && (a.fecha_hasta || a.fecha_desde) >= fechaStr)
  }

  const getCat = (nombre) => categorias.find(c => c.nombre === nombre) || { emoji: '📝', color: 'bg-gray-100 text-gray-600' }

  const handleAdjuntarArchivo = (g, idx) => {
    setAdjGrupoActual({ g, idx })
    adjInputRef.current?.click()
  }

  const handleArchivoAdjunto = async (e) => {
    const file = e.target.files[0]
    if (!file || !adjGrupoActual) return
    const { g, idx } = adjGrupoActual
    setSubiendoAdjIdx(idx)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('empleadoId', g.empleado_id)
    fd.append('fechaDesde', g.fechaDesde)
    fd.append('fechaHasta', g.fechaHasta)
    fd.append('motivo', g.motivo)
    const res = await fetch('/api/drive/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (!data.ok) alert('No se pudo subir el archivo: ' + (data.reason || 'error'))
    await cargarAdjuntosAus()
    setSubiendoAdjIdx(null)
    setAdjGrupoActual(null)
    e.target.value = ''
  }
  const formatFecha = (d) => d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
  const formatFechaCarga = (f) => {
    if (!f) return ''
    return new Date(f).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const recargarAusencias = async () => {
    const ids = empleados.map(e => e.id)
    if (ids.length === 0) return
    let q = supabase.from('ausencias').select('*').in('empleado_id', ids).gte('fecha', fechaInicio).lte('fecha', fechaFin)
    if (filtroMotivo !== 'todos') q = q.eq('motivo', filtroMotivo)
    const { data } = await q
    setAusencias(data || [])
  }

  const abrirEditCal = (ausencia) => {
    setEditandoCal(ausencia)
    setEditCalMotivo(ausencia.motivo)
    setEditCalDescripcion(ausencia.descripcion || '')
    setEditCalFecha(ausencia.fecha)
  }

  const handleGuardarCalModal = async () => {
    setEditCalLoading(true)
    await supabase.from('ausencias').update({ motivo: editCalMotivo, descripcion: editCalDescripcion, fecha: editCalFecha }).eq('id', editandoCal.id)
    setEditandoCal(null)
    await recargarAusencias()
    setEditCalLoading(false)
  }

  const handleEliminarCalModal = async () => {
    if (!confirm('¿Eliminar esta ausencia?')) return
    await supabase.from('ausencias').delete().eq('id', editandoCal.id)
    setEditandoCal(null)
    await recargarAusencias()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }


  if (!usuario) return <main className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-gray-500">Cargando...</p></main>

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">

        <div className="flex justify-between items-center mb-4 md:mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Panel Supervisor</h1>
            <p className="text-gray-500 text-xs md:text-sm">Hola, {usuario?.nombre?.split(',')[0]}</p>
          </div>
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Furlong" width={80} height={30} className="object-contain hidden sm:block" />
            <button onClick={() => setMenuAbierto(!menuAbierto)} className="sm:hidden p-2 rounded-lg bg-white shadow text-gray-600">☰</button>
            <div className="hidden sm:flex items-center gap-1.5 md:gap-2">
              <a href="https://gamma.app/docs/Control-de-Asistencias-t9mqs084uhleedz" target="_blank" rel="noopener noreferrer" title="Ayuda" className="text-xs text-gray-500 hover:text-blue-600 px-1">❓</a>
              {[
                { key: 'calendario', icon: '📅', label: 'Calendario', action: () => setTab('calendario') },
                { key: 'misausencias', icon: '📋', label: 'Mis ausencias', action: () => setTab('misausencias') },
              ].map(t => (
                <button key={t.key} onClick={t.action} className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'}`}>
                  <span>{t.icon}</span>
                  <span className="hidden md:inline">{t.label}</span>
                </button>
              ))}
              {[
                { icon: '📊', label: 'Reportes', action: () => router.push('/reportes') },
                { icon: '👥', label: 'Usuarios', action: () => router.push('/usuarios') },
                { icon: '👤', label: 'Mi perfil', action: () => router.push('/perfil') },
              ].map((b, i) => (
                <button key={i} onClick={b.action} className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium bg-white text-blue-600 hover:bg-gray-100 shadow-sm transition">
                  <span>{b.icon}</span>
                  <span className="hidden md:inline">{b.label}</span>
                </button>
              ))}
              <button onClick={handleLogout} className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium bg-white text-red-500 hover:bg-gray-100 shadow-sm transition">
                <span>🚪</span>
                <span className="hidden md:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>

        {menuAbierto && (
          <div className="sm:hidden bg-white rounded-xl shadow p-4 mb-4 flex flex-col gap-3">
            <a href="https://gamma.app/docs/Control-de-Asistencias-t9mqs084uhleedz" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500">❓ Ayuda</a>
            <button onClick={() => { setTab('calendario'); setMenuAbierto(false) }} className="text-sm text-blue-600 text-left">📅 Calendario</button>
            <button onClick={() => { setTab('misausencias'); setMenuAbierto(false) }} className="text-sm text-blue-600 text-left">📋 Mis ausencias</button>
            <button onClick={() => { router.push('/perfil'); setMenuAbierto(false) }} className="text-sm text-blue-600 text-left">👤 Mi perfil</button>
            <button onClick={() => { router.push('/reportes'); setMenuAbierto(false) }} className="text-sm text-blue-600 text-left">📊 Reportes</button>
            <button onClick={() => { router.push('/usuarios'); setMenuAbierto(false) }} className="text-sm text-blue-600 text-left">👥 Usuarios</button>
            <button onClick={handleLogout} className="text-sm text-red-500 text-left">🚪 Cerrar sesion</button>
          </div>
        )}

        {tab === 'calendario' && (
          <>
            <div className="bg-white rounded-xl shadow px-4 py-3 mb-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Usuario</label>
                  <input type="text" value={busquedaUsuario} onChange={e => setBusquedaUsuario(e.target.value)} placeholder="Buscar por nombre..." className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-44" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de ausencia</label>
                  <select value={filtroMotivo} onChange={e => setFiltroMotivo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="todos">Todos</option>
                    {categorias.map(c => <option key={c.id} value={c.nombre}>{c.emoji} {c.nombre}</option>)}
                  </select>
                </div>
                <button onClick={() => { setModoFiltro(!modoFiltro); setFiltroDesde(''); setFiltroHasta('') }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${modoFiltro ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  Filtrar por fecha
                </button>
                {modoFiltro && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                      <input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                      <input type="date" value={filtroHasta} min={filtroDesde} onChange={e => setFiltroHasta(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </>
                )}
              </div>
            </div>

            {!modoFiltro && (
              <div className="flex items-center justify-between bg-white rounded-xl shadow px-4 py-3 mb-4">
                <button onClick={() => setSemanaOffset(s => s - 1)} className="text-blue-600 text-xs font-medium">← Anterior</button>
                <p className="text-gray-700 text-xs font-medium">{formatFecha(dias[0])} - {formatFecha(dias[14])}</p>
                <button onClick={() => setSemanaOffset(s => s + 1)} className="text-blue-600 text-xs font-medium">Siguiente →</button>
              </div>
            )}

            <div className="bg-white rounded-xl shadow overflow-x-auto">
              {(() => {
                const empConEventos = empleados
                  .filter(emp => !busquedaUsuario.trim() || emp.nombre?.toLowerCase().includes(busquedaUsuario.toLowerCase().trim()))
                  .filter(emp => diasMostrar.some(d => tieneAusencia(emp.id, d)))
                if (empConEventos.length === 0) {
                  return <p className="text-center text-gray-400 py-8">No hay ausencias en este periodo.</p>
                }
                return (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-3 py-2 text-gray-600 font-semibold min-w-28 sticky left-0 bg-gray-50 z-10">Fecha</th>
                        {empConEventos.map(emp => (
                          <th key={emp.id} className="px-2 py-2 text-gray-600 font-semibold text-center min-w-28">
                            <p>{emp.nombre.split(',')[0]}</p>
                            {emp.rol === 'supervisor' && <span className="text-purple-500 font-normal" style={{fontSize:'10px'}}>Supervisor</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {diasMostrar.map((d, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-600 sticky left-0 bg-white whitespace-nowrap z-10">{formatFecha(d)}</td>
                          {empConEventos.map(emp => {
                            const ausencia = tieneAusencia(emp.id, d)
                            const cat = ausencia ? getCat(ausencia.motivo) : null
                            const adjunto = ausencia ? getAdjunto(emp.id, d) : null
                            return (
                              <td key={emp.id} className="px-2 py-2 text-center">
                                {ausencia ? (
                                  <span
                                    className={cat.color + ' inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-75'}
                                    style={{fontSize:'10px'}}
                                    title="Clic para editar"
                                    onClick={() => abrirEditCal(ausencia)}
                                  >
                                    {cat.emoji} {ausencia.motivo}
                                    {adjunto && (
                                      <a href={adjunto.archivo_url} target="_blank" rel="noopener noreferrer" title={adjunto.archivo_nombre} onClick={e => e.stopPropagation()}>📎</a>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-gray-200">—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              })()}
            </div>
          </>
        )}

        {tab === 'misausencias' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow p-4 mb-4">
              <h2 className="text-base font-semibold text-gray-700 mb-3">Registrar ausencia</h2>
              <form onSubmit={handleSubmitAusencia} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Para</label>
                  <select value={paraColaborador ? empColaboradorId : ''} onChange={e => { if (e.target.value === '') { setParaColaborador(false); setEmpColaboradorId('') } else { setParaColaborador(true); setEmpColaboradorId(e.target.value) } }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white">
                    <option value="">Yo mismo</option>
                    {empleados.filter(e => e.id !== usuario?.id).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => { setUsarRangoAus(!usarRangoAus); setFechaHastaAus('') }} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${usarRangoAus ? 'bg-blue-600' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${usarRangoAus ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm font-medium text-gray-700">Rango de fechas</span>
                </div>
                <div className={`grid gap-3 ${usarRangoAus ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{usarRangoAus ? 'Desde' : 'Fecha'}</label>
                    <input type="date" value={fechaDesdeAus} onChange={e => setFechaDesdeAus(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                  </div>
                  {usarRangoAus && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Hasta</label>
                      <input type="date" value={fechaHastaAus} min={fechaDesdeAus} onChange={e => setFechaHastaAus(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required={usarRangoAus} />
                    </div>
                  )}
                </div>
                {fechaDesdeAus && (
                  <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700 font-medium">
                    {cantidadDiasAus()} dia{cantidadDiasAus() !== 1 ? 's' : ''} seleccionado{cantidadDiasAus() !== 1 ? 's' : ''}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Motivo</label>
                  <select value={motivoAus} onChange={e => setMotivoAus(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {categorias.map(c => <option key={c.id} value={c.nombre}>{c.emoji} {c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Descripcion (opcional)</label>
                  <textarea value={descripcionAus} onChange={e => setDescripcionAus(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Detalle adicional..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Adjunto (opcional)</label>
                  <input
                    id="archivo-input-sup"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={e => setArchivoAus(e.target.files[0] || null)}
                    className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {archivoAus && <p className="text-xs text-gray-400 mt-1">{archivoAus.name} ({(archivoAus.size / 1024).toFixed(0)} KB)</p>}
                </div>
                {mensajeAus && <p className={`text-sm font-medium px-3 py-2 rounded-lg ${mensajeAus.includes('Error') || mensajeAus.includes('Ya tenes') || mensajeAus.includes('no se pudo') ? 'text-red-700 bg-red-50 border border-red-200' : 'text-green-700 bg-green-50 border border-green-200'}`}>{mensajeAus}</p>}
                <button type="submit" disabled={loadingAus} className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition font-medium text-sm">
                  {loadingAus ? 'Registrando...' : usarRangoAus ? 'Registrar rango' : 'Registrar ausencia'}
                </button>
              </form>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="text-base font-semibold text-gray-700 mb-3">Historial de ausencias</h2>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Empleado</label>
                <select value={filtroEmpleadoAus} onChange={e => setFiltroEmpleadoAus(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-xs">
                  <option value="">Todos los empleados</option>
                  {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              {misAusencias.length === 0 ? (
                <p className="text-gray-400 text-sm">No hay ausencias registradas.</p>
              ) : (() => {
                const ausenciasFiltEmp = filtroEmpleadoAus ? misAusencias.filter(a => a.empleado_id === filtroEmpleadoAus) : misAusencias
                const mapa = {}
                ausenciasFiltEmp.forEach(a => {
                  const k = `${a.empleado_id}|${a.motivo}|${a.descripcion || ''}`
                  if (!mapa[k]) mapa[k] = []
                  mapa[k].push(a)
                })
                const grupos = []
                Object.values(mapa).forEach(registros => {
                  registros.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
                  let i = 0
                  while (i < registros.length) {
                    let j = i + 1
                    while (j < registros.length && (new Date(registros[j].fecha) - new Date(registros[j - 1].fecha)) <= 3 * 24 * 60 * 60 * 1000) { j++ }
                    const grupo = registros.slice(i, j)
                    grupos.push({ empleado_id: grupo[0].empleado_id, motivo: grupo[0].motivo, descripcion: grupo[0].descripcion, fechaDesde: grupo[0].fecha, fechaHasta: grupo[grupo.length - 1].fecha, dias: grupo.length, ids: grupo.map(a => a.id) })
                    i = j
                  }
                })
                grupos.sort((a, b) => new Date(b.fechaHasta) - new Date(a.fechaHasta))
                const gruposFiltrados = grupos.filter(g => {
                  if (misAusFiltroMotivo !== 'todos' && g.motivo !== misAusFiltroMotivo) return false
                  if (misAusFiltroDesde && g.fechaHasta < misAusFiltroDesde) return false
                  if (misAusFiltroHasta && g.fechaDesde > misAusFiltroHasta) return false
                  return true
                })
                return (
                  <>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <select value={misAusFiltroMotivo} onChange={e => setMisAusFiltroMotivo(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="todos">Todos los tipos</option>
                        {categorias.map(c => <option key={c.id} value={c.nombre}>{c.emoji} {c.nombre}</option>)}
                      </select>
                      <input type="date" value={misAusFiltroDesde} onChange={e => setMisAusFiltroDesde(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <input type="date" value={misAusFiltroHasta} min={misAusFiltroDesde} onChange={e => setMisAusFiltroHasta(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      {(misAusFiltroDesde || misAusFiltroHasta || misAusFiltroMotivo !== 'todos') && (
                        <button onClick={() => { setMisAusFiltroDesde(''); setMisAusFiltroHasta(''); setMisAusFiltroMotivo('todos') }} className="text-xs text-gray-400 hover:text-gray-600 underline">Limpiar</button>
                      )}
                    </div>
                    {gruposFiltrados.length === 0 && <p className="text-gray-400 text-sm">Sin resultados para los filtros aplicados.</p>}
                  <ul className="space-y-2">
                    {gruposFiltrados.map((g, idx) => {
                      const cat = getCat(g.motivo)
                      const esRango = g.dias > 1
                      const adjunto = adjuntosAus.find(a => a.empleado_id === g.empleado_id && a.fecha_desde === g.fechaDesde && a.motivo === g.motivo)
                      const editando = editandoAusIdx === idx
                      return (
                        <li key={idx} className="border-b pb-3">
                          {editando ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => { setEditAusUsarRango(!editAusUsarRango); setEditAusFechaHasta(editAusFechaDesde) }} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editAusUsarRango ? 'bg-blue-600' : 'bg-gray-200'}`}>
                                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${editAusUsarRango ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>
                                <span className="text-xs text-gray-600">Rango de fechas</span>
                              </div>
                              <div className={`grid gap-2 ${editAusUsarRango ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">{editAusUsarRango ? 'Desde' : 'Fecha'}</label>
                                  <input type="date" value={editAusFechaDesde} onChange={e => setEditAusFechaDesde(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                {editAusUsarRango && (
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                                    <input type="date" value={editAusFechaHasta} min={editAusFechaDesde} onChange={e => setEditAusFechaHasta(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                  </div>
                                )}
                              </div>
                              <select value={editAusMotivo} onChange={e => setEditAusMotivo(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {categorias.map(c => <option key={c.id} value={c.nombre}>{c.emoji} {c.nombre}</option>)}
                              </select>
                              <textarea value={editAusDescripcion} onChange={e => setEditAusDescripcion(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Descripcion (opcional)" />
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => setEditandoAusIdx(null)} className="text-xs text-gray-500 hover:underline">Cancelar</button>
                                <button onClick={() => handleGuardarEdicionAus(g.ids, g.empleado_id)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700">Guardar</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs font-semibold text-gray-700 mb-1">{empleados.find(e => e.id === g.empleado_id)?.nombre?.split(',')[0] || ''}</p>
                                <span className={cat.color + ' inline-block px-2 py-1 rounded-full text-xs font-medium'}>{cat.emoji} {g.motivo}</span>
                                {g.descripcion && <p className="text-xs text-gray-400 mt-1">{g.descripcion}</p>}
                                {esRango && <p className="text-xs text-gray-400 mt-0.5">{g.dias} dias</p>}
                                {adjunto ? (
                                  <a href={adjunto.archivo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                                    📎 {adjunto.archivo_nombre}
                                  </a>
                                ) : (
                                  <button onClick={() => handleAdjuntarArchivo(g, idx)} disabled={subiendoAdjIdx === idx} className="text-xs text-gray-400 hover:text-blue-500 mt-1 disabled:opacity-50">
                                    {subiendoAdjIdx === idx ? 'Subiendo...' : '📎 Adjuntar'}
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-2 shrink-0">
                                <span className="text-xs text-gray-500 text-right">
                                  {esRango ? new Date(g.fechaDesde + 'T12:00:00').toLocaleDateString('es-AR') + ' al ' + new Date(g.fechaHasta + 'T12:00:00').toLocaleDateString('es-AR') : new Date(g.fechaHasta + 'T12:00:00').toLocaleDateString('es-AR')}
                                </span>
                                <button onClick={() => { setEditandoAusIdx(idx); setEditAusMotivo(g.motivo); setEditAusDescripcion(g.descripcion || ''); setEditAusFechaDesde(g.fechaDesde); setEditAusFechaHasta(g.fechaHasta); setEditAusUsarRango(g.dias > 1) }} className="text-xs text-blue-500 hover:text-blue-700" title="Editar">✏️</button>
                                <button onClick={() => handleEliminarAus(g.ids)} className="text-xs text-red-400 hover:text-red-600" title="Eliminar">🗑️</button>
                              </div>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  </>
                )
              })()}
            </div>
          </div>
        )}

      </div>

      {editandoCal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-gray-800 mb-1">Editar ausencia</h3>
            <p className="text-xs text-gray-500 mb-4">{empleados.find(e => e.id === editandoCal.empleado_id)?.nombre?.split(',')[0]}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
                <input type="date" value={editCalFecha} onChange={e => setEditCalFecha(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Motivo</label>
                <select value={editCalMotivo} onChange={e => setEditCalMotivo(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {categorias.map(c => <option key={c.id} value={c.nombre}>{c.emoji} {c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descripcion</label>
                <textarea value={editCalDescripcion} onChange={e => setEditCalDescripcion(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Opcional..." />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleGuardarCalModal} disabled={editCalLoading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                {editCalLoading ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={handleEliminarCalModal} disabled={editCalLoading} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-50">
                Eliminar
              </button>
              <button onClick={() => setEditandoCal(null)} disabled={editCalLoading} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      <input ref={adjInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleArchivoAdjunto} />
    </main>
  )
}