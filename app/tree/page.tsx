import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TreeCanvas from '@/components/tree/TreeCanvas'
import styles from './page.module.css'

export default async function TreePage() {
  const supabase = createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/auth/login')
  }

  // Fetch members for this user
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (membersError) {
    console.error('Members fetch error:', membersError.message)
  }

  // Fetch relationships for this user
  const { data: relationships, error: relError } = await supabase
    .from('relationships')
    .select('*')
    .eq('user_id', user.id)

  if (relError) {
    console.error('Relationships fetch error:', relError.message)
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
        <TreeCanvas 
          initialMembers={members || []} 
          initialRelationships={relationships || []}
          userId={user.id} 
        />
      </main>
    </div>
  )
}
