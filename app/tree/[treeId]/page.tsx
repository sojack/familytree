import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TreeCanvas from '@/components/tree/TreeCanvas'
import styles from './page.module.css'

// Dev bypass for local testing
const DEV_BYPASS = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true'

const DEV_TREE_ID = 'dev-tree-456'

interface TreePageProps {
  params: Promise<{ treeId: string }>
}

export default async function TreePage({ params }: TreePageProps) {
  const { treeId } = await params

  if (DEV_BYPASS) {
    console.log('🔓 DEV MODE: Loading tree', treeId)
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>My Family Tree</h1>
          <div className={styles.headerRight}>
            <span className={styles.devBadge}>🔓 DEV MODE</span>
          </div>
        </header>
        <main className={styles.main}>
          <TreeCanvas
            initialMembers={[]}
            initialRelationships={[]}
            treeId={treeId}
          />
        </main>
      </div>
    )
  }

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  // Fetch tree (RLS ensures only owner can see it)
  const { data: tree, error: treeError } = await supabase
    .from('trees')
    .select('*')
    .eq('id', treeId)
    .single()

  if (treeError || !tree) {
    notFound()
  }

  // Fetch members for this tree
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('*')
    .eq('tree_id', treeId)
    .order('created_at', { ascending: true })

  if (membersError) {
    console.error('Members fetch error:', membersError.message)
  }

  // Fetch relationships for this tree
  const { data: relationships, error: relError } = await supabase
    .from('relationships')
    .select('*')
    .eq('tree_id', treeId)

  if (relError) {
    console.error('Relationships fetch error:', relError.message)
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{tree.name}</h1>
        <div className={styles.headerRight}>
          <form action="/auth/signout" method="post">
            <button type="submit" className={styles.signoutButton}>
              Sign Out
            </button>
          </form>
        </div>
      </header>
      <main className={styles.main}>
        <TreeCanvas
          initialMembers={members || []}
          initialRelationships={relationships || []}
          treeId={treeId}
        />
      </main>
    </div>
  )
}
