'use client'

import { useEffect, useState } from 'react'
import { Users, KeyRound, Activity, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { MedefisSessionStatus, Employee } from '@/lib/types'

interface OverviewPanelProps {
  refreshKey: number
}

export function OverviewPanel({ refreshKey }: OverviewPanelProps) {
  const [status, setStatus] = useState<MedefisSessionStatus | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const [s, e] = await Promise.all([
          fetch('/api/medefis/credentials').then((r) => r.json()),
          fetch('/api/employees').then((r) => r.json()),
        ])
        if (!active) return
        setStatus(s.status ?? null)
        setEmployees(e.employees ?? [])
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
  }, [refreshKey])

  const activeEmployees = employees.filter((e) => e.active).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">System overview</h2>
        <p className="text-sm text-slate-500">
          At-a-glance status of your Medefis gateway and workforce.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<ShieldCheck className="h-5 w-5 text-emerald-600" />}
          label="Medefis session"
          value={loading ? '…' : status?.valid ? 'Active' : 'Inactive'}
          tone={status?.valid ? 'good' : 'bad'}
        />
        <StatCard
          icon={<KeyRound className="h-5 w-5 text-emerald-600" />}
          label="Credentials stored"
          value={loading ? '…' : status?.hasCredentials ? 'Yes' : 'No'}
          tone={status?.hasCredentials ? 'good' : 'warn'}
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-emerald-600" />}
          label="Employees"
          value={loading ? '…' : String(employees.length)}
          sub={`${activeEmployees} active`}
        />
        <StatCard
          icon={<Activity className="h-5 w-5 text-emerald-600" />}
          label="Last verified"
          value={
            loading
              ? '…'
              : status?.lastVerifiedAt
                ? new Date(status.lastVerifiedAt).toLocaleString()
                : 'Never'
          }
          small
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-emerald-600" /> How this gateway works
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>You (admin)</strong> enter the Medefis username &amp; password in the
              Medefis tab. They are encrypted at rest and never shown to anyone.
            </li>
            <li>
              Click <em>Sign in to Medefis</em> — the server logs in headlessly and captures the
              session cookies. For SSO flows that resist automation, paste cookies manually.
            </li>
            <li>
              <strong>Employees</strong> you add sign in to this gateway with their own
              credentials. They see the already-logged-in Medefis screen through a reverse proxy.
              They never see the Medefis credentials.
            </li>
            <li>
              When the Medefis session expires, employees are told to wait while you re-establish
              it from the Medefis tab.
            </li>
          </ol>
          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh status
            </Button>
            {status?.appBaseUrl && (
              <Badge variant="outline" className="font-mono text-xs">
                {status.appBaseUrl}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  sub,
  small,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  small?: boolean
  tone?: 'good' | 'bad' | 'warn'
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-700'
      : tone === 'bad'
        ? 'text-rose-600'
        : tone === 'warn'
          ? 'text-amber-600'
          : 'text-slate-900'
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 ring-1 ring-emerald-100">
            {icon}
          </span>
        </div>
        <div className={`mt-3 font-semibold ${small ? 'text-sm' : 'text-2xl'} ${toneClass}`}>
          {value}
        </div>
        {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
      </CardContent>
    </Card>
  )
}
