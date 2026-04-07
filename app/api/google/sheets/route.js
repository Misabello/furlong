import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

async function getAccessToken(usuario) {
  if (!usuario?.google_access_token) return null

  if (new Date(usuario.google_token_expiry) > new Date()) {
    return usuario.google_access_token
  }

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
  const { userId, filas, resumenFilas, desde, hasta } = await request.json()

  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('id, google_access_token, google_refresh_token, google_token_expiry')
    .eq('id', userId)
    .single()

  const accessToken = await getAccessToken(usuario)
  if (!accessToken) return Response.json({ ok: false, reason: 'not_connected' }, { status: 401 })

  const titulo = `Ausencias ${desde} al ${hasta}`
  const headersDetalle = ['Nombre', 'Departamento', 'Fecha', 'Motivo', 'Descripcion', 'Fecha de carga']
  const valoresDetalle = [headersDetalle, ...filas.map(f => [
    f.nombre, f.departamento, f.fecha, f.motivo, f.descripcion, f.fechaCarga
  ])]

  const sheetsConfig = [{
    properties: { title: 'Detalle' },
    data: [{ startRow: 0, startColumn: 0, rowData: valoresDetalle.map(fila => ({
      values: fila.map(celda => ({ userEnteredValue: { stringValue: String(celda ?? '') } }))
    }))}]
  }]

  if (resumenFilas && resumenFilas.length > 0) {
    const headersResumen = ['Empleado', 'Departamento', 'Motivo', 'Dias', 'Total ausencias', 'Vac. Disponibles', 'Vac. Tomadas', 'Vac. Restantes']
    const valoresResumen = [headersResumen, ...resumenFilas.map(f => [
      f.nombre, f.departamento, f.motivo, f.dias, f.total, f.vacDisponibles, f.vacTomadas, f.vacRestantes
    ])]
    sheetsConfig.push({
      properties: { title: 'Resumen' },
      data: [{ startRow: 0, startColumn: 0, rowData: valoresResumen.map(fila => ({
        values: fila.map(celda => ({ userEnteredValue: { stringValue: String(celda ?? '') } }))
      }))}]
    })
  }

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title: titulo },
      sheets: sheetsConfig,
    }),
  })

  if (!res.ok) {
    const err = await res.json()
return Response.json({ ok: false, reason: err?.error?.message || 'sheets_api_error' }, { status: 500 })
  }

  const sheet = await res.json()
  return Response.json({ ok: true, url: `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}` })
}
