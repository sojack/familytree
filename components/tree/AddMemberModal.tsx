'use client'

import { useState } from 'react'
import styles from './AddMemberModal.module.css'

interface AddMemberModalProps {
  onClose: () => void
  onAdd: (name: string, birthYear: string) => void
}

export default function AddMemberModal({ onClose, onAdd }: AddMemberModalProps) {
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    setLoading(true)
    await onAdd(name.trim(), birthYear.trim())
    setLoading(false)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Add Family Member</h2>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="name" className={styles.label}>
              Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Grandma Rose"
              required
              autoFocus
              className={styles.input}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="birthYear" className={styles.label}>
              Birth Year
            </label>
            <input
              id="birthYear"
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="e.g., 1950"
              min="1800"
              max={new Date().getFullYear()}
              className={styles.input}
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className={styles.addButton}
            >
              {loading ? 'Adding...' : 'Add Person'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
