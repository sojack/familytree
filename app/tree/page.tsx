import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import styles from './page.module.css'

// Dev bypass user for local testing
const DEV_BYPASS = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true'

const DEV_TREE_ID = 'dev-tree-456'

export default async function TreeRedirectPage() {
  if (DEV_BYPASS) {
    redirect(`/tree/${DEV_TREE_ID}`)
  }

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  // Fetch all of the user's trees
  const { data: trees, error: treesError } = await supabase
    .from('trees')
    .select('id, name, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })

  if (treesError) {
    console.error('Trees query error:', treesError.message)
    return (
      <div className={styles.loading}>
        <p>Something went wrong. Please try again later.</p>
      </div>
    )
  }

  // 0 trees → create default + redirect
  if (!trees || trees.length === 0) {
    const { data: newTree, error: createError } = await supabase
      .from('trees')
      .insert({ owner_id: user.id, name: 'My Family Tree' })
      .select('id')
      .single()

    if (createError || !newTree) {
      console.error('Failed to create default tree:', createError?.message)
      return (
        <div className={styles.loading}>
          <p>Something went wrong. Please try again later.</p>
        </div>
      )
    }

    redirect(`/tree/${newTree.id}`)
  }

  // 1 tree → redirect directly
  if (trees.length === 1) {
    redirect(`/tree/${trees[0].id}`)
  }

  // 2+ trees → show tree list
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>My Family Trees</h1>
        <form action="/auth/signout" method="post">
          <button type="submit" className={styles.signoutButton}>
            Sign Out
          </button>
        </form>
      </header>
      <main className={styles.treeList}>
        {trees.map((tree) => (
          <Link key={tree.id} href={`/tree/${tree.id}`} className={styles.treeCard}>
            <span className={styles.treeCardName}>{tree.name}</span>
            <span className={styles.treeCardDate}>
              Created {new Date(tree.created_at).toLocaleDateString()}
            </span>
          </Link>
        ))}
        <form action={async () => {
          'use server'
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) redirect('/auth/login')
          const { data: newTree } = await supabase
            .from('trees')
            .insert({ owner_id: user.id, name: 'New Family Tree' })
            .select('id')
            .single()
          if (newTree) redirect(`/tree/${newTree.id}`)
          redirect('/tree')
        }}>
          <button type="submit" className={styles.newTreeButton}>
            + New Tree
          </button>
        </form>
      </main>
    </div>
  )
}
