'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Perfil() {
  const [usuario, setUsuario] = useState(null)
  const [passwordForm, setPasswordForm] = useState({ nueva: '', confirmar: '' })
  const [mensajePass, setMensajePass] = useState('')
  const [stats, setStats] = useState({ total: 0, enfermedad: 0, vacaciones: 0, personal: 0 })
  const [googleMsg, setGoogleMsg] = useState('')
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/'); return }
      const { data } = await supabase.from('usuarios').select('*').eq('id', user.id).single()
      setUsuario(data)
      const { data: ausencias } = await supabase.from('ausencias').select('motivo').eq('empleado_id', user.id)
      if (ausencias) {
        const s = { total: ausencias.length, enfermedad: 0, vacaciones: 0, personal: 0 }
        ausencias.forEach(a => { s[a.motivo] = (s[a.motivo] || 0) + 1 })
        setStats(s)
      }
      // Mostrar mensaje si viene del callback de Google
      const params = new URLSearchParams(window.location.search)
      if (params.get('google') === 'connected') setGoogleMsg('Google Calendar conectado correctamente.')
      if (params.get('google') === 'error') setGoogleMsg('Error al conectar Google Calendar. Intenta de nuevo.')
    }
    init()
  }, [])

  const handleConectarGoogle = () => {
    window.location.href = `/api/google/auth?userId=${usuario?.id}`
  }

  const handleDesconectarGoogle = async () => {
    await fetch('/api/google/desconectar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: usuario?.id }),
    })
    setUsuario(prev => prev ? { ...prev, google_access_token: null, google_refresh_token: null, google_token_expiry: null } : null)
    setGoogleMsg('Google Calendar desconectado.')
  }

  const handleCambiarPassword = async (e) => {
    e.preventDefault()
    setMensajePass('')
    if (passwordForm.nueva !== passwordForm.confirmar) { setMensajePass('Las contrasenas no coinciden.'); return }
    if (passwordForm.nueva.length < 6) { setMensajePass('Minimo 6 caracteres.'); return }
    const { error } = await supabase.auth.updateUser({ password: passwordForm.nueva })
    if (error) { setMensajePass('Error al cambiar la contrasena.') }
    else { setMensajePass('Contrasena actualizada correctamente.'); setPasswordForm({ nueva: '', confirmar: '' }) }
  }

  const antiguedad = () => {
    if (!usuario?.fecha_ingreso) return null
    const totalMeses = (new Date().getFullYear() - new Date(usuario.fecha_ingreso).getFullYear()) * 12 + (new Date().getMonth() - new Date(usuario.fecha_ingreso).getMonth())
    return totalMeses < 12 ? totalMeses + ' meses' : Math.floor(totalMeses / 12) + ' ano(s)'
  }

  const volverA = usuario?.rol === 'admin' ? '/admin' : usuario?.rol === 'supervisor' ? '/supervisor' : '/empleado'

  if (!usuario) return <main className="min-h-screen bg-gray-100 flex items-center justify-center"><p className="text-gray-500">Cargando...</p></main>

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Mi Perfil</h1>
            <p className="text-gray-500 text-sm">{usuario.email}</p>
          </div>
          <button onClick={() => router.push(volverA)} className="text-sm text-blue-600 hover:underline">Volver</button>
        </div>

        {/* Info readonly */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Mis datos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Nombre</p>
              <p className="font-medium text-gray-700">{usuario.nombre}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Departamento</p>
              <p className="font-medium text-gray-700">{usuario.departamento || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Fecha de ingreso</p>
              <p className="font-medium text-gray-700">{usuario.fecha_ingreso ? new Date(usuario.fecha_ingreso).toLocaleDateString('es-AR') : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Antiguedad</p>
              <p className="font-medium text-gray-700">{antiguedad() || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Rol</p>
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${usuario.rol === 'supervisor' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {usuario.rol === 'supervisor' ? 'Supervisor' : 'Empleado'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total ausencias', valor: stats.total, color: 'bg-gray-800' },
            { label: 'Enfermedad', valor: stats.enfermedad, color: 'bg-red-500' },
            { label: 'Vacaciones', valor: stats.vacaciones, color: 'bg-blue-500' },
            { label: 'Personal', valor: stats.personal, color: 'bg-yellow-500' },
          ].map((s, i) => (
            <div key={i} className={s.color + ' text-white rounded-xl p-4 text-center shadow'}>
              <p className="text-3xl font-bold">{s.valor}</p>
              <p className="text-xs opacity-80 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Google Calendar */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-1">Google Calendar</h2>
          <p className="text-sm text-gray-400 mb-4">Sincroniza tus ausencias con tu Google Calendar personal.</p>
          {googleMsg && (
            <p className={`text-sm mb-3 ${googleMsg.includes('Error') ? 'text-red-500' : 'text-green-600'}`}>{googleMsg}</p>
          )}
          {usuario.google_access_token ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-green-600 font-medium">Conectado</span>
              <button onClick={handleDesconectarGoogle} className="text-xs text-red-500 hover:underline">Desconectar</button>
            </div>
          ) : (
            <button onClick={handleConectarGoogle} className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm">
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Conectar con Google Calendar
            </button>
          )}
        </div>

        {/* Cambiar contraseña */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Cambiar contrasena</h2>
          <form onSubmit={handleCambiarPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contrasena</label>
              <input type="password" value={passwordForm.nueva} onChange={e => setPasswordForm({...passwordForm, nueva: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min. 6 caracteres" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contrasena</label>
              <input type="password" value={passwordForm.confirmar} onChange={e => setPasswordForm({...passwordForm, confirmar: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min. 6 caracteres" required />
            </div>
            {mensajePass && <p className={mensajePass.includes('correctamente') ? 'text-green-600 text-sm' : 'text-red-500 text-sm'}>{mensajePass}</p>}
            <button type="submit" className="w-full bg-gray-800 text-white py-2 rounded-lg hover:bg-gray-900 transition font-medium">Cambiar contrasena</button>
          </form>
        </div>
      </div>
    </main>
  )
}