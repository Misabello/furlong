'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function NuevaContrasena() {
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)
  const [sesionLista, setSesionLista] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSesionLista(true)
    })
    // Por si el evento ya disparó antes de que el componente montara
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSesionLista(true)
      else if (!sesionLista) router.replace('/')
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirmar) { setMensaje('Las contrasenas no coinciden.'); return }
    if (password.length < 6) { setMensaje('Minimo 6 caracteres.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMensaje('Error al actualizar la contrasena.')
    } else {
      setMensaje('Contrasena actualizada correctamente.')
      await supabase.auth.signOut()
      setTimeout(() => router.replace('/'), 2000)
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="Furlong Incoming" width={220} height={80} className="object-contain" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">Nueva contrasena</h2>
        <p className="text-gray-500 text-sm text-center mb-6">Ingresa tu nueva contrasena</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contrasena</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min. 6 caracteres" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contrasena</label>
            <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min. 6 caracteres" required />
          </div>
          {mensaje && <p className={mensaje.includes('correctamente') ? 'text-green-600 text-sm' : 'text-red-500 text-sm'}>{mensaje}</p>}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium">
            {loading ? 'Guardando...' : 'Cambiar contrasena'}
          </button>
        </form>
      </div>
    </main>
  )
}
