'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  UserPlus,
  Trash2,
  Power,
  KeyRound,
  Loader2,
  Users,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import type { Employee } from '@/lib/types'

export function EmployeesPanel() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/employees')
      const data = await res.json()
      setEmployees(data.employees ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = employees.filter(
    (e) =>
      e.username.toLowerCase().includes(query.toLowerCase()) ||
      e.displayName.toLowerCase().includes(query.toLowerCase()) ||
      (e.email ?? '').toLowerCase().includes(query.toLowerCase()),
  )

  async function toggleActive(emp: Employee) {
    const res = await fetch('/api/employees', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: emp.id, active: !emp.active }),
    })
    if (res.ok) {
      toast.success(`${emp.displayName} ${emp.active ? 'disabled' : 'enabled'}.`)
      load()
    } else {
      toast.error('Could not update employee.')
    }
  }

  async function remove(emp: Employee) {
    const res = await fetch(`/api/employees?id=${emp.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(`${emp.displayName} removed.`)
      load()
    } else {
      toast.error('Could not delete employee.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Employees</h2>
          <p className="text-sm text-slate-500">
            Employees you add sign in here with their own credentials and see the logged-in
            Medefis screen — never the Medefis password.
          </p>
        </div>
        <AddEmployeeDialog onCreated={load} />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search employees…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="ml-auto">
          {employees.length} total · {employees.filter((e) => e.active).length} active
        </Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading employees…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center text-sm text-slate-500">
              <Users className="h-8 w-8 text-slate-300" />
              {employees.length === 0
                ? 'No employees yet. Add your first employee to grant them Medefis access.'
                : 'No employees match your search.'}
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium text-slate-900">
                        {emp.displayName}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{emp.username}</TableCell>
                      <TableCell className="text-slate-600">{emp.email ?? '—'}</TableCell>
                      <TableCell>
                        {emp.active ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {new Date(emp.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <EditEmployeeDialog employee={emp} onSaved={load} />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={emp.active ? 'Disable' : 'Enable'}
                            onClick={() => toggleActive(emp)}
                          >
                            <Power className="h-4 w-4 text-slate-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-rose-600 hover:text-rose-700"
                            title="Delete"
                            onClick={() => remove(emp)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AddEmployeeDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !displayName || !password) {
      toast.error('Username, display name and password are required.')
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, displayName, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not add employee.')
        return
      }
      toast.success(`${displayName} added. They can now sign in as an employee.`)
      setOpen(false)
      setUsername('')
      setDisplayName('')
      setEmail('')
      setPassword('')
      onCreated()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" /> Add employee
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            This person will sign in to the gateway (not Medefis) and see the logged-in Medefis
            screen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-user">Username</Label>
              <Input id="add-user" value={username} onChange={(e) => setUsername(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-name">Display name</Label>
              <Input id="add-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={loading} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-email">Email (optional)</Label>
            <Input id="add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-pass">Temporary password (min 8 chars)</Label>
            <Input id="add-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
            <p className="text-xs text-slate-400">
              The employee can change this after their first sign-in.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding…
                </>
              ) : (
                'Add employee'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditEmployeeDialog({
  employee,
  onSaved,
}: {
  employee: Employee
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState(employee.displayName)
  const [email, setEmail] = useState(employee.email ?? '')
  const [active, setActive] = useState(employee.active)
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setDisplayName(employee.displayName)
      setEmail(employee.email ?? '')
      setActive(employee.active)
      setNewPassword('')
    }
  }, [open, employee])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/employees', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: employee.id,
          displayName,
          email,
          active,
          newPassword: newPassword || undefined,
        }),
      })
      if (res.ok) {
        toast.success(`${employee.username} updated.`)
        setOpen(false)
        onSaved()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Update failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit">
          <KeyRound className="h-4 w-4 text-slate-500" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {employee.username}</DialogTitle>
          <DialogDescription>Update profile, reset password, or toggle access.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Display name</Label>
            <Input id="edit-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-slate-500">When off, the employee cannot sign in.</div>
            </div>
            <Switch checked={active} onCheckedChange={setActive} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-pass">Reset password (leave blank to keep)</Label>
            <Input
              id="edit-pass"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 chars)"
              disabled={loading}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
