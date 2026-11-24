'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  LogIn,
  ClipboardPaste,
  Trash2,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import type { MedefisSessionStatus } from '@/lib/types'

export function CredentialsPanel() {
  const [status, setStatus] = useState<MedefisSessionStatus | null>(null)
  const [storedUsername, setStoredUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/medefis/credentials')
      const data = await res.json()
      setStatus(data.status ?? null)
      setStoredUsername(data.username ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function medefisLogin(signin?: string) {
    setBusy('login')
    try {
      const res = await fetch('/api/medefis/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signin }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(`Signed in to Medefis. App: ${data.appBaseUrl}`)
      } else {
        toast.error(data.error || 'Medefis login failed. Try manual cookie paste.')
      }
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function clearSession() {
    setBusy('clear-session')
    try {
      await fetch('/api/medefis/session', { method: 'DELETE' })
      toast.success('Medefis session cleared.')
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function clearCredentials() {
    setBusy('clear-creds')
    try {
      await fetch('/api/medefis/credentials', { method: 'DELETE' })
      toast.success('Medefis credentials removed.')
      await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Medefis connection</h2>
        <p className="text-sm text-slate-500">
          Store your Medefis credentials here (encrypted) and establish the shared session your
          employees will use. Credentials are never shown to employees.
        </p>
      </div>

      {/* Session status banner */}
      <Card className={status?.valid ? 'ring-1 ring-emerald-200' : 'ring-1 ring-amber-200'}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            {status?.valid ? (
              <ShieldCheck className="h-8 w-8 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-8 w-8 text-amber-500" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">
                  {loading
                    ? 'Checking…'
                    : status?.valid
                      ? 'Medefis session active'
                      : 'No active Medefis session'}
                </span>
                {status?.valid ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600">Live</Badge>
                ) : (
                  <Badge variant="secondary">Offline</Badge>
                )}
              </div>
              <div className="text-xs text-slate-500">
                {status?.appBaseUrl ? (
                  <span className="font-mono">{status.appBaseUrl}</span>
                ) : (
                  'Establish a session so employees can access Medefis.'
                )}
                {status?.expiresAt && (
                  <> · expires {new Date(status.expiresAt).toLocaleString()}</>
                )}
                {status?.lastError && (
                  <div className="mt-1 text-rose-600">Last error: {status.lastError}</div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => medefisLogin()}
              disabled={!!busy || !status?.hasCredentials}
            >
              {busy === 'login' ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
              )}
              Re-establish session
            </Button>
            {status?.valid && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearSession}
                disabled={!!busy}
              >
                {busy === 'clear-session' ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                )}
                Clear session
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Credentials card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-emerald-600" /> Medefis credentials
            </CardTitle>
            <CardDescription>
              Stored encrypted (AES-256-GCM). Used only server-side to log in to Medefis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
              <div className="mt-1 flex items-center gap-2 text-sm">
                {storedUsername ? (
                  <>
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">Stored</Badge>
                    <span className="text-slate-600">
                      for <span className="font-mono">{storedUsername}</span>
                    </span>
                  </>
                ) : (
                  <Badge variant="secondary">Not stored</Badge>
                )}
              </div>
            </div>

            <SaveCredentialsDialog
              currentUsername={storedUsername}
              busy={busy}
              setBusy={setBusy}
              onSaved={load}
            />

            <Button
              variant="outline"
              className="w-full"
              onClick={() => medefisLogin()}
              disabled={!!busy || !status?.hasCredentials}
            >
              {busy === 'login' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              Sign in to Medefis now
            </Button>

            {storedUsername && (
              <>
                <Separator />
                <Button
                  variant="ghost"
                  className="w-full text-rose-600 hover:text-rose-700"
                  onClick={clearCredentials}
                  disabled={!!busy}
                >
                  {busy === 'clear-creds' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Remove stored credentials
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Manual cookie paste */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardPaste className="h-4 w-4 text-emerald-600" /> Manual cookie paste
            </CardTitle>
            <CardDescription>
              Reliable fallback for SSO/SAML flows. Paste the cookie header from your browser
              after logging in to Medefis yourself.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ManualPasteDialog busy={busy} setBusy={setBusy} onSaved={load} />
            <ol className="space-y-2 rounded-md bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200">
              <li>
                <strong>1.</strong> Open{' '}
                <a
                  href="https://identity.medefis5.com/identity/login"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-emerald-700 underline"
                >
                  identity.medefis5.com <ExternalLink className="h-3 w-3" />
                </a>{' '}
                and sign in normally.
              </li>
              <li>
                <strong>2.</strong> After landing on the Medefis app, open DevTools →
                Application → Cookies (or Network → click any request → Headers).
              </li>
              <li>
                <strong>3.</strong> Copy the full <span className="font-mono">Cookie:</span>{' '}
                request header value and the app URL, then paste them here.
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SaveCredentialsDialog({
  currentUsername,
  busy,
  setBusy,
  onSaved,
}: {
  currentUsername: string | null
  busy: string | null
  setBusy: (v: string | null) => void
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (open) {
      setUsername(currentUsername ?? '')
      setPassword('')
    }
  }, [open, currentUsername])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) {
      toast.error('Username and password are required.')
      return
    }
    setBusy('save-creds')
    try {
      const res = await fetch('/api/medefis/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        toast.success('Medefis credentials saved (encrypted).')
        setOpen(false)
        onSaved()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Could not save credentials.')
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant={currentUsername ? 'outline' : 'default'}>
          <KeyRound className="mr-2 h-4 w-4" />
          {currentUsername ? 'Replace Medefis credentials' : 'Add Medefis credentials'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Medefis credentials</DialogTitle>
          <DialogDescription>
            These are your real Medefis login details. They are encrypted before storage and used
            only to establish the shared session.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mf-user">Medefis username</Label>
            <Input
              id="mf-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy === 'save-creds'}
              placeholder="your.medefis.username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mf-pass">Medefis password</Label>
            <div className="relative">
              <Input
                id="mf-pass"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy === 'save-creds'}
                placeholder="••••••••"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7"
                onClick={() => setShow((s) => !s)}
                tabIndex={-1}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy === 'save-creds'}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy === 'save-creds'}>
              {busy === 'save-creds' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                'Save & encrypt'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ManualPasteDialog({
  busy,
  setBusy,
  onSaved,
}: {
  busy: string | null
  setBusy: (v: string | null) => void
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [cookies, setCookies] = useState('')
  const [appBaseUrl, setAppBaseUrl] = useState('https://medefis5.com')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!cookies || !appBaseUrl) {
      toast.error('Cookie header and app URL are required.')
      return
    }
    setBusy('paste')
    try {
      const res = await fetch('/api/medefis/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cookies, appBaseUrl }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Manual session stored. Employees can now access Medefis.')
        setOpen(false)
        setCookies('')
        onSaved()
      } else {
        toast.error(data.error || 'Could not store cookies.')
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <ClipboardPaste className="mr-2 h-4 w-4" /> Paste cookies manually
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Paste Medefis session cookies</DialogTitle>
          <DialogDescription>
            Copy the full <span className="font-mono">Cookie</span> request header from your
            browser after logging in to Medefis.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="paste-app">Medefis app URL</Label>
            <Input
              id="paste-app"
              value={appBaseUrl}
              onChange={(e) => setAppBaseUrl(e.target.value)}
              placeholder="https://medefis5.com"
              disabled={busy === 'paste'}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paste-cookies">Cookie header</Label>
            <Textarea
              id="paste-cookies"
              value={cookies}
              onChange={(e) => setCookies(e.target.value)}
              placeholder="name1=value1; name2=value2; ..."
              className="min-h-[8rem] font-mono text-xs"
              disabled={busy === 'paste'}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy === 'paste'}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy === 'paste'}>
              {busy === 'paste' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Storing…
                </>
              ) : (
                'Store session'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
