import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export async function POST(request) {
  try {
    const {
      email, password, nombre, rol, departamento, fecha_ingreso, supervisor_id,
      vacaciones_saldo_anterior, francos_saldo_anterior,
      vincularEmail  // si viene, vincular a cuenta existente en lugar de crear nueva
    } = await request.json()

    let authUserId

    if (vincularEmail) {
      // Buscar auth_user_id de la cuenta existente
      const { data: existing } = await supabaseAdmin
        .from('usuarios')
        .select('auth_user_id, id')
        .eq('email', vincularEmail)
        .limit(1)
        .single()

      if (!existing) {
        return Response.json({ ok: false, error: 'No se encontró un usuario con ese email.' }, { status: 400 })
      }
      authUserId = existing.auth_user_id || existing.id
    } else {
      // Crear nueva cuenta de auth
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nombre, rol }
      })
      if (error) return Response.json({ ok: false, error: error.message }, { status: 400 })
      authUserId = data.user.id
    }

    const profileId = vincularEmail ? crypto.randomUUID() : authUserId

    await supabaseAdmin.from('usuarios').insert({
      id: profileId,
      auth_user_id: authUserId,
      email: vincularEmail || email,
      nombre,
      rol,
      departamento,
      fecha_ingreso: fecha_ingreso || null,
      supervisor_id: supervisor_id || null,
      vacaciones_saldo_anterior: vacaciones_saldo_anterior ?? null,
      francos_saldo_anterior: francos_saldo_anterior ?? null,
    })

    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
}
