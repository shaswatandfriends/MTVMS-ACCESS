'use client'

import { useEffect, useState, useCallback } from 'react'
import { Activity, Loader2, RefreshCw, User, LogIn, KeyRound, ShieldCheck, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ActivityEntry } from '@/lib/types'

function iconFor(action: string) {
  if (action.startsWith('login')) return <LogIn className="h-3.5 w-3.5" />
  if (action.startsWith('employee')) return <User className="h-3.5 w-3.5" />
  if (action.startsWith('medefis') || action.includes('session')) return <ShieldCheck className="h-3.5 w-3.5" />
  if (action.startsWith('password')) return <KeyRound className="h-3.5 w-3.5" />
  if (action.includes('delete')) return <Trash2 className="h-3.5 w-3.5" />
  return <Activity className="h-3.5 w-3.5" />
}

export function ActivityPanel() {
  const [logs, setLogs] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [limit, setLimit] = useState('50')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/activity?limit=${limit}`)
      const data = await res.json()
      setLogs(data.logs ?? [])
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Activity log</h2>
          <p className="text-sm text-slate-500">
            Audit trail of admin and employee actions in this gateway.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">Last 25</SelectItem>
              <SelectItem value="50">Last 50</SelectItem>
              <SelectItem value="100">Last 100</SelectItem>
              <SelectItem value="200">Last 200</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading activity…
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center text-sm text-slate-500">
              <Activity className="h-8 w-8 text-slate-300" />
              No activity recorded yet.
            </div>
          ) : (
            <ScrollArea className="h-[28rem]">
              <ul className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <li key={log.id} className="flex items-start gap-3 p-4">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                      {iconFor(log.action)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{log.actor}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {log.role}
                        </Badge>
                        <span className="font-mono text-xs text-slate-500">{log.action}</span>
                      </div>
                      {log.detail && (
                        <p className="mt-0.5 text-sm text-slate-600">{log.detail}</p>
                      )}
                      <div className="mt-1 text-xs text-slate-400">
                        {new Date(log.createdAt).toLocaleString()}
                        {log.ip && <> · {log.ip}</>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
