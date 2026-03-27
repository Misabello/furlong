import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export function useCategorias() {
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase
        .from('categorias')
        .select('*')
        .eq('activo', true)
        .order('orden')
      setCategorias(data || [])
      setLoading(false)
    }
    cargar()
  }, [])

  return { categorias, loading }
}