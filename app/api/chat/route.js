import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TOOLS = [
  {
    name: 'consultar_ausencias',
    description: 'Consulta las ausencias registradas. Puede filtrar por empleado, rango de fechas y motivo/categoría. Devuelve la lista de ausencias con nombre del empleado y departamento.',
    input_schema: {
      type: 'object',
      properties: {
        empleado_id: { type: 'string', description: 'UUID del empleado (opcional)' },
        departamento: { type: 'string', description: 'Nombre del departamento, ej: BOOKING, TRAFICO, MICE (opcional)' },
        fecha_desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD (opcional)' },
        fecha_hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD (opcional)' },
        motivo: { type: 'string', description: 'Categoría de ausencia, ej: vacaciones, enfermedad (opcional)' },
        limit: { type: 'number', description: 'Cantidad máxima de resultados, por defecto 20' }
      },
      required: []
    }
  },
  {
    name: 'consultar_usuarios',
    description: 'Consulta información de empleados: nombre, departamento, fecha de ingreso, saldos de vacaciones y francos.',
    input_schema: {
      type: 'object',
      properties: {
        departamento: { type: 'string', description: 'Filtrar por departamento (opcional)' },
        rol: { type: 'string', description: 'Filtrar por rol: admin, supervisor, empleado (opcional)' },
        nombre: { type: 'string', description: 'Buscar por nombre parcial (opcional)' }
      },
      required: []
    }
  },
  {
    name: 'consultar_estadisticas',
    description: 'Calcula estadísticas de ausencias por empleado o departamento: totales por categoría, cantidad de días tomados, saldos de vacaciones y francos disponibles.',
    input_schema: {
      type: 'object',
      properties: {
        empleado_id: { type: 'string', description: 'UUID del empleado para estadísticas individuales (opcional)' },
        departamento: { type: 'string', description: 'Nombre del departamento (opcional)' },
        anio: { type: 'number', description: 'Año a calcular, por defecto el año actual' }
      },
      required: []
    }
  },
  {
    name: 'consultar_departamentos',
    description: 'Lista todos los departamentos de la empresa y sus supervisores asignados.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'consultar_categorias',
    description: 'Lista las categorías de ausencia disponibles con su emoji y color.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
]

async function getEmployeesInScope(userId, userRole) {
  if (userRole === 'admin' || userRole === 'supervisor') return null // null = sin restricción
  if (userRole === 'empleado') return [userId]
}

async function executeTool(name, input, userId, userRole) {
  try {
    const scopeIds = await getEmployeesInScope(userId, userRole)

    switch (name) {
      case 'consultar_ausencias': {
        let query = supabaseAdmin
          .from('ausencias')
          .select('id, empleado_id, fecha, motivo, descripcion, fecha_carga, usuarios!empleado_id(nombre, departamento)')
          .order('fecha', { ascending: false })
          .limit(input.limit || 20)

        if (scopeIds) query = query.in('empleado_id', scopeIds)
        if (input.empleado_id) query = query.eq('empleado_id', input.empleado_id)
        if (input.fecha_desde) query = query.gte('fecha', input.fecha_desde)
        if (input.fecha_hasta) query = query.lte('fecha', input.fecha_hasta)
        if (input.motivo) query = query.ilike('motivo', `%${input.motivo}%`)

        if (input.departamento) {
          const { data: deptEmps } = await supabaseAdmin
            .from('usuarios')
            .select('id')
            .eq('departamento', input.departamento)
          const ids = deptEmps?.map(e => e.id) || []
          if (ids.length === 0) return JSON.stringify([])
          // Intersect with scope if needed
          const filtered = scopeIds ? ids.filter(id => scopeIds.includes(id)) : ids
          query = query.in('empleado_id', filtered)
        }

        const { data, error } = await query
        if (error) return `Error: ${error.message}`

        return JSON.stringify(
          (data || []).map(a => ({
            fecha: a.fecha,
            empleado: a.usuarios?.nombre,
            departamento: a.usuarios?.departamento,
            motivo: a.motivo,
            descripcion: a.descripcion || ''
          }))
        )
      }

      case 'consultar_usuarios': {
        let query = supabaseAdmin
          .from('usuarios')
          .select('id, nombre, email, rol, departamento, fecha_ingreso, vacaciones_saldo_anterior, francos_saldo_anterior, estado')
          .order('nombre')

        if (scopeIds) query = query.in('id', scopeIds)
        if (input.departamento) query = query.eq('departamento', input.departamento)
        if (input.rol) query = query.eq('rol', input.rol)
        if (input.nombre) query = query.ilike('nombre', `%${input.nombre}%`)

        const { data, error } = await query
        if (error) return `Error: ${error.message}`
        return JSON.stringify(data || [])
      }

      case 'consultar_estadisticas': {
        const año = input.anio || new Date().getFullYear()
        const fechaDesde = `${año}-01-01`
        const fechaHasta = `${año}-12-31`

        let empQuery = supabaseAdmin
          .from('usuarios')
          .select('id, nombre, departamento, fecha_ingreso, vacaciones_saldo_anterior, francos_saldo_anterior')

        if (scopeIds) empQuery = empQuery.in('id', scopeIds)
        if (input.empleado_id) empQuery = empQuery.eq('id', input.empleado_id)
        if (input.departamento) empQuery = empQuery.eq('departamento', input.departamento)

        const { data: empleados } = await empQuery
        if (!empleados?.length) return JSON.stringify([])

        const empIds = empleados.map(e => e.id)
        const { data: ausencias } = await supabaseAdmin
          .from('ausencias')
          .select('empleado_id, fecha, motivo')
          .in('empleado_id', empIds)
          .gte('fecha', fechaDesde)
          .lte('fecha', fechaHasta)

        const stats = empleados.map(emp => {
          const ausEmp = ausencias?.filter(a => a.empleado_id === emp.id) || []
          const porMotivo = {}
          ausEmp.forEach(a => {
            porMotivo[a.motivo] = (porMotivo[a.motivo] || 0) + 1
          })
          return {
            empleado: emp.nombre,
            departamento: emp.departamento,
            año,
            total_ausencias: ausEmp.length,
            por_motivo: porMotivo,
            saldo_vacaciones_anterior: emp.vacaciones_saldo_anterior || 0,
            saldo_francos_anterior: emp.francos_saldo_anterior || 0,
            fecha_ingreso: emp.fecha_ingreso
          }
        })

        return JSON.stringify(stats)
      }

      case 'consultar_departamentos': {
        const { data, error } = await supabaseAdmin
          .from('departamentos')
          .select('nombre, supervisor_id, usuarios!supervisor_id(nombre, email)')
        if (error) return `Error: ${error.message}`
        return JSON.stringify(
          (data || []).map(d => ({
            departamento: d.nombre,
            supervisor: d.usuarios?.nombre || 'Sin asignar',
            email_supervisor: d.usuarios?.email || ''
          }))
        )
      }

      case 'consultar_categorias': {
        const { data, error } = await supabaseAdmin
          .from('categorias')
          .select('nombre, emoji, activo')
          .eq('activo', true)
          .order('orden')
        if (error) return `Error: ${error.message}`
        return JSON.stringify(data || [])
      }

      default:
        return 'Herramienta no reconocida'
    }
  } catch (err) {
    return `Error: ${err.message}`
  }
}

export async function POST(request) {
  // Verify JWT
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
  if (authError || !user) {
    return Response.json({ error: 'Sesión inválida' }, { status: 401 })
  }

  const { data: perfil } = await supabaseAdmin
    .from('usuarios')
    .select('nombre, rol, departamento')
    .eq('id', user.id)
    .single()

  if (!perfil) {
    return Response.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }

  const { messages } = await request.json()

  const systemPrompt = `Sos un asistente de gestión de ausencias para Furlong Incoming, empresa turística argentina.

Usuario: ${perfil.nombre} | Rol: ${perfil.rol}${perfil.departamento ? ` | Departamento: ${perfil.departamento}` : ''}

Acceso a datos:
${perfil.rol === 'admin' ? '• Podés consultar toda la organización.' : ''}
${perfil.rol === 'supervisor' ? '• Podés consultar todos los empleados de la empresa.' : ''}

Herramientas disponibles: consultar_ausencias, consultar_usuarios, consultar_estadisticas, consultar_departamentos, consultar_categorias.

Cuando el usuario pregunte algo que requiere datos, usá las herramientas. Interpretá las preguntas en lenguaje natural y traducílas a filtros apropiados. Si necesitás más de una herramienta, usálas en secuencia.

Respondé siempre en español rioplatense. Sé conciso y presentá los datos de forma clara.
Cuando presentes listas o conjuntos de datos, SIEMPRE usá tablas markdown con columnas bien definidas. Ejemplo de formato:
| Empleado | Departamento | Motivo | Fecha |
|----------|-------------|--------|-------|
| Juan Pérez | BOOKING | Vacaciones | 10/04/2026 |
Hoy es ${new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        const claudeMessages = messages.slice(-4).map(m => ({ role: m.role, content: m.content }))

        // Agentic loop: keep going until end_turn
        while (true) {
          const apiStream = anthropic.messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4096,
            system: systemPrompt,
            tools: TOOLS,
            messages: claudeMessages
          })

          for await (const event of apiStream) {
            if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
              send({ type: 'tool_start', name: event.content_block.name })
            }
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              send({ type: 'text', text: event.delta.text })
            }
          }

          const finalMsg = await apiStream.finalMessage()
          claudeMessages.push({ role: 'assistant', content: finalMsg.content })

          if (finalMsg.stop_reason !== 'tool_use') break

          // Execute all tool calls
          const toolResults = []
          for (const block of finalMsg.content) {
            if (block.type !== 'tool_use') continue
            send({ type: 'tool_running', name: block.name })
            const result = await executeTool(block.name, block.input, user.id, perfil.rol)
            send({ type: 'tool_done', name: block.name })
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
          }
          claudeMessages.push({ role: 'user', content: toolResults })
        }

        send({ type: 'done' })
      } catch (err) {
        send({ type: 'error', message: err.message })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
