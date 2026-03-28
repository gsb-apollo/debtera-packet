'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [apps, setApps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [userEmail, setUserEmail] = useState('')
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

    router.push(`/packet/${loanApp.id}`)
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
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#2C2C2C' }}>Your Applications</h2>
          <button onClick={createNewApplication} disabled={creating} style={{
            padding: '10px 20px', background: '#2D6A4F', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: creating ? 'wait' : 'pointer', opacity: creating ? 0.7 : 1,
          }}>{creating ? 'Creating...' : '+ New Application'}</button>
        </div>
        {loading ? (
          <p style={{ color: '#6B6B6B', fontSize: 14 }}>Loading...</p>
        ) : apps.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: '#fff', borderRadius: 12, border: '1px solid #E8E2DB',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>No applications yet</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6B6B6B' }}>Create your first loan application to get started.</p>
            <button onClick={createNewApplication} disabled={creating} style={{
              padding: '12px 24px', background: '#2D6A4F', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>Create Your First Application</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {apps.map(app => (
              <div key={app.id} onClick={() => router.push(`/packet/${app.id}`)} style={{
                padding: '20px 24px', background: '#fff', borderRadius: 12,
                border: '1px solid #E8E2DB', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: '#2C2C2C' }}>
                    {app.company?.legal_name || 'Untitled Application'}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#6B6B6B' }}>
                    {app.company?.entity_type || 'Entity type not set'} · Created {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div style={{
                  padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                  background: '#E8DDD3', color: '#8B7E74', textTransform: 'capitalize',
                }}>{app.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}