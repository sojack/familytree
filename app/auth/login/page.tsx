'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.css'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const searchParams = useSearchParams()

  // Check for error in URL (from callback redirect)
  useEffect(() => {
    const errorMsg = searchParams.get('error')
    if (errorMsg) {
      setError(errorMsg)
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    const supabase = createClient()
    
    const redirectTo = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${redirectTo}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage('Check your email for the magic link!')
    }
    
    setLoading(false)
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Family Tree</h1>
      <p className={styles.subtitle}>Sign in to view your family story</p>
      
      <form onSubmit={handleLogin} className={styles.form}>
        <div className={styles.inputGroup}>
          <label htmlFor="email" className={styles.label}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className={styles.input}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          className={styles.button}
        >
          {loading ? 'Sending...' : 'Send Magic Link'}
        </button>
      </form>
      
      {message && (
        <div className={styles.message}>{message}</div>
      )}
      
      {error && (
        <div className={styles.error}>{error}</div>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className={styles.container}>
      <Suspense fallback={<div className={styles.card}>Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
