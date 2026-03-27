'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const COLORES = [
  { label: 'Rojo', value: 'bg-red-100 text-red-700' },
  { label: 'Rojo oscuro', value: 'bg-red-200 text-red-800' },
  { label: 'Azul', value: 'bg-blue-100 text-blue-700' },
  { label: 'Verde', value: 'bg-green-100 text-green-700' },
  { label: 'Amarillo', value: 'bg-yellow-100 text-yellow-700' },
  { label: 'Naranja', value: 'bg-orange-100 text-orange-700' },
  { label: 'Violeta', value: 'bg-purple-100 text-purple-700' },
  { label: 'Rosa', value: 'bg-pink-100 text-pink-700' },
  { label: 'Indigo', value: 'bg-indigo-100 text-indigo-700' },
  { label: 'Teal', value: 'bg-teal-100 text-teal-700' },
  { label: 'Cyan', value: 'bg-cyan-100 text-cyan-700' },
  { label: 'Gris', value: 'bg-gray-100 text-gray-700' },
]

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [form, setForm] = useState({ nombre: '', emoji: '📝', color: 'bg-gray-100 text-gray-700', orden: 0 })
  const [editando, setEditando] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    verificarAcceso()
    cargarCategorias()
  }, [])

  const verificarAcceso = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
    if (data?.rol !== 'supervisor') router.push('/empleado')
  }

  const cargarCategorias = async () => {
    const { data } = await supabase.from('categorias').select('*').order('orden')
    setCategorias(data || [])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMensaje('')
    setError('')

    if (editando) {
      const { error } = await supabase.from('categorias').update({
        nombre: form.nombre,
        emoji: form.emoji,
        color: form.color,
        orden: Number(form.orden)
      }).eq('id', editando)
      if (error) { setError('Error al actualizar.') } else { setMensaje('Categoria actualizada.'); setEditando(null); resetForm() }
    } else {
      const { error } = await supabase.from('categorias').insert({
        nombre: form.nombre,
        emoji: form.emoji,
        color: form.color,
        orden: Number(form.orden),
        activo: true
      })
      if (error) { setError('Error al crear: ' + error.message) } else { setMensaje('Categoria creada.'); resetForm() }
    }
    cargarCategorias()
    setLoading(false)
  }

  const handleEditar = (c) => {
    setEditando(c.id)
    setForm({ nombre: c.nombre, emoji: c.emoji || '📝', color: c.color || 'bg-gray-100 text-gray-700', orden: c.orden || 0 })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleToggle = async (c) => {
    await supabase.from('categorias').update({ activo: !c.activo }).eq('id', c.id)
    cargarCategorias()
  }

  const handleEliminar = async (id) => {
    if (!confirm('Seguro que queres eliminar esta categoria?')) return
    await supabase.from('categorias').delete().eq('id', id)
    cargarCategorias()
  }

  const resetForm = () => setForm({ nombre: '', emoji: '📝', color: 'bg-gray-100 text-gray-700', orden: 0 })

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Categorias de ausencia</h1>
            <p className="text-gray-500 text-sm">Alta, baja y modificacion de categorias</p>
          </div>
          <button onClick={() => router.push('/supervisor')} className="text-sm text-blue-600 hover:underline">Volver al panel</button>
        </div>

        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">{editando ? 'Editar categoria' : 'Nueva categoria'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Permiso Medico" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emoji</label>
              <input value={form.emoji} onChange={e => setForm({...form, emoji: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="📝" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <select value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {COLORES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
              <input type="number" value={form.orden} onChange={e => setForm({...form, orden: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Vista previa</label>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${form.color}`}>{form.emoji} {form.nombre || 'Nombre de la categoria'}</span>
            </div>
            {mensaje && <p className="text-green-600 text-sm md:col-span-2">{mensaje}</p>}
            {error && <p className="text-red-500 text-sm md:col-span-2">{error}</p>}
            <div className="md:col-span-2 flex gap-3 justify-end">
              {editando && <button type="button" onClick={() => { setEditando(null); resetForm() }} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancelar</button>}
              <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-medium">
                {loading ? 'Guardando...' : editando ? 'Actualizar' : 'Crear categoria'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Orden</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Categoria</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Vista previa</th>
                <th className="text-left px-4 py-3 text-gray-600 font-semibold">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {categorias.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-gray-400 py-8">No hay categorias todavia.</td></tr>
              ) : (
                categorias.map(c => (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{c.orden}</td>
                    <td className="px-4 py-3 font-medium text-gray-700">{c.nombre}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${c.color}`}>{c.emoji} {c.nombre}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${c.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                        {c.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleEditar(c)} className="text-blue-600 hover:underline text-xs">Editar</button>
                        <button onClick={() => handleToggle(c)} className="text-yellow-600 hover:underline text-xs">{c.activo ? 'Desactivar' : 'Activar'}</button>
                        <button onClick={() => handleEliminar(c.id)} className="text-red-500 hover:underline text-xs">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}