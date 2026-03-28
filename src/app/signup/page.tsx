'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#FAF8F5', fontFamily: "'DM Sans', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
      <div style={{
        width: '100%', maxWidth: 400, padding: 32,
        background: '#fff', borderRadius: 16, border: '1px solid #E8E2DB',
      }}>
        <h1 style={{
          margin: '0 0 4px', fontSize: 28, fontWeight: 700,
          color: '#2D6A4F', fontFamily: "'DM Serif Display', serif",
        }}>debtera</h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6B6B6B' }}>Financial Packet Builder</p>
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 600, color: '#2C2C2C' }}>Create your account</h2>
        {error && (
          <div style={{
            padding: '10px 14px', background: '#FDE8E6', color: '#C1524A',
            borderRadius: 8, fontSize: 13, marginBottom: 16,
          }}>{error}</div>
        )}
        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#2C2C2C', marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #E8E2DB', borderRadius: 8, fontSize: 14, background: '#FAF8F5', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#2C2C2C', marginBottom: 4 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="At least 6 characters"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #E8E2DB', borderRadius: 8, fontSize: 14, background: '#FAF8F5', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#2C2C2C', marginBottom: 4 }}>Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Confirm your password"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #E8E2DB', borderRadius: 8, fontSize: 14, background: '#FAF8F5', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px', background: '#2D6A4F', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
          }}>{loading ? 'Creating account...' : 'Create Account'}</button>
        </form>
        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#6B6B6B' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#2D6A4F', fontWeight: 600, textDecoration: 'none' }}>Sign in</a>
        </p>
      </div>
    </div>
  )
}