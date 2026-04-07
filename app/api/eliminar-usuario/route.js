import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export async function POST(request) {
  try {
    const { userId } = await request.json()
    if (!userId) return Response.json({ ok: false, error: 'userId requerido' }, { status: 400 })

    // 1. Borrar ausencias del usuario
    await supabaseAdmin.from('ausencias').delete().eq('empleado_id', userId)

    // 2. Desasignar supervisor en usuarios que lo tenían asignado
    await supabaseAdmin.from('usuarios').update({ supervisor_id: null }).eq('supervisor_id', userId)

    // 3. Desasignar supervisor en departamentos
    await supabaseAdmin.from('departamentos').update({ supervisor_id: null }).eq('supervisor_id', userId)

    // 4. Borrar de la tabla pública usuarios
    const { error: errTabla } = await supabaseAdmin.from('usuarios').delete().eq('id', userId)
    if (errTabla) return Response.json({ ok: false, error: errTabla.message }, { status: 500 })

    // 5. Borrar de auth.users
    const { error: errAuth } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (errAuth) return Response.json({ ok: false, error: errAuth.message }, { status: 500 })

    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
}
