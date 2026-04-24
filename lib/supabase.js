import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 1. Definimos el almacenamiento (SessionStorage para que se borre al cerrar la pestaña)
const isBrowser = typeof window !== 'undefined'

const tabStorage = isBrowser ? {
  getItem: (key) => window.sessionStorage.getItem(key),
  setItem: (key, value) => window.sessionStorage.setItem(key, value),
  removeItem: (key) => window.sessionStorage.removeItem(key),
} : undefined

// 2. Función de limpieza de emergencia (solo si detectas corrupción)
// En lugar de borrar SIEMPRE, podrías ejecutar esto solo en el Logout 
// o si el cliente falla al inicializar.
const clearCorruptedAuth = () => {
  if (isBrowser) {
    // Limpia AMBOS para estar seguros
    [localStorage, sessionStorage].forEach(storage => {
      Object.keys(storage).forEach(key => {
        if (key.includes('supabase.auth.token') || (key.startsWith('sb-') && key.includes('-auth-token'))) {
          storage.removeItem(key)
        }
      })
    })
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: tabStorage, // Aquí usas sessionStorage
    storageKey: 'my-app-auth' // Definir una llave fija ayuda a evitar "llaves fantasma"
  }
})

