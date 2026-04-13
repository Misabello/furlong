import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export async function POST(request) {
  try {
    const { email, password, nombre, rol, departamento, fecha_ingreso, supervisor_id, vacaciones_saldo_anterior, francos_saldo_anterior } = await request.json()

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, rol }
    })

    if (error) return Response.json({ ok: false, error: error.message }, { status: 400 })

    // Upsert base (por si no existe trigger que cree la fila)
    await supabaseAdmin.from('usuarios').upsert({
      id: data.user.id,
      email,
      nombre,
      rol,
      departamento: departamento || null,
      fecha_ingreso: fecha_ingreso || null,
      supervisor_id: supervisor_id || null,
      vacaciones_saldo_anterior: vacaciones_saldo_anterior ?? null,
      francos_saldo_anterior: francos_saldo_anterior ?? null
    }, { onConflict: 'id' })

    // Update explícito para garantizar que los campos extra se graben
    // incluso si el trigger de auth.users pisó el upsert anterior
    const { error: updateError } = await supabaseAdmin.from('usuarios').update({
      departamento: departamento || null,
      fecha_ingreso: fecha_ingreso || null,
      supervisor_id: supervisor_id || null,
      vacaciones_saldo_anterior: vacaciones_saldo_anterior ?? null,
      francos_saldo_anterior: francos_saldo_anterior ?? null
    }).eq('id', data.user.id)

    if (updateError) return Response.json({ ok: false, error: updateError.message }, { status: 500 })

    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
}