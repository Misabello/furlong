import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin

  if (!code || !userId) {
    return Response.redirect(`${appUrl}/perfil?google=error`)
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${appUrl}/api/google/callback`,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()

  if (tokens.error) {
    return Response.redirect(`${appUrl}/perfil?google=error`)
  }

  await supabaseAdmin.from('usuarios').update({
    google_access_token: tokens.access_token,
    google_refresh_token: tokens.refresh_token,
    google_token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }).eq('id', userId)

  return Response.redirect(`${appUrl}/perfil?google=connected`)
}
