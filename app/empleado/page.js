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
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [motivo, setMotivo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)
  const [usarRango, setUsarRango] = useState(false)
  const { categorias } = useCategorias()
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data } = await supabase.from('usuarios').select('*').eq('id', user.id).single()
      setUsuario(data)
      cargarAusencias(user.id)
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

  const generarFechas = (desde, hasta) => {
    const fechas = []
    const current = new Date(desde)
    const end = new Date(hasta)
    while (current <= end) {
      const diaSemana = current.getDay()
      if (diaSemana !== 0 && diaSemana !== 6) fechas.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }
    return fechas
  }

  const cantidadDias = () => {
    if (!fechaDesde) return 0
    return generarFechas(fechaDesde, usarRango && fechaHasta ? fechaHasta : fechaDesde).length
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMensaje('')
    const hasta = usarRango && fechaHasta ? fechaHasta : fechaDesde
    const fechas = generarFechas(fechaDesde, hasta)
    if (fechas.length === 0) { setMensaje('El rango no incluye dias habiles.'); setLoading(false); return }
    const now = new Date()
    const bsas = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
    const registros = fechas.map(f => ({ empleado_id: usuario.id, fecha: f, motivo, descripcion, fecha_carga: bsas.toISOString() }))
    const { error } = await supabase.from('ausencias').insert(registros)
    if (error) {
      setMensaje('Error al registrar las ausencias.')
    } else {
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
      setMensaje(fechas.length > 1 ? 'Se registraron ' + fechas.length + ' dias.' : 'Ausencia registrada.')
      setFechaDesde('')
      setFechaHasta('')
      setDescripcion('')
      cargarAusencias(usuario.id)
    }
    setLoading(false)
  }

  const getCategoriaInfo = (nombre) => categorias.find(c => c.nombre === nombre) || { emoji: '📝', color: 'bg-gray-100 text-gray-600' }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!usuario) return <main className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-gray-500">Cargando...</p></main>

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header mobile-friendly */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Hola, {usuario?.nombre?.split(',')[0]}</h1>
            <p className="text-gray-500 text-xs">Registra tus ausencias</p>
          </div>
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Furlong" width={80} height={30} className="object-contain hidden sm:block" />
            <a href="https://gamma.app/docs/Control-de-Asistencias-t9mqs084uhleedz" target="_blank" rel="noopener noreferrer" title="Ayuda" className="text-xs text-gray-500 hover:text-blue-600">❓</a>
            <button onClick={() => router.push('/perfil')} title="Mi perfil" className="text-xs text-blue-600 hover:underline">👤</button>
            <button onClick={handleLogout} title="Cerrar sesion" className="text-xs text-red-500 hover:underline">🚪</button>
          </div>
        </div>

        {/* Formulario */}
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
                {cantidadDias()} dia{cantidadDias() !== 1 ? 's' : ''} habil{cantidadDias() !== 1 ? 'es' : ''} seleccionado{cantidadDias() !== 1 ? 's' : ''}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Motivo</label>
              <select value={motivo} onChange={e => setMotivo(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {categorias.map(c => <option key={c.id} value={c.nombre}>{c.emoji} {c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Descripcion (opcional)</label>
              <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Detalle adicional..." />
            </div>
            {mensaje && <p className={mensaje.includes('Error') ? 'text-red-500 text-xs' : 'text-green-600 text-xs'}>{mensaje}</p>}
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition font-medium text-sm">
              {loading ? 'Registrando...' : usarRango ? 'Registrar rango' : 'Registrar ausencia'}
            </button>
          </form>
        </div>

        {/* Historial */}
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-base font-semibold text-gray-700 mb-3">Mis ausencias</h2>
          {ausencias.length === 0 ? (
            <p className="text-gray-400 text-sm">No tenes ausencias registradas.</p>
          ) : (
            (() => {
              const grupos = []
              let i = 0
              const sorted = [...ausencias].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
              while (i < sorted.length) {
                const current = sorted[i]
                let j = i + 1
                while (j < sorted.length && sorted[j].motivo === current.motivo && sorted[j].descripcion === current.descripcion && (new Date(sorted[j - 1].fecha) - new Date(sorted[j].fecha)) <= 3 * 24 * 60 * 60 * 1000) { j++ }
                const grupo = sorted.slice(i, j)
                grupos.push({ motivo: current.motivo, descripcion: current.descripcion, fechaDesde: grupo[grupo.length - 1].fecha, fechaHasta: grupo[0].fecha, dias: grupo.length })
                i = j
              }
              return (
                <ul className="space-y-2">
                  {grupos.map((g, idx) => {
                    const cat = getCategoriaInfo(g.motivo)
                    const esRango = g.dias > 1
                    return (
                      <li key={idx} className="flex justify-between items-start border-b pb-2">
                        <div>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${cat.color}`}>{cat.emoji} {g.motivo}</span>
                          {g.descripcion && <p className="text-xs text-gray-400 mt-1">{g.descripcion}</p>}
                          {esRango && <p className="text-xs text-gray-400 mt-0.5">{g.dias} dias habiles</p>}
                        </div>
                        <span className="text-xs text-gray-500 ml-2 text-right shrink-0">
                          {esRango ? new Date(g.fechaDesde).toLocaleDateString('es-AR') + ' al ' + new Date(g.fechaHasta).toLocaleDateString('es-AR') : new Date(g.fechaHasta).toLocaleDateString('es-AR')}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )
            })()
          )}
        </div>
      </div>
    </main>
  )
}