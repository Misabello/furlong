import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export async function POST(request) {
  try {
    const { email, password, nombre, rol, departamento, fecha_ingreso, supervisor_id } = await request.json()

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, rol }
    })

    if (error) return Response.json({ ok: false, error: error.message }, { status: 400 })

    await supabaseAdmin.from('usuarios').upsert({
      id: data.user.id,
      email,
      nombre,
      rol,
      departamento,
      fecha_ingreso: fecha_ingreso || null,
      supervisor_id: supervisor_id || null
    })

    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
}