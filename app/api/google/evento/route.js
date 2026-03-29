import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

async function getAccessToken(usuario) {
  if (!usuario?.google_access_token) return null

  if (new Date(usuario.google_token_expiry) > new Date()) {
    return usuario.google_access_token
  }

  // Token expirado, refrescar
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: usuario.google_refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const refreshed = await res.json()
  if (refreshed.error) return null

  await supabaseAdmin.from('usuarios').update({
    google_access_token: refreshed.access_token,
    google_token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
  }).eq('id', usuario.id)

  return refreshed.access_token
}

export async function POST(request) {
  const { userId, fechaDesde, fechaHasta, motivo, descripcion } = await request.json()

  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('id, google_access_token, google_refresh_token, google_token_expiry')
    .eq('id', userId)
    .single()

  const accessToken = await getAccessToken(usuario)
  if (!accessToken) return Response.json({ ok: false, reason: 'not_connected' })

  // Para eventos de todo el dia, la fecha de fin es exclusiva (dia siguiente al ultimo)
  const endDate = new Date(fechaHasta)
  endDate.setDate(endDate.getDate() + 1)

  const event = {
    summary: `Ausencia: ${motivo}`,
    description: descripcion || '',
    start: { date: fechaDesde },
    end: { date: endDate.toISOString().split('T')[0] },
  }

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })

  if (!res.ok) return Response.json({ ok: false, reason: 'calendar_api_error' })
  return Response.json({ ok: true })
}
