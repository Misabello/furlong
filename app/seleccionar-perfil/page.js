'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const rolColor = {
  admin: 'bg-red-100 text-red-700',
  supervisor: 'bg-purple-100 text-purple-700',
  empleado: 'bg-blue-100 text-blue-700',
}

const rolLabel = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  empleado: 'Empleado',
}

const rolPath = {
  admin: '/admin',
  supervisor: '/supervisor',
  empleado: '/empleado',
}

export default function SeleccionarPerfil() {
  const [perfiles, setPerfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data } = await supabase
        .from('usuarios')
        .select('*')
        .eq('auth_user_id', user.id)
        .order('nombre')

      if (!data || data.length === 0) {
        // Sin perfiles — intentar con id legacy (migración pendiente)
        const { data: legacy } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', user.id)
          .single()
        if (legacy) {
          seleccionar(legacy)
          return
        }
        router.push('/')
        return
      }

      if (data.length === 1) {
        seleccionar(data[0])
        return
      }

      setPerfiles(data)
      setLoading(false)
    }
    init()
  }, [])

  const seleccionar = (perfil) => {
    localStorage.setItem('furlong_profile_id', perfil.id)
    router.push(rolPath[perfil.rol] || '/empleado')
  }

  const handleLogout = async () => {
    localStorage.removeItem('furlong_profile_id')
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Cargando perfiles...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
      <div className="mb-8">
        <Image src="/logo.png" alt="Furlong Incoming" width={180} height={65} className="object-contain" />
      </div>

      <h1 className="text-2xl font-bold text-gray-800 mb-2">Selecciona tu perfil</h1>
      <p className="text-gray-500 text-sm mb-10">Cada perfil tiene su propio acceso y rol</p>

      <div className="flex flex-wrap gap-6 justify-center max-w-3xl">
        {perfiles.map(perfil => (
          <button
            key={perfil.id}
            onClick={() => seleccionar(perfil)}
            className="flex flex-col items-center gap-3 bg-white rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-200 p-8 w-48 group"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-inner group-hover:scale-105 transition-transform">
              {perfil.nombre?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-800 text-sm leading-tight">{perfil.nombre}</p>
              {perfil.departamento && (
                <p className="text-xs text-gray-400 mt-0.5">{perfil.departamento}</p>
              )}
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${rolColor[perfil.rol] || 'bg-gray-100 text-gray-600'}`}>
              {rolLabel[perfil.rol] || perfil.rol}
            </span>
          </button>
        ))}
      </div>

      <button onClick={handleLogout} className="mt-12 text-sm text-gray-400 hover:text-red-500 transition">
        Cerrar sesion
      </button>
    </main>
  )
}
