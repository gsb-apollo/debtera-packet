'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [apps, setApps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserEmail(user.email || '')

    const { data: companies } = await supabase
      .from('companies')
      .select('id, legal_name, entity_type')

    const { data: loanApps } = await supabase
      .from('loan_applications')
      .select('id, status, created_at, updated_at, company_id')
      .order('created_at', { ascending: false })

    if (loanApps && companies) {
      const merged = loanApps.map(app => ({
        ...app,
        company: companies.find((c: any) => c.id === app.company_id) || { legal_name: '', entity_type: '' }
      }))
      setApps(merged)
    }
    setLoading(false)
  }

  const createNewApplication = async () => {
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: company, error: compError } = await supabase
      .from('companies')
      .insert({ user_id: user.id })
      .select()
      .single()

    if (compError || !company) {
      console.error('Error creating company:', compError)
      setCreating(false)
      return
    }

    const { data: loanApp, error: loanError } = await supabase
      .from('loan_applications')
      .insert({ company_id: company.id })
      .select()
      .single()

    if (loanError || !loanApp) {
      console.error('Error creating loan app:', loanError)
      setCreating(false)
      return
    }

    router.push(`/packet/${loanApp.id}/intake`)
  }

  const startRename = (e: React.MouseEvent, app: any) => {
    e.stopPropagation()
    setEditingId(app.id)
    setEditName(app.company?.legal_name || '')
  }

  const saveRename = async (e: React.MouseEvent | React.KeyboardEvent, app: any) => {
    if ('stopPropagation' in e) e.stopPropagation()
    if (!app.company_id) return
    await supabase
      .from('companies')
      .update({ legal_name: editName.trim() || null })
      .eq('id', app.company_id)
    setEditingId(null)
    loadData()
  }

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(null)
  }

  const confirmDelete = (e: React.MouseEvent, appId: string) => {
    e.stopPropagation()
    setDeletingId(appId)
  }

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(null)
  }

  const executeDelete = async (e: React.MouseEvent, app: any) => {
    e.stopPropagation()
    await supabase.from('loan_applications').delete().eq('id', app.id)
    if (app.company_id) {
      await supabase.from('companies').delete().eq('id', app.company_id)
    }
    setDeletingId(null)
    loadData()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#FAF8F5',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
      <div style={{
        background: '#fff', borderBottom: '1px solid #E8E2DB',
        padding: '16px 24px',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{
              margin: 0, fontSize: 22, fontWeight: 700,
              color: '#2D6A4F', fontFamily: "'DM Serif Display', serif",
            }}>debtera</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#6B6B6B' }}>Financial Packet Builder</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, color: '#6B6B6B' }}>{userEmail}</span>
            <button onClick={handleLogout} style={{
              padding: '6px 14px', background: 'transparent', border: '1px solid #E8E2DB',
              borderRadius: 6, fontSize: 13, color: '#6B6B6B', cursor: 'pointer',
            }}>Sign Out</button>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#2C2C2C' }}>Your Packets</h2>
          <button onClick={createNewApplication} disabled={creating} style={{
            padding: '10px 20px', background: '#2D6A4F', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: creating ? 'wait' : 'pointer', opacity: creating ? 0.7 : 1,
          }}>{creating ? 'Creating...' : '+ New Packet'}</button>
        </div>
        {loading ? (
          <p style={{ color: '#6B6B6B', fontSize: 14 }}>Loading...</p>
        ) : apps.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: '#fff', borderRadius: 12, border: '1px solid #E8E2DB',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>No packets yet</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6B6B6B' }}>Create your first financial packet to get started.</p>
            <button onClick={createNewApplication} disabled={creating} style={{
              padding: '12px 24px', background: '#2D6A4F', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>Create Your First Packet</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {apps.map(app => (
              <div key={app.id} style={{
                padding: '20px 24px', background: '#fff', borderRadius: 12,
                border: deletingId === app.id ? '1px solid #C1524A' : '1px solid #E8E2DB',
                cursor: deletingId === app.id ? 'default' : 'pointer',
              }} onClick={() => { if (deletingId !== app.id && editingId !== app.id) router.push(`/packet/${app.id}`) }}>
                {deletingId === app.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#C1524A' }}>
                        Delete &ldquo;{app.company?.legal_name || 'Untitled Packet'}&rdquo;?
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6B6B6B' }}>
                        This will permanently remove the packet and all its data.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={(e) => cancelDelete(e)} style={{
                        padding: '6px 14px', background: 'transparent', border: '1px solid #E8E2DB',
                        borderRadius: 6, fontSize: 12, color: '#6B6B6B', cursor: 'pointer',
                      }}>Cancel</button>
                      <button onClick={(e) => executeDelete(e, app)} style={{
                        padding: '6px 14px', background: '#C1524A', border: 'none',
                        borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer',
                      }}>Delete</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      {editingId === app.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveRename(e, app); if (e.key === 'Escape') setEditingId(null) }}
                            placeholder="Packet name"
                            style={{
                              padding: '6px 10px', border: '1px solid #2D6A4F', borderRadius: 6,
                              fontSize: 15, fontWeight: 600, color: '#2C2C2C', outline: 'none',
                              background: '#FAF8F5', width: 260,
                            }}
                          />
                          <button onClick={(e) => saveRename(e, app)} style={{
                            padding: '5px 12px', background: '#2D6A4F', border: 'none',
                            borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer',
                          }}>Save</button>
                          <button onClick={(e) => cancelRename(e)} style={{
                            padding: '5px 12px', background: 'transparent', border: '1px solid #E8E2DB',
                            borderRadius: 6, fontSize: 12, color: '#6B6B6B', cursor: 'pointer',
                          }}>Cancel</button>
                        </div>
                      ) : (
                        <>
                          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: '#2C2C2C' }}>
                            {app.company?.legal_name || 'Untitled Packet'}
                          </h3>
                          <p style={{ margin: 0, fontSize: 13, color: '#6B6B6B' }}>
                            {app.company?.entity_type || 'Entity type not set'} &middot; Created {new Date(app.created_at).toLocaleDateString()}
                          </p>
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                        background: '#E8DDD3', color: '#8B7E74', textTransform: 'capitalize',
                      }}>{app.status}</div>
                      {editingId !== app.id && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={(e) => startRename(e, app)}
                            title="Rename"
                            style={{
                              padding: '4px 8px', background: 'transparent', border: '1px solid #E8E2DB',
                              borderRadius: 6, fontSize: 13, cursor: 'pointer', color: '#6B6B6B',
                              lineHeight: 1,
                            }}
                          >✏️</button>
                          <button
                            onClick={(e) => confirmDelete(e, app.id)}
                            title="Delete"
                            style={{
                              padding: '4px 8px', background: 'transparent', border: '1px solid #E8E2DB',
                              borderRadius: 6, fontSize: 13, cursor: 'pointer', color: '#6B6B6B',
                              lineHeight: 1,
                            }}
                          >🗑️</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
