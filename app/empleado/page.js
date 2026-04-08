'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { useCategorias } from '../../lib/useCategorias'
import Image from 'next/image'

export default function Empleado() {
  const [usuario, setUsuario] = useState(null)
  const [ausencias, setAusencias] = useState([])
  const [adjuntos, setAdjuntos] = useState([])
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [motivo, setMotivo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)
  const [usarRango, setUsarRango] = useState(false)
  const [misAusFiltroDesde, setMisAusFiltroDesde] = useState('')
  const [misAusFiltroHasta, setMisAusFiltroHasta] = useState('')
  const [misAusFiltroMotivo, setMisAusFiltroMotivo] = useState('todos')
  const { categorias } = useCategorias()
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const profileId = localStorage.getItem('furlong_profile_id') || user.id
      const { data } = await supabase.from('usuarios').select('*').eq('id', profileId).single()
      if (!data) { localStorage.removeItem('furlong_profile_id'); router.push('/seleccionar-perfil'); return }
      setUsuario(data)
      cargarAusencias(data.id)
      cargarAdjuntos(data.id)
    }
    init()
  }, [])

  useEffect(() => {
    if (categorias.length > 0 && !motivo) setMotivo(categorias[0].nombre)
  }, [categorias])

  const cargarAusencias = async (id) => {
    const { data } = await supabase.from('ausencias').select('*').eq('empleado_id', id).order('fecha', { ascending: false })
    setAusencias(data || [])
  }

  const cargarAdjuntos = async (id) => {
    const { data } = await supabase.from('adjuntos').select('*').eq('empleado_id', id)
    setAdjuntos(data || [])
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

  const cantidadDias = () => {
    if (!fechaDesde) return 0
    return generarFechas(fechaDesde, usarRango && fechaHasta ? fechaHasta : fechaDesde).length
  }

  const getBsasTime = () => {
    const now = new Date()
    now.setHours(now.getHours() - 3)
    return now
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMensaje('')
    const hasta = usarRango && fechaHasta ? fechaHasta : fechaDesde
    const fechas = generarFechas(fechaDesde, hasta)
    if (fechas.length === 0) { setLoading(false); return }
    const bsas = getBsasTime()
    const registros = fechas.map(f => ({ empleado_id: usuario.id, fecha: f, motivo, descripcion, fecha_carga: bsas.toISOString() }))
    const { data: conflictos, error: errConflictos } = await supabase.from('ausencias').select('fecha').eq('empleado_id', usuario.id).in('fecha', fechas)
    if (errConflictos) {
      setMensaje('Error al verificar ausencias existentes. Intentá de nuevo.')
      setLoading(false)
      return
    }
    if (conflictos.length > 0) {
      setMensaje('Ya tenes ausencias registradas en: ' + conflictos.map(c => new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR')).join(', '))
      setLoading(false)
      return
    }
    const { error } = await supabase.from('ausencias').insert(registros)
    if (error) {
      setMensaje('Error al registrar las ausencias.')
      setLoading(false)
      return
    }

    // Subir archivo si hay uno seleccionado
    if (archivo) {
      const fd = new FormData()
      fd.append('file', archivo)
      fd.append('empleadoId', usuario.id)
      fd.append('fechaDesde', fechaDesde)
      fd.append('fechaHasta', hasta)
      fd.append('motivo', motivo)
      const uploadRes = await fetch('/api/drive/upload', { method: 'POST', body: fd })
      const uploadData = await uploadRes.json()
      if (!uploadData.ok) {
        setMensaje('Ausencia registrada, pero no se pudo subir el archivo: ' + (uploadData.reason || 'error'))
      } else {
        setMensaje((fechas.length > 1 ? 'Se registraron ' + fechas.length + ' dias.' : 'Ausencia registrada.') + ' Archivo subido.')
      }
      cargarAdjuntos(usuario.id)
    } else {
      setMensaje(fechas.length > 1 ? 'Se registraron ' + fechas.length + ' dias.' : 'Ausencia registrada.')
    }

    if (usuario.supervisor_id) {
      const { data: sup } = await supabase.from('usuarios').select('email, nombre').eq('id', usuario.supervisor_id).single()
      if (sup) {
        await fetch('/api/notificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empleadoNombre: usuario.nombre, empleadoEmail: usuario.email, supervisorEmail: sup.email, fecha: fechas.length > 1 ? fechaDesde + ' al ' + hasta : fechaDesde, motivo, descripcion })
        })
      }
    }

    setFechaDesde('')
    setFechaHasta('')
    setDescripcion('')
    setArchivo(null)
    // Reset file input
    const fileInput = document.getElementById('archivo-input')
    if (fileInput) fileInput.value = ''
    cargarAusencias(usuario.id)

    fetch('/api/google/evento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: usuario.id, fechaDesde, fechaHasta: hasta, motivo, descripcion }),
    }).catch(() => {})

    setLoading(false)
  }

  const getCategoriaInfo = (nombre) => categorias.find(c => c.nombre === nombre) || { emoji: '📝', color: 'bg-gray-100 text-gray-600' }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!usuario) return <main className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-gray-500">Cargando...</p></main>

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4 md:mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Hola, {usuario?.nombre?.split(',')[0]}</h1>
            <p className="text-gray-500 text-xs md:text-sm">Registra tus ausencias</p>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <Image src="/logo.png" alt="Furlong" width={80} height={30} className="object-contain hidden sm:block" />
            <a href="https://gamma.app/docs/Control-de-Asistencias-t9mqs084uhleedz" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium bg-white text-gray-500 hover:bg-gray-100 shadow-sm transition">
              <span>❓</span>
              <span className="hidden md:inline">Ayuda</span>
            </a>
            <button onClick={() => router.push('/seleccionar-perfil')} className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium bg-white text-gray-600 hover:bg-gray-100 shadow-sm transition" title="Cambiar perfil">
              <span>🔄</span>
              <span className="hidden md:inline">Perfiles</span>
            </button>
            <button onClick={() => router.push('/perfil')} className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium bg-white text-blue-600 hover:bg-gray-100 shadow-sm transition">
              <span>👤</span>
              <span className="hidden md:inline">Mi perfil</span>
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium bg-white text-red-500 hover:bg-gray-100 shadow-sm transition">
              <span>🚪</span>
              <span className="hidden md:inline">Salir</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <h2 className="text-base font-semibold text-gray-700 mb-3">Nueva ausencia</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => { setUsarRango(!usarRango); setFechaHasta('') }} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${usarRango ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${usarRango ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm font-medium text-gray-700">Rango de fechas</span>
            </div>
            <div className={`grid gap-3 ${usarRango ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{usarRango ? 'Desde' : 'Fecha'}</label>
                <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              {usarRango && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Hasta</label>
                  <input type="date" value={fechaHasta} min={fechaDesde} onChange={e => setFechaHasta(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required={usarRango} />
                </div>
              )}
            </div>
            {fechaDesde && (
              <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700 font-medium">
                {cantidadDias()} dia{cantidadDias() !== 1 ? 's' : ''} seleccionado{cantidadDias() !== 1 ? 's' : ''}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Motivo</label>
              <select value={motivo} onChange={e => setMotivo(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white">
                {categorias.map(c => <option key={c.id} value={c.nombre}>{c.emoji} {c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Descripcion (opcional)</label>
              <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Detalle adicional..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Adjunto (opcional)</label>
              <input
                id="archivo-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={e => setArchivo(e.target.files[0] || null)}
                className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {archivo && <p className="text-xs text-gray-400 mt-1">{archivo.name} ({(archivo.size / 1024).toFixed(0)} KB)</p>}
            </div>
            {mensaje && <p className={`text-sm font-medium px-3 py-2 rounded-lg ${mensaje.includes('Error') || mensaje.includes('Ya tenes') || mensaje.includes('no se pudo') ? 'text-red-700 bg-red-50 border border-red-200' : 'text-green-700 bg-green-50 border border-green-200'}`}>{mensaje}</p>}
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition font-medium text-sm">
              {loading ? 'Registrando...' : usarRango ? 'Registrar rango' : 'Registrar ausencia'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-base font-semibold text-gray-700 mb-3">Mis ausencias</h2>
          {ausencias.length === 0 ? (
            <p className="text-gray-400 text-sm">No tenes ausencias registradas.</p>
          ) : (
            (() => {
              const mapa = {}
              ausencias.forEach(a => {
                const k = `${a.motivo}|${a.descripcion || ''}`
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
                  grupos.push({ motivo: grupo[0].motivo, descripcion: grupo[0].descripcion, fechaDesde: grupo[0].fecha, fechaHasta: grupo[grupo.length - 1].fecha, dias: grupo.length, ids: grupo.map(a => a.id) })
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
                    <select value={misAusFiltroMotivo} onChange={e => setMisAusFiltroMotivo(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white">
                      <option value="todos">Todos los tipos</option>
                      {categorias.map(c => <option key={c.id} value={c.nombre}>{c.emoji} {c.nombre}</option>)}
                    </select>
                    <input type="date" value={misAusFiltroDesde} onChange={e => setMisAusFiltroDesde(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Desde" />
                    <input type="date" value={misAusFiltroHasta} min={misAusFiltroDesde} onChange={e => setMisAusFiltroHasta(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Hasta" />
                    {(misAusFiltroDesde || misAusFiltroHasta || misAusFiltroMotivo !== 'todos') && (
                      <button onClick={() => { setMisAusFiltroDesde(''); setMisAusFiltroHasta(''); setMisAusFiltroMotivo('todos') }} className="text-xs text-gray-400 hover:text-gray-600 underline">Limpiar</button>
                    )}
                  </div>
                  {gruposFiltrados.length === 0 && <p className="text-gray-400 text-sm">Sin resultados para los filtros aplicados.</p>}
                  <ul className="space-y-2">
                    {gruposFiltrados.map((g, idx) => {
                      const cat = getCategoriaInfo(g.motivo)
                      const esRango = g.dias > 1
                      const adjunto = adjuntos.find(a => a.fecha_desde === g.fechaDesde && a.motivo === g.motivo)
                      return (
                        <li key={idx} className="border-b pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${cat.color}`}>{cat.emoji} {g.motivo}</span>
                              {g.descripcion && <p className="text-xs text-gray-400 mt-1">{g.descripcion}</p>}
                              {esRango && <p className="text-xs text-gray-400 mt-0.5">{g.dias} dias</p>}
                              {adjunto && (
                                <a href={adjunto.archivo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                                  📎 {adjunto.archivo_nombre}
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-2 shrink-0">
                              <span className="text-xs text-gray-500 text-right">
                                {esRango ? new Date(g.fechaDesde + 'T12:00:00').toLocaleDateString('es-AR') + ' al ' + new Date(g.fechaHasta + 'T12:00:00').toLocaleDateString('es-AR') : new Date(g.fechaHasta + 'T12:00:00').toLocaleDateString('es-AR')}
                              </span>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )
            })()
          )}
        </div>
      </div>
    </main>
  )
}
