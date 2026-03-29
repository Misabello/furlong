import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export async function POST(request) {
  const { userId } = await request.json()

  await supabaseAdmin.from('usuarios').update({
    google_access_token: null,
    google_refresh_token: null,
    google_token_expiry: null,
  }).eq('id', userId)

  return Response.json({ ok: true })
}
