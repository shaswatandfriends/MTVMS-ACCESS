'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  MonitorPlay,
  Loader2,
  MousePointerClick,
  Keyboard,
  Check,
  RefreshCw,
  CornerDownLeft,
  ArrowRight,
  Delete,
  X,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface HeadlessLoginPanelProps {
  hasCredentials: boolean
  entryUrl: string | null
  busy: string | null
  setBusy: (v: string | null) => void
  onSession: () => void
}

type Phase = 'idle' | 'logging-in' | 'need-manual' | 'success'

export function HeadlessLoginPanel({
  hasCredentials,
  entryUrl,
  busy,
  setBusy,
  onSession,
}: HeadlessLoginPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [reason, setReason] = useState('')
  const [shotKey, setShotKey] = useState(0)
  const [manualText, setManualText] = useState('')
  const [shotLoading, setShotLoading] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const liveViewRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshShot = useCallback(() => {
    setShotKey((k) => k + 1)
  }, [])

  // Poll screenshots while in manual mode + scroll the live view into view.
  useEffect(() => {
    if (phase === 'need-manual') {
      refreshShot()
      // Bring the live view into view so the admin sees it immediately.
      setTimeout(() => {
        liveViewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
      pollRef.current = setInterval(refreshShot, 2000)
      return () => {
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }
  }, [phase, refreshShot])

  async function startAutoLogin() {
    if (!hasCredentials) {
      toast.error('Add your Medefis credentials first.')
      return
    }
    if (!entryUrl) {
      toast.error('Set your Medefis entry URL in the credentials dialog first.')
      return
    }
    setBusy('headless-login')
    setPhase('logging-in')
    try {
      const res = await fetch('/api/medefis/headless/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.ok) {
        setPhase('success')
        toast.success(`Automated login succeeded. App: ${data.appBaseUrl}`)
        onSession()
        setTimeout(() => setPhase('idle'), 4000)
      } else if (data.needManual) {
        setPhase('need-manual')
        setReason(data.reason || 'Complete the login manually.')
        toast.info('MFA or captcha detected — finish the login in the live view below.')
      } else {
        setPhase('idle')
        toast.error(data.error || 'Automated login failed.')
      }
    } catch {
      setPhase('idle')
      toast.error('Browser service not reachable.')
    } finally {
      setBusy(null)
    }
  }

  async function clickOnImage(e: React.MouseEvent<HTMLImageElement>) {
    const img = imgRef.current
    if (!img) return
    const rect = img.getBoundingClientRect()
    const scaleX = img.naturalWidth / rect.width
    const scaleY = img.naturalHeight / rect.height
    const x = Math.round((e.clientX - rect.left) * scaleX)
    const y = Math.round((e.clientY - rect.top) * scaleY)
    setShotLoading(true)
    try {
      await fetch('/api/medefis/headless/click', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ x, y }),
      })
      setTimeout(refreshShot, 600)
    } finally {
      setShotLoading(false)
    }
  }

  async function typeText() {
    if (!manualText) return
    setShotLoading(true)
    try {
      await fetch('/api/medefis/headless/type', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: manualText }),
      })
      setManualText('')
      setTimeout(refreshShot, 600)
    } finally {
      setShotLoading(false)
    }
  }

  async function pressKey(key: string) {
    setShotLoading(true)
    try {
      await fetch('/api/medefis/headless/press', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      setTimeout(refreshShot, 600)
    } finally {
      setShotLoading(false)
    }
  }

  async function extractSession() {
    setBusy('extract')
    try {
      const res = await fetch('/api/medefis/headless/extract')
      const data = await res.json()
      if (data.ok) {
        setPhase('success')
        toast.success('Medefis session captured. Employees can now access Medefis.')
        onSession()
        setTimeout(() => setPhase('idle'), 4000)
      } else {
        toast.error(data.error || 'Could not capture session. Make sure you are on the Medefis app page.')
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="ring-1 ring-emerald-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MonitorPlay className="h-4 w-4 text-emerald-600" /> Automated login (headless browser)
        </CardTitle>
        <CardDescription>
          A real browser logs into Medefis on your behalf — passing Incapsula&apos;s bot check
          automatically. If MFA or a captcha appears, you finish it in the live view below. The
          captured session is then shared with employees you&apos;ve permitted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={startAutoLogin}
            disabled={!!busy || !hasCredentials || !entryUrl}
          >
            {busy === 'headless-login' || phase === 'logging-in' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging in…
              </>
            ) : (
              <>
                <MonitorPlay className="mr-2 h-4 w-4" /> Log in to Medefis automatically
              </>
            )}
          </Button>
          {entryUrl ? (
            <Badge variant="outline" className="font-mono text-xs truncate max-w-[20rem]">
              {entryUrl}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">No entry URL set</Badge>
          )}
          {phase === 'success' && (
            <Badge className="bg-emerald-600 hover:bg-emerald-600">
              <Check className="mr-1 h-3 w-3" /> Session captured
            </Badge>
          )}
        </div>

        {!hasCredentials && (
          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200">
            <AlertCircle className="mr-1 inline h-3 w-3" />
            Add your Medefis credentials (username, password, and entry URL) in the dialog below
            first, then click the button above.
          </p>
        )}

        {phase === 'need-manual' && (
          <div ref={liveViewRef} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span>{reason}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPhase('idle')}>
                <X className="mr-1 h-3.5 w-3.5" /> Close live view
              </Button>
            </div>

            <div className="relative overflow-hidden rounded-md border border-slate-300 bg-white">
              {shotLoading && (
                <div className="absolute right-2 top-2 z-10 rounded bg-black/60 px-2 py-1 text-xs text-white">
                  <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> working…
                </div>
              )}
              <img
                ref={imgRef}
                src={`/api/medefis/headless/screenshot?k=${shotKey}`}
                alt="Medefis live view"
                onClick={clickOnImage}
                onLoad={() => setShotLoading(false)}
                className="block h-auto w-full cursor-crosshair"
              />
            </div>
            <p className="text-xs text-slate-500">
              <MousePointerClick className="mr-1 inline h-3 w-3" />
              Click anywhere on the image to click there in the real browser. Use the controls
              below to type or press keys.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-1 items-center gap-2">
                <Keyboard className="h-4 w-4 shrink-0 text-slate-400" />
                <Input
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') typeText()
                  }}
                  placeholder="Type text, then press Enter or click Type"
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={typeText} disabled={!manualText}>
                  Type
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">Keys:</span>
              <Button variant="outline" size="sm" onClick={() => pressKey('Enter')}>
                <CornerDownLeft className="mr-1 h-3.5 w-3.5" /> Enter
              </Button>
              <Button variant="outline" size="sm" onClick={() => pressKey('Tab')}>
                <ArrowRight className="mr-1 h-3.5 w-3.5" /> Tab
              </Button>
              <Button variant="outline" size="sm" onClick={() => pressKey('Escape')}>
                Esc
              </Button>
              <Button variant="outline" size="sm" onClick={() => pressKey('Backspace')}>
                <Delete className="mr-1 h-3.5 w-3.5" /> Backspace
              </Button>
              <Button variant="outline" size="sm" onClick={refreshShot}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
              </Button>
              <Button onClick={extractSession} disabled={!!busy} className="ml-auto">
                {busy === 'extract' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Capturing…
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" /> I&apos;m in — capture session
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
