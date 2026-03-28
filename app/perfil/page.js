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
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data } = await supabase.from('usuarios').select('*').eq('id', user.id).single()
      setUsuario(data)
      const { data: ausencias } = await supabase.from('ausencias').select('motivo').eq('empleado_id', user.id)
      if (ausencias) {
        const s = { total: ausencias.length, enfermedad: 0, vacaciones: 0, personal: 0 }
        ausencias.forEach(a => { s[a.motivo] = (s[a.motivo] || 0) + 1 })
        setStats(s)
      }
    }
    init()
  }, [])

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

  const volverA = usuario?.rol === 'supervisor' ? '/supervisor' : '/empleado'

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