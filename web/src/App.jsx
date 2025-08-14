import React, { useEffect, useMemo, useState } from 'react'

const WS_URL = (import.meta?.env?.VITE_WS_URL) || 'ws://localhost:8765'

// 建立 WebSocket 連線並接收 MAVLink 訊息的 Hook（確保即時更新）
function useMavlinkStream(url) {
  const [connected, setConnected] = useState(false)
  const [lastError, setLastError] = useState(null)
  const [messages, setMessages] = useState({})

  useEffect(() => {
    let ws
    let alive = true

    function connect() {
      ws = new WebSocket(url)
      ws.onopen = () => { setConnected(true); setLastError(null) }
      ws.onclose = () => { setConnected(false); if (alive) setTimeout(connect, 1000) }
      ws.onerror = () => { setLastError('WebSocket error') }
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data)
          const key = msg.name || `MSG_${msg.msgid}`
          // 直接更新 state，確保即時渲染
          setMessages(prev => {
            const now = performance.now()
            const prevEntry = prev[key]
            const dt = prevEntry ? (now - (prevEntry._t || now)) / 1000 : null
            const hz = dt ? (0.9 * (prevEntry.hz || 0) + 0.1 * (1 / dt)) : 0
            return {
              ...prev,
              [key]: {
                id: msg.msgid,
                name: key,
                last: msg,
                hz: Number.isFinite(hz) ? hz : 0,
                count: (prevEntry?.count || 0) + 1,
                _t: now
              }
            }
          })
        } catch {
          console.error('JSON parse error')
        }
      }
    }

    connect()
    return () => { alive = false; ws && ws.close() }
  }, [url])

  return { connected, messages, lastError }
}

function DetailTable({ entry }) {
  if (!entry) return <div className="p-4 text-neutral-400">選擇左側的訊息以檢視詳細內容</div>
  const fields = entry.last?.fields || {}
  const types = entry.last?.types || {}
  return (
    <div className="p-4">
      <table className="w-full text-sm border border-neutral-700 rounded">
        <thead>
          <tr className="bg-neutral-900">
            <th className="px-4 py-2 text-left">名稱</th>
            <th className="px-4 py-2 text-left">值</th>
            <th className="px-4 py-2 text-left">類型</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(fields).map(k => (
            <tr key={k} className="hover:bg-neutral-800">
              <td className="px-4 py-2 font-mono text-xs">{k}</td>
              <td className="px-4 py-2 break-all">{String(fields[k])}</td>
              <td className="px-4 py-2 text-neutral-400 text-xs">{types[k] || typeof fields[k]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function App() {
  const { connected, messages, lastError } = useMavlinkStream(WS_URL)
  const [selected, setSelected] = useState(null)

  const list = useMemo(() => {
    const arr = Object.values(messages)
    arr.sort((a, b) => a.id - b.id)
    return arr
  }, [messages])

  useEffect(() => {
    if (!selected && list.length) setSelected(list[0].name)
  }, [list, selected])

  const selectedEntry = selected ? messages[selected] : null

  return (
    <div className="min-h-screen h-screen bg-neutral-950 text-neutral-100 flex">
      <aside className="w-64 shrink-0 border-r border-neutral-900 flex flex-col">
        <div className="p-4 flex items-center justify-between border-b border-neutral-900">
          <h1 className="text-lg font-semibold">MAVLink 訊息</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${connected ? 'border-green-700 bg-green-900/20 text-green-300' : 'border-red-700 bg-red-900/20 text-red-300'}`}>
            {connected ? '已連線' : '未連線'}
          </span>
        </div>
        {lastError && <div className="text-xs text-red-400 p-2">{lastError}</div>}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-900">
          {list.map(m => (
            <button
              key={m.name}
              className={`w-full text-left px-4 py-3 hover:bg-neutral-900 ${selected === m.name ? 'bg-neutral-900' : ''}`}
              onClick={() => setSelected(m.name)}
            >
              <div className="flex justify-between">
                <span className="font-mono text-xs">{m.name} ({m.id})</span>
                <span className="text-[10px] text-neutral-400">{m.hz.toFixed(1)}Hz</span>
              </div>
            </button>
          ))}
          {!list.length && (
            <div className="p-4 text-sm text-neutral-400">尚未接收到任何 MAVLink 訊息</div>
          )}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <DetailTable entry={selectedEntry} />
      </main>
    </div>
  )
}
