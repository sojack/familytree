import Link from 'next/link'
import styles from './page.module.css'

export default function HomePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>Family Tree</span>
        <nav className={styles.nav}>
          <Link href="/auth/login" className={styles.navLink}>Sign In</Link>
          <Link href="/tree" className={styles.navButton}>Get Started</Link>
        </nav>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>
            Map your family.<br />Tell your story.
          </h1>
          <p className={styles.subtitle}>
            Build an interactive family tree with parents, spouses, and generations — all in a visual canvas you can explore and share.
          </p>
          <div className={styles.ctas}>
            <Link href="/tree" className={styles.ctaPrimary}>
              Start Your Tree
            </Link>
            <Link href="/auth/login" className={styles.ctaSecondary}>
              Sign In
            </Link>
          </div>
        </div>

        <section className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🌳</div>
            <h3 className={styles.featureTitle}>Visual Canvas</h3>
            <p className={styles.featureDesc}>
              Drag, zoom, and explore your family tree on an interactive graph powered by ReactFlow.
            </p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🔗</div>
            <h3 className={styles.featureTitle}>Relationships</h3>
            <p className={styles.featureDesc}>
              Connect family members as parents or spouses with a simple click-to-link interface.
            </p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🔒</div>
            <h3 className={styles.featureTitle}>Private &amp; Secure</h3>
            <p className={styles.featureDesc}>
              Your data is yours. Row-level security ensures only you can access your tree.
            </p>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>Family Tree &mdash; Your story, visualized.</p>
      </footer>
    </div>
  )
}
