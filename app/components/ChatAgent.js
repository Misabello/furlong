'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const TOOL_LABELS = {
  consultar_ausencias: 'ausencias',
  consultar_usuarios: 'empleados',
  consultar_estadisticas: 'estadísticas',
  consultar_departamentos: 'departamentos',
  consultar_categorias: 'categorías'
}

const SUGGESTED_QUESTIONS = [
  '¿Cuántas ausencias hubo este mes?',
  '¿Quién tuvo más ausencias este año?',
  'Mostrá las vacaciones pendientes',
  '¿Qué ausencias hay esta semana?'
]

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  )
}

function TableBlock({ header, rows, session }) {
  const [exporting, setExporting] = useState(false)
  const [sheetUrl, setSheetUrl] = useState(null)
  const [exportError, setExportError] = useState(null)

  const exportToSheet = async () => {
    setExporting(true)
    setExportError(null)
    try {
      const res = await fetch('/api/google/sheets-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id, headers: header, rows, titulo: 'Datos del asistente' })
      })
      const data = await res.json()
      if (data.ok) {
        setSheetUrl(data.url)
      } else if (data.reason === 'not_connected') {
        setExportError('Conectá tu cuenta de Google en Mi perfil.')
      } else {
        setExportError('No se pudo exportar.')
      }
    } catch {
      setExportError('Error al exportar.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="my-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="bg-slate-100">
              {header.map((c, j) => (
                <th key={j} className="border-b border-slate-200 px-3 py-1.5 font-semibold text-left text-slate-700 whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, j) => (
              <tr key={j} className={j % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                {row.map((c, k) => (
                  <td key={k} className="border-b border-slate-100 px-3 py-1.5 text-slate-700 whitespace-nowrap">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        {!sheetUrl ? (
          <button
            onClick={exportToSheet}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-50"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            {exporting ? 'Exportando...' : 'Exportar a Sheet'}
          </button>
        ) : (
          <a
            href={sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 border border-green-700 transition-colors"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            Abrir Sheet →
          </a>
        )}
        {exportError && <span className="text-xs text-red-500">{exportError}</span>}
      </div>
    </div>
  )
}

function parseInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}

function renderMarkdown(text, session) {
  const lines = text.split('\n')
  const result = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) { i++; continue }

    // Tabla markdown
    if (line.trim().startsWith('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      const parseCells = (l) => l.split('|').map(c => c.trim()).filter((_, idx, arr) => idx !== 0 && idx !== arr.length - 1)
      const header = parseCells(tableLines[0])
      const rows = tableLines.slice(2).map(parseCells).filter(r => r.length > 0)
      result.push(<TableBlock key={`t${i}`} header={header} rows={rows} session={session} />)
      continue
    }

    // Lista
    if (line.trim().match(/^[-*•]\s/)) {
      const items = []
      while (i < lines.length && lines[i].trim().match(/^[-*•]\s/)) {
        items.push(lines[i].trim().replace(/^[-*•]\s/, ''))
        i++
      }
      result.push(
        <ul key={`l${i}`} className="list-disc list-inside text-sm space-y-0.5 my-1">
          {items.map((item, j) => <li key={j}>{parseInline(item)}</li>)}
        </ul>
      )
      continue
    }

    result.push(<p key={`p${i}`} className="text-sm leading-relaxed">{parseInline(line)}</p>)
    i++
  }

  return result
}

function MessageBubble({ message, session }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mr-2 mt-0.5 shrink-0">
          IA
        </div>
      )}
      <div
        className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-sm text-sm leading-relaxed whitespace-pre-wrap break-words'
            : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-bl-sm'
        }`}
      >
        {isUser ? (
          message.content
        ) : message.streaming && !message.content ? (
          <TypingDots />
        ) : (
          <>
            {renderMarkdown(message.content, session)}
            {message.streaming && (
              <span className="inline-block w-0.5 h-3.5 bg-slate-400 ml-0.5 animate-pulse align-middle" />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function ChatAgent() {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [toolStatus, setToolStatus] = useState('')
  const [unread, setUnread] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) await fetchPerfil(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      setSession(session)
      if (!session) { setPerfil(null); setMessages([]) }
      else await fetchPerfil(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchPerfil = async (userId) => {
    const { data } = await supabase.from('usuarios').select('nombre, rol').eq('id', userId).single()
    setPerfil(data)
  }

  useEffect(() => {
    if (open) {
      setUnread(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, toolStatus])

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim()
    if (!content || loading || !session) return

    setInput('')
    setLoading(true)
    setToolStatus('')

    const userMsg = { role: 'user', content }
    const history = messages.filter(m => !m.streaming && m.content).map(m => ({ role: m.role, content: m.content }))
    const toSend = [...history, { role: 'user', content }]

    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', streaming: true }])

    try {
      const controller = new AbortController()
      abortRef.current = controller

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ messages: toSend }),
        signal: controller.signal
      })

      if (!response.ok) throw new Error(`Error ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let event
          try { event = JSON.parse(line.slice(6)) } catch { continue }

          if (event.type === 'text') {
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'assistant') updated[updated.length - 1] = { ...last, content: last.content + event.text }
              return updated
            })
          } else if (event.type === 'tool_start') {
            setToolStatus(`Buscando ${TOOL_LABELS[event.name] || event.name}...`)
          } else if (event.type === 'tool_running') {
            setToolStatus(`Consultando ${TOOL_LABELS[event.name] || event.name}...`)
          } else if (event.type === 'tool_done') {
            setToolStatus('')
          } else if (event.type === 'done') {
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'assistant') updated[updated.length - 1] = { ...last, streaming: false }
              return updated
            })
            if (!open) setUnread(true)
          } else if (event.type === 'error') {
            throw new Error(event.message)
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'assistant') updated[updated.length - 1] = { role: 'assistant', content: 'Ocurrió un error. Por favor intentá de nuevo.', streaming: false }
        return updated
      })
    } finally {
      setLoading(false)
      setToolStatus('')
      abortRef.current = null
    }
  }, [input, loading, messages, session, open])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setLoading(false)
    setToolStatus('')
    setMessages(prev => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last?.role === 'assistant' && last.streaming) updated[updated.length - 1] = { ...last, streaming: false }
      return updated
    })
  }

  const clearChat = () => { setMessages([]); setInput(''); setToolStatus('') }

  if (!session || !perfil || perfil.rol === 'empleado') return null

  const nombre = perfil.nombre?.split(',')[0] || ''

  const panelW = expanded ? 'w-[760px]' : 'w-[380px]'
  const panelH = expanded ? 'h-[620px]' : 'h-[540px]'

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-5 right-5 z-50 w-13 h-13 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        aria-label="Asistente IA"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
        {unread && !open && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className={`fixed bottom-20 right-5 z-50 ${panelW} max-w-[calc(100vw-2.5rem)] ${panelH} max-h-[calc(100vh-7rem)] bg-slate-50 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 transition-all duration-200`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">IA</div>
              <div>
                <p className="text-sm font-semibold text-slate-800 leading-tight">Asistente Furlong</p>
                <p className="text-xs text-slate-500 leading-tight">
                  {loading ? <span className="text-indigo-500">escribiendo…</span> : 'En línea'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded(v => !v)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded hover:bg-slate-100"
                title={expanded ? 'Reducir' : 'Expandir'}
              >
                {expanded ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0h5m-5 0v5M15 9l5-5m0 0h-5m5 0v5M9 15l-5 5m0 0h5m-5 0v-5M15 15l5 5m0 0h-5m5 0v-5" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5M20 8V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5M20 16v4m0 0h-4m4 0l-5-5" />
                  </svg>
                )}
              </button>
              <button onClick={clearChat} className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-2 py-1 rounded hover:bg-slate-100">
                Limpiar
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 pb-4">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-700">¡Hola, {nombre}!</p>
                  <p className="text-xs text-slate-500 mt-1">Consultá ausencias, empleados y estadísticas</p>
                </div>
                <div className="grid grid-cols-1 gap-1.5 w-full px-2">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button key={i} onClick={() => sendMessage(q)} className="text-left text-xs text-slate-600 bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-xl px-3 py-2 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => <MessageBubble key={i} message={msg} session={session} />)}

            {toolStatus && (
              <div className="flex items-center gap-2 px-3 py-1.5">
                <svg className="w-3.5 h-3.5 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-xs text-slate-500 italic">{toolStatus}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 bg-white border-t border-slate-100">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribí tu consulta…"
                rows={1}
                disabled={loading}
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60 transition-all max-h-28 overflow-y-auto"
                style={{ minHeight: '40px' }}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 112) + 'px' }}
              />
              {loading ? (
                <button onClick={handleStop} className="w-9 h-9 rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shrink-0" title="Detener">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
                </button>
              ) : (
                <button onClick={() => sendMessage()} disabled={!input.trim()} className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0" title="Enviar">
                  <svg className="w-4 h-4 translate-x-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-1.5">Enter para enviar · Shift+Enter nueva línea</p>
          </div>
        </div>
      )}
    </>
  )
}
