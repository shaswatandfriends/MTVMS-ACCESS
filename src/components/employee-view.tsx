'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck,
  LogOut,
  ChevronDown,
  ShieldAlert,
  Loader2,
  ExternalLink,
  Maximize2,
  RotateCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ChangePasswordDialog } from '@/components/change-password-dialog'
import type { AuthUser } from '@/lib/types'

interface EmployeeViewProps {
  user: AuthUser
  onLoggedOut: () => void
}

export function EmployeeView({ user, onLoggedOut }: EmployeeViewProps) {
  const [sessionOk, setSessionOk] = useState<boolean | null>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/medefis/session')
      if (res.status === 401) {
        onLoggedOut()
        return
      }
      const data = await res.json()
      setSessionOk(!!data.valid)
    } catch {
      setSessionOk(false)
    }
  }, [onLoggedOut])

  useEffect(() => {
    // Check Medefis session availability on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkSession()
  }, [checkSession])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    onLoggedOut()
    router.refresh()
  }

  function reloadIframe() {
    setLoading(true)
    setIframeKey((k) => k + 1)
  }

  function openInNewTab() {
    window.open('/api/medefis/proxy', '_blank', 'noopener')
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/10 ring-1 ring-emerald-600/20">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">Medefis Workspace</div>
              <div className="text-[11px] text-slate-500">
                Signed in as {user.displayName} · employee
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sessionOk === true && (
              <>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={reloadIframe} title="Reload">
                  <RotateCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={openInNewTab}
                  title="Open in new tab"
                >
                  <Maximize2 className="mr-2 h-4 w-4" /> Expand
                </Button>
              </>
            )}
            <Badge variant="outline" className="hidden sm:inline-flex">
              <ShieldCheck className="mr-1 h-3 w-3 text-emerald-600" /> Secured gateway
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-emerald-600/10 text-xs font-semibold text-emerald-700">
                      {user.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-slate-500">
                  Signed in as
                  <div className="font-mono text-sm text-slate-900">{user.username}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ChangePasswordDialog>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={(e) => e.preventDefault()}
                  >
                    Change password
                  </DropdownMenuItem>
                </ChangePasswordDialog>
                <DropdownMenuItem className="cursor-pointer" onClick={openInNewTab}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Open Medefis in new tab
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-rose-600" onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {sessionOk === null ? (
          <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <p className="text-sm">Checking Medefis session…</p>
          </div>
        ) : sessionOk === false ? (
          <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 text-center">
            <div className="max-w-md">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-200">
                <ShieldAlert className="h-7 w-7 text-amber-500" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">
                Medefis session unavailable
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Your administrator hasn&apos;t established a Medefis session yet, or the previous
                session expired. Please contact your administrator. You will be able to access
                Medefis as soon as the session is active.
              </p>
              <Button
                variant="outline"
                className="mt-5"
                onClick={() => checkSession()}
              >
                <RotateCw className="mr-2 h-4 w-4" /> Check again
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative h-[calc(100vh-3.5rem)] w-full">
            {loading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-100">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                <p className="text-sm text-slate-500">Loading Medefis…</p>
              </div>
            )}
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src="/api/medefis/proxy"
              title="Medefis VMS"
              className="h-full w-full border-0"
              onLoad={() => setLoading(false)}
              referrerPolicy="no-referrer"
              sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-downloads allow-modals allow-top-navigation-by-user-activation"
            />
          </div>
        )}
      </main>
    </div>
  )
}
