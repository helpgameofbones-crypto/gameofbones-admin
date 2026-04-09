'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Plus, X, Shield, Eye, Edit, Trash2, User } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ROLES = {
  admin: { label: 'Admin', color: 'bg-red-100 text-red-700', description: 'Full access to everything', icon: '' },
  manager: { label: 'Manager', color: 'bg-blue-100 text-blue-700', description: 'Orders, customers, inventory  no finance', icon: '' },
  operations: { label: 'Operations', color: 'bg-green-100 text-green-700', description: 'Orders and shipping only', icon: '' },
  viewer: { label: 'Viewer', color: 'bg-gray-100 text-gray-700', description: 'Read-only access to dashboard and orders', icon: '' },
}

const PERMISSIONS: Record<string, string[]> = {
  admin: ['dashboard', 'orders', 'products', 'customers', 'finance', 'analytics', 'campaigns', 'settings', 'team', 'production', 'inventory', 'returns', 'coupons', 'banners'],
  manager: ['dashboard', 'orders', 'products', 'customers', 'analytics', 'campaigns', 'inventory', 'returns', 'coupons', 'banners', 'production'],
  operations: ['dashboard', 'orders', 'inventory', 'returns', 'production'],
  viewer: ['dashboard', 'orders', 'analytics'],
}

export default function TeamAccessPage() {
  const [team, setTeam] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [form, setForm] = useState({ email: '', name: '', role: 'manager' })
  const [inviteResult, setInviteResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => { fetchTeam() }, [])

  async function fetchTeam() {
    setLoading(true)
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: false })
    setTeam(data || [])
    setLoading(false)
  }

  async function inviteMember() {
    if (!form.email || !form.name) return
    setInviting(true)
    setInviteResult(null)

    // Check if already exists
    const existing = team.find(m => m.email === form.email)
    if (existing) {
      setInviteResult({ success: false, message: 'This email is already in the team.' })
      setInviting(false)
      return
    }

    const { error } = await supabase.from('team_members').insert({
      email: form.email,
      name: form.name,
      role: form.role,
      permissions: PERMISSIONS[form.role],
      status: 'invited',
      invited_at: new Date().toISOString(),
    })

    if (error) {
      setInviteResult({ success: false, message: 'Failed to add member. Try again.' })
    } else {
      setInviteResult({ success: true, message: `${form.name} added as ${ROLES[form.role as keyof typeof ROLES].label}. Share the admin panel URL with them and ask them to sign up with this email.` })
      setForm({ email: '', name: '', role: 'manager' })
      fetchTeam()
    }
    setInviting(false)
  }

  async function updateRole(id: string, role: string) {
    await supabase.from('team_members').update({
      role,
      permissions: PERMISSIONS[role],
    }).eq('id', id)
    setTeam(prev => prev.map(m => m.id === id ? { ...m, role, permissions: PERMISSIONS[role] } : m))
  }

  async function removeMember(id: string) {
    await supabase.from('team_members').delete().eq('id', id)
    setTeam(prev => prev.filter(m => m.id !== id))
  }

  async function toggleStatus(id: string, current: string) {
    const status = current === 'active' ? 'suspended' : 'active'
    await supabase.from('team_members').update({ status }).eq('id', id)
    setTeam(prev => prev.map(m => m.id === id ? { ...m, status } : m))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto" style={{ background: '#f9f6f2', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Access</h1>
          <p className="text-sm text-gray-500 mt-1">Manage who can access the admin panel and what they can do</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors">
          <Plus size={16} /> Add Member
        </button>
      </div>

      {/* Role Reference */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Object.entries(ROLES).map(([key, role]) => (
          <div key={key} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span>{role.icon}</span>
              <span className={"text-xs font-semibold px-2 py-0.5 rounded-full " + role.color}>{role.label}</span>
            </div>
            <div className="text-xs text-gray-500">{role.description}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {PERMISSIONS[key].slice(0, 3).map(p => (
                <span key={p} className="text-xs bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded capitalize">{p}</span>
              ))}
              {PERMISSIONS[key].length > 3 && (
                <span className="text-xs text-gray-400">+{PERMISSIONS[key].length - 3} more</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Team List */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading team...</div>
      ) : team.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <User size={48} className="mx-auto mb-3 text-gray-300" />
          <div className="text-lg font-semibold text-gray-700">No team members yet</div>
          <div className="text-sm text-gray-400 mt-1">Add Vatsal or other team members to give them access</div>
        </div>
      ) : (
        <div className="space-y-3">
          {team.map(member => {
            const role = ROLES[member.role as keyof typeof ROLES] || ROLES.viewer
            return (
              <div key={member.id} className={"bg-white border rounded-xl p-4 shadow-sm " + (member.status === 'suspended' ? 'border-red-100 opacity-60' : 'border-gray-100')}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">
                      {member.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{member.name}</div>
                      <div className="text-xs text-gray-400">{member.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={"text-xs font-semibold px-2.5 py-1 rounded-full " + role.color}>
                      {role.icon} {role.label}
                    </span>
                    <span className={"text-xs px-2 py-0.5 rounded-full font-medium " + (member.status === 'active' ? 'bg-green-100 text-green-700' : member.status === 'invited' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600')}>
                      {member.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select value={member.role} onChange={e => updateRole(member.id, e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400 bg-white">
                      {Object.entries(ROLES).map(([key, r]) => (
                        <option key={key} value={key}>{r.label}</option>
                      ))}
                    </select>
                    <button onClick={() => toggleStatus(member.id, member.status)}
                      className={"px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors " + (member.status === 'active' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200')}>
                      {member.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                    <button onClick={() => removeMember(member.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Permissions */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(member.permissions || []).map((p: string) => (
                    <span key={p} className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full capitalize">{p}</span>
                  ))}
                </div>

                {member.invited_at && (
                  <div className="mt-2 text-xs text-gray-400">
                    Added {new Date(member.invited_at).toLocaleDateString('en-IN')}
                    {member.last_active && '  Last active ' + new Date(member.last_active).toLocaleDateString('en-IN')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Add Team Member</h2>
              <button onClick={() => { setShowInvite(false); setInviteResult(null) }}>
                <X size={20} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Full Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Vatsal" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Email Address *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="vatsal@gameofbones.in" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Role *</label>
                <div className="space-y-2">
                  {Object.entries(ROLES).map(([key, role]) => (
                    <label key={key} className={"flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors " + (form.role === key ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300')}>
                      <input type="radio" name="role" value={key} checked={form.role === key}
                        onChange={() => setForm(f => ({ ...f, role: key }))} className="mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{role.icon} {role.label}</div>
                        <div className="text-xs text-gray-500">{role.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {inviteResult && (
                <div className={"rounded-lg px-4 py-3 text-sm " + (inviteResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>
                  {inviteResult.message}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={inviteMember} disabled={inviting || !form.email || !form.name}
                  className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors">
                  {inviting ? 'Adding...' : 'Add Member'}
                </button>
                <button onClick={() => { setShowInvite(false); setInviteResult(null) }}
                  className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}