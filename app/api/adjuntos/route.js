import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const empleadoId = searchParams.get('empleadoId')
  const empleadoIds = searchParams.get('empleadoIds')

  let query = supabaseAdmin.from('adjuntos').select('*')

  if (empleadoId) {
    query = query.eq('empleado_id', empleadoId)
  } else if (empleadoIds) {
    query = query.in('empleado_id', empleadoIds.split(','))
  } else {
    return Response.json([])
  }

  const { data } = await query
  return Response.json(data || [])
}
