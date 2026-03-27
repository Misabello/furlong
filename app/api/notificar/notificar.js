import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  try {
    const { empleadoNombre, empleadoEmail, supervisorEmail, fecha, motivo, descripcion } = await request.json()

    const motivoEmoji = {
      enfermedad: '🤒',
      vacaciones: '🏖️',
      personal: '👤',
      otro: '📝'
    }

    await resend.emails.send({
      from: 'Asistencias Furlong <onboarding@resend.dev>',
      to: supervisorEmail,
      subject: `Nueva ausencia registrada — ${empleadoNombre}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1e293b;">Nueva ausencia registrada</h2>
          <p style="color: #64748b;">Tu empleado <strong>${empleadoNombre}</strong> registró una ausencia.</p>
          
          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 8px;"><strong>Empleado:</strong> ${empleadoNombre}</p>
            <p style="margin: 0 0 8px;"><strong>Fecha:</strong> ${new Date(fecha).toLocaleDateString('es-AR')}</p>
            <p style="margin: 0 0 8px;"><strong>Motivo:</strong> ${motivoEmoji[motivo]} ${motivo}</p>
            ${descripcion ? `<p style="margin: 0;"><strong>Descripción:</strong> ${descripcion}</p>` : ''}
          </div>

          <p style="color: #94a3b8; font-size: 12px;">Sistema de Asistencias Furlong</p>
        </div>
      `
    })

    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }
}