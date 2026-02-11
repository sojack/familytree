import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/tree'

  // Use the configured app URL or fall back to the request origin
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth callback error:', error.message)
      return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
    }

    // Redirect to wherever `next` points (e.g. /auth/reset-password for recovery)
    return NextResponse.redirect(`${origin}${next}`)
  }

  // No code provided
  return NextResponse.redirect(`${origin}/auth/login?error=No authorization code provided`)
}
