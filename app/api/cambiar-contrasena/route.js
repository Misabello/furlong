import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export async function POST(request) {
  try {
    const { userId, password } = await request.json()
    if (!userId || !password) {
      return Response.json({ ok: false, error: 'Faltan datos.' }, { status: 400 })
    }
    if (password.length < 6) {
      return Response.json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 })
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
    if (error) return Response.json({ ok: false, error: error.message }, { status: 400 })
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
}
