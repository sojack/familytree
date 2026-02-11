import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import styles from './page.module.css'

// Dev bypass user for local testing
const DEV_BYPASS = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true'

const DEV_TREE_ID = 'dev-tree-456'

export default async function TreeRedirectPage() {
  if (DEV_BYPASS) {
    console.log('🔓 DEV MODE: Redirecting to dev tree')
    redirect(`/tree/${DEV_TREE_ID}`)
  }

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  // Find the user's first tree
  const { data: trees } = await supabase
    .from('trees')
    .select('id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  if (trees && trees.length > 0) {
    redirect(`/tree/${trees[0].id}`)
  }

  // Fallback: create a default tree if none exists
  const { data: newTree, error: createError } = await supabase
    .from('trees')
    .insert({ owner_id: user.id, name: 'My Family Tree' })
    .select('id')
    .single()

  if (createError || !newTree) {
    console.error('Failed to create default tree:', createError?.message)
    return (
      <div className={styles.loading}>
        <p>Something went wrong. Please try again.</p>
      </div>
    )
  }

  redirect(`/tree/${newTree.id}`)
}
