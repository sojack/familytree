import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TreeCanvas from '@/components/tree/TreeCanvas'
import styles from './page.module.css'

export default async function TreePage() {
  const supabase = createClient()
  
  // Get user with error handling
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError) {
    console.error('Auth error:', authError.message)
  }

  if (!user) {
    console.log('No user found, redirecting to login')
    redirect('/auth/login')
  }

  console.log('User authenticated:', user.email)

  // Fetch members for this user
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (membersError) {
    console.error('Members fetch error:', membersError.message)
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>My Family Tree</h1>
        <form action="/auth/signout" method="post">
          <button type="submit" className={styles.signoutButton}>
            Sign Out
          </button>
        </form>
      </header>
      <main className={styles.main}>
        <TreeCanvas initialMembers={members || []} userId={user.id} />
      </main>
    </div>
  )
}
