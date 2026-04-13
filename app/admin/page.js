'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useCategorias } from '../../lib/useCategorias'
import Image from 'next/image'

export default function Admin() {
  const [usuario, setUsuario] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [adjuntosCalendario, setAdjuntosCalendario] = useState([])
  const [form, setForm] = useState({ nombre: '', email: '', password: '', departamento: '', fecha_ingreso: '', rol: 'empleado', vacaciones_saldo_anterior: '', francos_saldo_anterior: '' })
  const [editando, setEditando] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('calendario')
  const [semanaOffset, setSemanaOffset] = useState(0)
  const [filtroDept, setFiltroDept] = useState('Todos')
  const [filtroMotivo, setFiltroMotivo] = useState('todos')
  const [busquedaUsuario, setBusquedaUsuario] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [modoFiltro, setModoFiltro] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [fechaDesdeAus, setFechaDesdeAus] = useState('')
  const [fechaHastaAus, setFechaHastaAus] = useState('')
  const [motivoAus, setMotivoAus] = useState('')
  const [descripcionAus, setDescripcionAus] = useState('')
  const [usarRangoAus, setUsarRangoAus] = useState(false)
  const [mensajeAus, setMensajeAus] = useState('')
  const [loadingAus, setLoadingAus] = useState(false)
  const [misAusencias, setMisAusencias] = useState([])
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
  const [misAusFiltroDesde, setMisAusFiltroDesde] = useState('')
  const [misAusFiltroHasta, setMisAusFiltroHasta] = useState('')
  const [misAusFiltroMotivo, setMisAusFiltroMotivo] = useState('todos')
  const [editandoCal, setEditandoCal] = useState(null)
  const [editCalMotivo, setEditCalMotivo] = useState('')
  const [editCalDescripcion, setEditCalDescripcion] = useState('')
  const [editCalFecha, setEditCalFecha] = useState('')
  const [editCalLoading, setEditCalLoading] = useState(false)
  const [paraColaborador, setParaColaborador] = useState(false)
  const [empColaboradorId, setEmpColaboradorId] = useState('')
  const [bajaUsuarioId, setBajaUsuarioId] = useState(null)
  const [bajaFecha, setBajaFecha] = useState('')
  const { categorias } = useCategorias()
  const router = useRouter()
  const [tablaFiltroNombre, setTablaFiltroNombre] = useState('')
  const [tablaFiltroEmail, setTablaFiltroEmail] = useState('')
  const [tablaFiltroDept, setTablaFiltroDept] = useState('')
  const [tablaFiltroRol, setTablaFiltroRol] = useState('')
  const [tablaFiltroEstado, setTablaFiltroEstado] = useState('')
  const [tablaSortCol, setTablaSortCol] = useState('nombre')
  const [tablaSortDir, setTablaSortDir] = useState('asc')
  const [filtroEmpleadoAus, setFiltroEmpleadoAus] = useState('')

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
  const formatFecha = (d) => d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
  const getCat = (nombre) => categorias.find(c => c.nombre === nombre) || { emoji: '📝', color: 'bg-gray-100 text-gray-600' }

  const getBsasTime = () => {
    const now = new Date()
    now.setHours(now.getHours() - 3)
    return now
  }

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
      const { data } = await supabase.from('usuarios').select('*').eq('id', user.id).single()
      if (data?.rol !== 'admin') { router.push('/'); return }
      setUsuario(data)
      const users = await cargarUsuarios()
      cargarDepartamentos()
      cargarMisAusencias(users.map(u => u.id))
    }
    init()
  }, [])

  useEffect(() => {
    if (categorias.length > 0 && !motivoAus) setMotivoAus(categorias[0].nombre)
  }, [categorias])

  useEffect(() => {
    if (usuarios.length === 0) return
    const ids = usuarios.map(u => u.id)
    let query = supabase.from('ausencias').select('*').in('empleado_id', ids).gte('fecha', fechaInicio).lte('fecha', fechaFin)
    if (filtroMotivo !== 'todos') query = query.eq('motivo', filtroMotivo)
    query.then(({ data }) => setAusencias(data || []))
    fetch(`/api/adjuntos?empleadoIds=${ids.join(',')}`).then(r => r.json()).then(data => setAdjuntosCalendario(data || []))
  }, [usuarios, semanaOffset, filtroMotivo, filtroDesde, filtroHasta, modoFiltro])

  const cargarUsuarios = async () => {
    const { data } = await supabase.from('usuarios').select('*').order('nombre')
    setUsuarios(data || [])
    return data || []
  }

  const cargarDepartamentos = async () => {
    const { data } = await supabase.from('departamentos').select('*').order('nombre')
    setDepartamentos(data || [])
  }

  const cargarMisAusencias = async (userIds) => {
    const ids = userIds || []
    const [{ data }, adj] = await Promise.all([
      supabase.from('ausencias').select('*').order('fecha', { ascending: false }),
      ids.length > 0 ? fetch(`/api/adjuntos?empleadoIds=${ids.join(',')}`).then(r => r.json()) : Promise.resolve([])
    ])
    setMisAusencias(data || [])
    setAdjuntosAus(adj || [])
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
    if (error) { setMensajeAus('Error al registrar.') }
    else {
      setMensajeAus(fechas.length > 1 ? 'Se registraron ' + fechas.length + ' dias.' : 'Ausencia registrada.')
      setFechaDesdeAus('')
      setFechaHastaAus('')
      setDescripcionAus('')
      cargarMisAusencias(usuarios.map(u => u.id))
      fetch('/api/google/evento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: destinatarioId, fechaDesde: fechaDesdeAus, fechaHasta: hasta, motivo: motivoAus, descripcion: descripcionAus }),
      }).catch(() => {})
    }
    setLoadingAus(false)
  }

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
    await cargarMisAusencias(usuarios.map(u => u.id))
    setSubiendoAdjIdx(null)
    setAdjGrupoActual(null)
    e.target.value = ''
  }

  const tieneAusencia = (empleadoId, fecha) => {
    const fechaStr = toLocalISO(fecha)
    return ausencias.find(a => a.empleado_id === empleadoId && a.fecha === fechaStr)
  }

  const getAdjunto = (empleadoId, fecha) => {
    const fechaStr = toLocalISO(fecha)
    return adjuntosCalendario.find(a => a.empleado_id === empleadoId && a.fecha_desde <= fechaStr && (a.fecha_hasta || a.fecha_desde) >= fechaStr)
  }

  const empleadosFiltrados = usuarios.filter(u => {
    if (filtroDept !== 'Todos' && u.departamento !== filtroDept) return false
    if (busquedaUsuario.trim() && !u.nombre?.toLowerCase().includes(busquedaUsuario.toLowerCase().trim())) return false
    return true
  })

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
        fecha_ingreso: form.fecha_ingreso || null, supervisor_id,
        vacaciones_saldo_anterior: form.vacaciones_saldo_anterior !== '' ? Number(form.vacaciones_saldo_anterior) : null,
        francos_saldo_anterior: form.francos_saldo_anterior !== '' ? Number(form.francos_saldo_anterior) : null
      }).eq('id', editando)
      if (error) { setError('Error al actualizar.') }
      else { setMensaje('Usuario actualizado.'); setEditando(null); resetForm() }
    } else {
      const res = await fetch('/api/crear-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password, nombre: form.nombre, rol: form.rol, departamento: form.departamento, fecha_ingreso: form.fecha_ingreso, supervisor_id, vacaciones_saldo_anterior: form.vacaciones_saldo_anterior !== '' ? Number(form.vacaciones_saldo_anterior) : null, francos_saldo_anterior: form.francos_saldo_anterior !== '' ? Number(form.francos_saldo_anterior) : null })
      })
      const result = await res.json()
      if (!result.ok) { setError('Error: ' + result.error); setLoading(false); return }
      setMensaje('Usuario creado.')
      resetForm()
    }
    cargarUsuarios()
    setLoading(false)
  }

  const handleEditar = (u) => {
    setEditando(u.id)
    setForm({ nombre: u.nombre || '', email: u.email || '', password: '', departamento: u.departamento || '', fecha_ingreso: u.fecha_ingreso ? u.fecha_ingreso.slice(0, 10) : '', rol: u.rol || 'empleado', vacaciones_saldo_anterior: u.vacaciones_saldo_anterior ?? '', francos_saldo_anterior: u.francos_saldo_anterior ?? '' })
    setTab('usuarios')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEliminar = async (id) => {
    if (!confirm('Seguro que queres eliminar este usuario? Se borrarán todas sus ausencias.')) return
    const res = await fetch('/api/eliminar-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    })
    const data = await res.json()
    if (!data.ok) {
      alert('Error al eliminar: ' + data.error)
    }
    cargarUsuarios()
  }

  const handleDarDeBaja = async (id) => {
    if (!bajaFecha) { alert('Selecciona una fecha de baja.'); return }
    await supabase.from('usuarios').update({ fecha_baja: bajaFecha }).eq('id', id)
    setBajaUsuarioId(null)
    setBajaFecha('')
    cargarUsuarios()
  }

  const handleReactivar = async (id) => {
    if (!confirm('Reactivar este usuario?')) return
    await supabase.from('usuarios').update({ fecha_baja: null }).eq('id', id)
    cargarUsuarios()
  }

  const handleEditarDept = async (id, campo, valor) => {
    await supabase.from('departamentos').update({ [campo]: valor }).eq('id', id)
    cargarDepartamentos()
  }

  const resetForm = () => setForm({ nombre: '', email: '', password: '', departamento: '', fecha_ingreso: '', rol: 'empleado', vacaciones_saldo_anterior: '', francos_saldo_anterior: '' })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleEliminarAus = async (ids) => {
    if (!confirm('¿Eliminar esta ausencia?')) return
    await supabase.from('ausencias').delete().in('id', ids)
    cargarMisAusencias(usuarios.map(u => u.id))
  }

  const handleGuardarEdicionAus = async (ids, empleadoId) => {
    const hasta = editAusUsarRango && editAusFechaHasta ? editAusFechaHasta : editAusFechaDesde
    const nuevasFechas = generarFechas(editAusFechaDesde, hasta)
    if (nuevasFechas.length === 0) return
    const { data: conflictos, error: errConflictos } = await supabase.from('ausencias').select('fecha, id').eq('empleado_id', empleadoId).in('fecha', nuevasFechas)
    if (errConflictos) { setMensajeAus('Error al verificar ausencias. Intentá de nuevo.'); return }
    const reales = conflictos.filter(c => !ids.includes(c.id))
    if (reales.length > 0) {
      setMensajeAus('Ya tenes ausencias en: ' + reales.map(c => new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR')).join(', '))
      return
    }
    const bsas = getBsasTime()
    await supabase.from('ausencias').delete().in('id', ids)
    await supabase.from('ausencias').insert(
      nuevasFechas.map(f => ({ empleado_id: empleadoId, fecha: f, motivo: editAusMotivo, descripcion: editAusDescripcion, fecha_carga: bsas.toISOString() }))
    )
    setEditandoAusIdx(null)
    cargarMisAusencias(usuarios.map(u => u.id))
  }

  const recargarAusencias = async () => {
    const ids = usuarios.map(u => u.id)
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

  const supervisores = usuarios.filter(u => u.rol === 'supervisor' || u.rol === 'admin')
  const rolColor = { admin: 'bg-red-100 text-red-700', supervisor: 'bg-purple-100 text-purple-700', empleado: 'bg-blue-100 text-blue-700' }
  const deptos = ['Todos', ...departamentos.map(d => d.nombre)]
  const handleSort = (col) => {
    if (tablaSortCol === col) { setTablaSortDir(d => d === 'asc' ? 'desc' : 'asc') }
    else { setTablaSortCol(col); setTablaSortDir('asc') }
  }
  const usuariosOrdenados = [...usuarios]
    .filter(u => {
      if (tablaFiltroNombre && !u.nombre?.toLowerCase().includes(tablaFiltroNombre.toLowerCase())) return false
      if (tablaFiltroEmail && !u.email?.toLowerCase().includes(tablaFiltroEmail.toLowerCase())) return false
      if (tablaFiltroDept && !u.departamento?.toLowerCase().includes(tablaFiltroDept.toLowerCase())) return false
      if (tablaFiltroRol && u.rol !== tablaFiltroRol) return false
      if (tablaFiltroEstado === 'activo' && u.fecha_baja) return false
      if (tablaFiltroEstado === 'baja' && !u.fecha_baja) return false
      return true
    })
    .sort((a, b) => {
      const va = (a[tablaSortCol] || '').toString().toLowerCase()
      const vb = (b[tablaSortCol] || '').toString().toLowerCase()
      return tablaSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })

  if (!usuario) return <main className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-gray-500">Cargando...</p></main>

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        <div className="flex justify-between items-center mb-4 md:mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Panel Admin</h1>
            <p className="text-gray-500 text-xs md:text-sm">Hola, {usuario.nombre?.split(',')[0]}</p>
          </div>
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Furlong" width={80} height={30} className="object-contain hidden sm:block" />
            <button onClick={() => setMenuAbierto(!menuAbierto)} className="sm:hidden p-2 rounded-lg bg-white shadow text-gray-600">☰</button>
            <div className="hidden sm:flex items-center gap-1.5 md:gap-2">
              <a href="https://gamma.app/docs/Control-de-Asistencias-t9mqs084uhleedz" target="_blank" rel="noopener noreferrer" title="Ayuda" className="text-xs text-gray-500 hover:text-blue-600 px-1">❓</a>
              {[
                { key: 'calendario', icon: '📅', label: 'Calendario' },
                { key: 'misausencias', icon: '📋', label: 'Mis ausencias' },
                { key: 'usuarios', icon: '👥', label: 'Usuarios' },
                { key: 'departamentos', icon: '🏢', label: 'Departamentos' },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'}`}>
                  <span>{t.icon}</span>
                  <span className="hidden md:inline">{t.label}</span>
                </button>
              ))}
              {[
                { icon: '🏷️', label: 'Categorias', action: () => router.push('/categorias') },
                { icon: '📊', label: 'Reportes', action: () => router.push('/reportes') },
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
            {[
              { key: 'calendario', label: '📅 Calendario' },
              { key: 'misausencias', label: '📋 Mis ausencias' },
              { key: 'usuarios', label: '👥 Usuarios' },
              { key: 'departamentos', label: '🏢 Departamentos' },
            ].map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setMenuAbierto(false) }} className={`text-sm text-left px-3 py-2 rounded-lg ${tab === t.key ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600'}`}>{t.label}</button>
            ))}
            <button onClick={() => { router.push('/categorias'); setMenuAbierto(false) }} className="text-sm text-blue-600 text-left">🏷️ Categorias</button>
            <button onClick={() => { router.push('/reportes'); setMenuAbierto(false) }} className="text-sm text-blue-600 text-left">📊 Reportes</button>
            <button onClick={() => { router.push('/perfil'); setMenuAbierto(false) }} className="text-sm text-blue-600 text-left">👤 Mi perfil</button>
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
                  <label className="block text-xs font-medium text-gray-500 mb-1">Departamento</label>
                  <select value={filtroDept} onChange={e => setFiltroDept(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {deptos.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
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
                const empConEventos = empleadosFiltrados.filter(emp => diasMostrar.some(d => tieneAusencia(emp.id, d)))
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
                            {emp.rol === 'admin' && <span className="text-red-500 font-normal" style={{fontSize:'10px'}}>Admin</span>}
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
                    {usuarios.filter(u => u.id !== usuario?.id).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
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
                {mensajeAus && <p className={`text-sm font-medium px-3 py-2 rounded-lg ${mensajeAus.includes('Error') || mensajeAus.includes('Ya tenes') ? 'text-red-700 bg-red-50 border border-red-200' : 'text-green-700 bg-green-50 border border-green-200'}`}>{mensajeAus}</p>}
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
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </div>
              {misAusencias.length === 0 ? (
                <p className="text-gray-400 text-sm">No hay ausencias registradas.</p>
              ) : (() => {
                const hoy = toLocalISO(new Date())
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
                      const esFutura = g.fechaHasta >= hoy
                      const editando = editandoAusIdx === idx
                      const adjunto = adjuntosAus.find(a => a.empleado_id === g.empleado_id && a.fecha_desde === g.fechaDesde && a.motivo === g.motivo)
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
                              <select value={editAusMotivo} onChange={e => setEditAusMotivo(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                                <p className="text-xs font-semibold text-gray-700 mb-1">{usuarios.find(u => u.id === g.empleado_id)?.nombre?.split(',')[0] || ''}</p>
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
                                {esFutura && (
                                  <>
                                    <button onClick={() => { setEditandoAusIdx(idx); setEditAusMotivo(g.motivo); setEditAusDescripcion(g.descripcion || ''); setEditAusFechaDesde(g.fechaDesde); setEditAusFechaHasta(g.fechaHasta); setEditAusUsarRango(g.dias > 1) }} className="text-xs text-blue-500 hover:text-blue-700" title="Editar">✏️</button>
                                    <button onClick={() => handleEliminarAus(g.ids)} className="text-xs text-red-400 hover:text-red-600" title="Eliminar">🗑️</button>
                                  </>
                                )}
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

        {tab === 'usuarios' && (
          <>
            <div className="bg-white rounded-xl shadow p-4 mb-4">
              <h2 className="text-base font-semibold text-gray-700 mb-3">{editando ? 'Editar usuario' : 'Nuevo usuario'}</h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo</label>
                  <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Juan Perez" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} disabled={!!editando} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" required={!editando} />
                </div>
                {!editando && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Contrasena</label>
                    <input type="password" autoComplete="new-password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ingresá una contraseña" required={!editando} />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Departamento</label>
                  <select value={form.departamento} onChange={e => setForm({...form, departamento: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Sin departamento</option>
                    {departamentos.map(d => <option key={d.id} value={d.nombre}>{d.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de ingreso</label>
                  <input type="date" value={form.fecha_ingreso} onChange={e => setForm({...form, fecha_ingreso: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rol</label>
                  <select value={form.rol} onChange={e => setForm({...form, rol: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="empleado">Empleado</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Vac. adeudadas pre-sistema <span className="text-gray-400 font-normal">(días no tomados antes de la app)</span></label>
                  <input type="number" min="0" step="0.5" value={form.vacaciones_saldo_anterior} onChange={e => setForm({...form, vacaciones_saldo_anterior: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Francos adeudados pre-sistema <span className="text-gray-400 font-normal">(francos a favor acumulados antes de la app)</span></label>
                  <input type="number" min="0" step="0.5" value={form.francos_saldo_anterior} onChange={e => setForm({...form, francos_saldo_anterior: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
                </div>
                {mensaje && <p className="text-green-600 text-xs sm:col-span-2">{mensaje}</p>}
                {error && <p className="text-red-500 text-xs sm:col-span-2">{error}</p>}
                <div className="sm:col-span-2 flex gap-3 justify-end">
                  {editando && <button type="button" onClick={() => { setEditando(null); resetForm() }} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm">Cancelar</button>}
                  <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                    {loading ? 'Guardando...' : editando ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50">
                    {[{key:'nombre',label:'Nombre'},{key:'email',label:'Email',cls:'hidden sm:table-cell'},{key:'departamento',label:'Depto.',cls:'hidden sm:table-cell'},{key:'rol',label:'Rol'}].map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)} className={`text-left px-3 py-2 text-gray-600 font-semibold cursor-pointer select-none hover:bg-gray-100 ${col.cls || ''}`}>
                        {col.label} {tablaSortCol === col.key ? (tablaSortDir === 'asc' ? '↑' : '↓') : <span className="text-gray-300">↕</span>}
                      </th>
                    ))}
                    <th className="text-left px-3 py-2 text-gray-600 font-semibold">Estado</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                  <tr className="border-b bg-white">
                    <td className="px-2 py-1"><input value={tablaFiltroNombre} onChange={e => setTablaFiltroNombre(e.target.value)} placeholder="Filtrar..." className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" /></td>
                    <td className="px-2 py-1 hidden sm:table-cell"><input value={tablaFiltroEmail} onChange={e => setTablaFiltroEmail(e.target.value)} placeholder="Filtrar..." className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" /></td>
                    <td className="px-2 py-1 hidden sm:table-cell"><input value={tablaFiltroDept} onChange={e => setTablaFiltroDept(e.target.value)} placeholder="Filtrar..." className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" /></td>
                    <td className="px-2 py-1">
                      <select value={tablaFiltroRol} onChange={e => setTablaFiltroRol(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="">Todos</option>
                        <option value="admin">Admin</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="empleado">Empleado</option>
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <select value={tablaFiltroEstado} onChange={e => setTablaFiltroEstado(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="">Todos</option>
                        <option value="activo">Activo</option>
                        <option value="baja">De baja</option>
                      </select>
                    </td>
                    <td></td>
                  </tr>
                </thead>
                <tbody>
                  {usuariosOrdenados.map(u => (
                    <tr key={u.id} className={`border-b hover:bg-gray-50 ${u.fecha_baja ? 'opacity-60 bg-gray-50' : ''}`}>
                      <td className="px-3 py-2 font-medium text-gray-700">{u.nombre.split(',')[0]}</td>
                      <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">{u.email}</td>
                      <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">{u.departamento || '-'}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rolColor[u.rol]}`}>{u.rol}</span></td>
                      <td className="px-3 py-2">
                        {u.fecha_baja
                          ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Baja {new Date(u.fecha_baja + 'T12:00:00').toLocaleDateString('es-AR')}</span>
                          : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Activo</span>
                        }
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => handleEditar(u)} className="text-blue-600 hover:underline">Editar</button>
                            <button onClick={() => handleEliminar(u.id)} className="text-red-500 hover:underline">Eliminar</button>
                            {u.fecha_baja
                              ? <button onClick={() => handleReactivar(u.id)} className="text-green-600 hover:underline">Reactivar</button>
                              : <button onClick={() => { setBajaUsuarioId(u.id); setBajaFecha('') }} className="text-orange-600 hover:underline">Dar de baja</button>
                            }
                          </div>
                          {bajaUsuarioId === u.id && (
                            <div className="flex gap-2 items-center mt-1">
                              <input type="date" value={bajaFecha} onChange={e => setBajaFecha(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs" />
                              <button onClick={() => handleDarDeBaja(u.id)} className="text-xs bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700">Confirmar</button>
                              <button onClick={() => setBajaUsuarioId(null)} className="text-xs text-gray-500 hover:underline">Cancelar</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'departamentos' && (
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">Departamento</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">Supervisor</th>
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


      </div>

      {editandoCal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-gray-800 mb-1">Editar ausencia</h3>
            <p className="text-xs text-gray-500 mb-4">{usuarios.find(u => u.id === editandoCal.empleado_id)?.nombre?.split(',')[0]}</p>
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