'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mensajeRecuperar, setMensajeRecuperar] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user }, error }) => {
      if (error || !user) {
        await supabase.auth.signOut()
        return
      }
      const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
      if (!usuario) {
        await supabase.auth.signOut()
        return
      }
      if (usuario.rol === 'admin') router.replace('/admin')
      else if (usuario.rol === 'supervisor') router.replace('/supervisor')
      else router.replace('/empleado')
    })
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setError('Email o contrasena incorrectos')
        setLoading(false)
        return
      }

      const { data: usuario, error: errorUsuario } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', data.user.id)
        .single()

      if (errorUsuario || !usuario) {
        console.error('Error al obtener usuario:', errorUsuario)
        setError('Tu cuenta no está configurada correctamente. Contactá al administrador.')
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      if (usuario.rol === 'admin') {
        router.push('/admin')
      } else if (usuario.rol === 'supervisor') {
        router.push('/supervisor')
      } else {
        router.push('/empleado')
      }
    } catch (err) {
      console.error('Error inesperado en login:', err)
      setError('Ocurrió un error inesperado. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleRecuperar = async () => {
    if (!email) {
      setMensajeRecuperar('Ingresa tu email primero.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/nueva-contrasena'
    })
    if (error) {
      setMensajeRecuperar('Error al enviar el email.')
    } else {
      setMensajeRecuperar('Te enviamos un email para restablecer tu contrasena.')
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="Furlong Incoming" width={220} height={80} className="object-contain" />
        </div>
        <p className="text-center text-gray-500 mb-6 text-sm">Control de Asistencias</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tu@email.com"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contrasena</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
          <button
            type="button"
            onClick={handleRecuperar}
            className="w-full text-sm text-gray-500 hover:text-blue-600 mt-2"
          >
            Olvide mi contrasena
          </button>
          {mensajeRecuperar && <p className="text-sm text-blue-600 text-center mt-2">{mensajeRecuperar}</p>}
        </form>
      </div>
    </main>
  )
}