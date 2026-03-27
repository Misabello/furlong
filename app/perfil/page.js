'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const DEPARTAMENTOS = ['MKT & PROD', 'BOOKING', 'CRUCEROS', 'USHUAIA', 'TRAFICO', 'MICE', 'ADM', 'SISTEMAS']

export default function Perfil() {
  const [usuario, setUsuario] = useState(null)
  const [form, setForm] = useState({ nombre: '', departamento: '', fecha_ingreso: '' })
  const [passwordForm, setPasswordForm] = useState({ nueva: '', confirmar: '' })
  const [mensaje, setMensaje] = useState('')
  const [mensajePass, setMensajePass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ total: 0, enfermedad: 0, vacaciones: 0, personal: 0, otro: 0 })
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data } = await supabase.from('usuarios').select('*').eq('id', user.id).single()
      setUsuario(data)
      setForm({ nombre: data.nombre || '', departamento: data.departamento || DEPARTAMENTOS[0], fecha_ingreso: data.fecha_ingreso || '' })
      const { data: ausencias } = await supabase.from('ausencias').select('motivo').eq('empleado_id', user.id)
      if (ausencias) {
        const s = { total: ausencias.length, enfermedad: 0, vacaciones: 0, personal: 0, otro: 0 }
        ausencias.forEach(a => { s[a.motivo] = (s[a.motivo] || 0) + 1 })
        setStats(s)
      }
    }
    init()
  }, [])

  const handleGuardar = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMensaje('')
    setError('')
    const { error } = await supabase.from('usuarios').update({ nombre: form.nombre, departamento: form.departamento, fecha_ingreso: form.fecha_ingreso || null }).eq('id', usuario?.id)
    if (error) { setError('Error al guardar los cambios.') } else { setMensaje('Perfil actualizado correctamente.') }
    setLoading(false)
  }

  const handleCambiarPassword = async (e) => {
    e.preventDefault()
    setMensajePass('')
    if (passwordForm.nueva !== passwordForm.confirmar) { setMensajePass('Las contrasenas no coinciden.'); return }
    if (passwordForm.nueva.length < 6) { setMensajePass('Minimo 6 caracteres.'); return }
    const { error } = await supabase.auth.updateUser({ password: passwordForm.nueva })
    if (error) { setMensajePass('Error al cambiar la contrasena.') } else { setMensajePass('Contrasena actualizada.'); setPasswordForm({ nueva: '', confirmar: '' }) }
  }

  const antiguedad = () => {
    if (!usuario?.fecha_ingreso) return null
    const totalMeses = (new Date().getFullYear() - new Date(usuario.fecha_ingreso).getFullYear()) * 12 + (new Date().getMonth() - new Date(usuario.fecha_ingreso).getMonth())
    return totalMeses < 12 ? totalMeses + ' meses' : Math.floor(totalMeses / 12) + ' anos'
  }

  const volverA = usuario?.rol === 'supervisor' ? '/supervisor' : '/empleado'
  if (!usuario) return <main className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-gray-500">Cargando...</p></main>

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Mi Perfil</h1>
            <p className="text-gray-500 text-sm">{usuario?.email}</p>
          </div>
          <button onClick={() => router.push(volverA)} className="text-sm text-blue-600 hover:underline">Volver</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[{label:'Total',valor:stats.total,color:'bg-gray-800'},{label:'Enfermedad',valor:stats.enfermedad,color:'bg-red-500'},{label:'Vacaciones',valor:stats.vacaciones,color:'bg-blue-500'},{label:'Personal',valor:stats.personal,color:'bg-yellow-500'}].map((s,i) => (
            <div key={i} className={s.color + ' text-white rounded-xl p-4 text-center shadow'}>
              <p className="text-3xl font-bold">{s.valor}</p>
              <p className="text-xs opacity-80 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
        {antiguedad() && (
          <div className="bg-white rounded-xl shadow p-4 mb-6 flex items-center gap-3">
            <span className="text-3xl">🏅</span>
            <div>
              <p className="font-semibold text-gray-700">Antiguedad en la empresa</p>
              <p className="text-gray-500 text-sm">{antiguedad()} desde {new Date(usuario?.fecha_ingreso).toLocaleDateString('es-AR')}</p>
            </div>
          </div>
        )}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Editar datos</h2>
          <form onSubmit={handleGuardar} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
              <input value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
              <select value={form.departamento} onChange={(e) => setForm({...form, departamento: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de ingreso</label>
              <input type="date" value={form.fecha_ingreso} onChange={(e) => setForm({...form, fecha_ingreso: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {mensaje && <p className="text-green-600 text-sm">{mensaje}</p>}
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium">
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Cambiar contrasena</h2>
          <form onSubmit={handleCambiarPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contrasena</label>
              <input type="password" value={passwordForm.nueva} onChange={(e) => setPasswordForm({...passwordForm, nueva: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min. 6 caracteres" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contrasena</label>
              <input type="password" value={passwordForm.confirmar} onChange={(e) => setPasswordForm({...passwordForm, confirmar: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min. 6 caracteres" required />
            </div>
            {mensajePass && <p className={mensajePass.includes('actualizada') ? 'text-green-600 text-sm' : 'text-red-500 text-sm'}>{mensajePass}</p>}
            <button type="submit" className="w-full bg-gray-800 text-white py-2 rounded-lg hover:bg-gray-900 transition font-medium">Cambiar contrasena</button>
          </form>
        </div>
      </div>
    </main>
  )
}
