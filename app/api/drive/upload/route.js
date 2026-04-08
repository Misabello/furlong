import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

const FOLDER_ID = '1i79Eg3aw4MGPjc2uZmRwDmYfFiyUMz_L'

async function getAdminToken() {
  const { data } = await supabaseAdmin
    .from('usuarios')
    .select('id, email, google_access_token, google_refresh_token, google_token_expiry')
    .eq('rol', 'admin')
    .not('google_access_token', 'is', null)
    .limit(1)
    .single()

  if (!data?.google_access_token) return null

  if (new Date(data.google_token_expiry) > new Date()) {
    return data.google_access_token
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: data.google_refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const refreshed = await res.json()
  if (refreshed.error) return null

  await supabaseAdmin.from('usuarios').update({
    google_access_token: refreshed.access_token,
    google_token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
  }).eq('id', data.id)

  return refreshed.access_token
}

export async function POST(request) {
  const formData = await request.formData()
  const file = formData.get('file')
  const empleadoId = formData.get('empleadoId')
  const fechaDesde = formData.get('fechaDesde')
  const fechaHasta = formData.get('fechaHasta')
  const motivo = formData.get('motivo')

  if (!file) return Response.json({ ok: false, reason: 'no_file' }, { status: 400 })

  const accessToken = await getAdminToken()
  if (!accessToken) return Response.json({ ok: false, reason: 'no_admin_token' }, { status: 401 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const mimeType = file.type || 'application/octet-stream'
  const fileName = `${fechaDesde}_${file.name}`

  const metadata = JSON.stringify({ name: fileName, parents: [FOLDER_ID] })
  const boundary = 'furlong_boundary_314159'

  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ])

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body: multipartBody,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.json()
    console.error('Drive upload error:', JSON.stringify(err))
    return Response.json({ ok: false, reason: err?.error?.message || 'upload_error', adminEmail: data?.email }, { status: 500 })
  }

  const uploaded = await uploadRes.json()
  const archivoUrl = `https://drive.google.com/file/d/${uploaded.id}/view`

  await supabaseAdmin.from('adjuntos').insert({
    empleado_id: empleadoId,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
    motivo,
    archivo_url: archivoUrl,
    archivo_nombre: file.name,
  })

  return Response.json({ ok: true, url: archivoUrl, nombre: file.name })
}
