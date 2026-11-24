'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  KeyRound,
  Activity,
  LogOut,
  ChevronDown,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ChangePasswordDialog } from '@/components/change-password-dialog'
import { OverviewPanel } from '@/components/admin/overview-panel'
import { EmployeesPanel } from '@/components/admin/employees-panel'
import { CredentialsPanel } from '@/components/admin/credentials-panel'
import { ActivityPanel } from '@/components/admin/activity-panel'
import type { AuthUser } from '@/lib/types'

interface AdminDashboardProps {
  user: AuthUser
  onLoggedOut: () => void
}

export function AdminDashboard({ user, onLoggedOut }: AdminDashboardProps) {
  const [tab, setTab] = useState('overview')
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    onLoggedOut()
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/10 ring-1 ring-emerald-600/20">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">
                Medefis Parent Control
              </div>
              <div className="text-[11px] text-slate-500">Administrator console</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex">
              <ShieldCheck className="mr-1 h-3 w-3 text-emerald-600" /> Admin
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-emerald-600/10 text-xs font-semibold text-emerald-700">
                      {user.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">{user.displayName}</span>
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
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-rose-600" onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 grid h-auto w-full grid-cols-2 sm:flex sm:w-auto sm:grid-cols-4">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="employees" className="gap-1.5">
              <Users className="h-4 w-4" /> Employees
            </TabsTrigger>
            <TabsTrigger value="medefis" className="gap-1.5">
              <KeyRound className="h-4 w-4" /> Medefis
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5">
              <Activity className="h-4 w-4" /> Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
            <OverviewPanel refreshKey={0} />
          </TabsContent>
          <TabsContent value="employees" className="mt-0 focus-visible:outline-none">
            <EmployeesPanel />
          </TabsContent>
          <TabsContent value="medefis" className="mt-0 focus-visible:outline-none">
            <CredentialsPanel />
          </TabsContent>
          <TabsContent value="activity" className="mt-0 focus-visible:outline-none">
            <ActivityPanel />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-400 sm:flex-row sm:px-6">
          <span>Medefis Parent Control System · Secure VMS gateway</span>
          <span>All employee access is proxied &amp; logged.</span>
        </div>
      </footer>
    </div>
  )
}
