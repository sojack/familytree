'use client'

import { useState } from 'react'
import { Member } from '@/types'
import styles from './EditMemberModal.module.css'

interface EditMemberModalProps {
  member: Member
  onClose: () => void
  onSave: (id: string, name: string, birthYear: string) => void
  onDelete: (id: string) => void
}

export default function EditMemberModal({ member, onClose, onSave, onDelete }: EditMemberModalProps) {
  const [name, setName] = useState(member.name)
  const [birthYear, setBirthYear] = useState(member.birth_year?.toString() || '')
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    
    setLoading(true)
    await onSave(member.id, name.trim(), birthYear.trim())
    setLoading(false)
  }

  const handleDelete = async () => {
    setLoading(true)
    await onDelete(member.id)
    setLoading(false)
  }

  if (showDeleteConfirm) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <h2 className={styles.title}>Delete Person?</h2>
          <p className={styles.confirmText}>
            Are you sure you want to delete <strong>{member.name}</strong>? This cannot be undone.
          </p>
          
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className={styles.deleteConfirmButton}
            >
              {loading ? 'Deleting...' : 'Yes, Delete'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Edit Family Member</h2>
        
        <form onSubmit={handleSave} className={styles.form}>
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
              onClick={() => setShowDeleteConfirm(true)}
              className={styles.deleteButton}
              disabled={loading}
            >
              Delete
            </button>
            <div className={styles.saveActions}>
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
                className={styles.saveButton}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
