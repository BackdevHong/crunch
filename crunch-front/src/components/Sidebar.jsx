import { useState } from 'react'
import styles from './Sidebar.module.css'

const categories = [
  { icon: '💻', label: '개발 · IT', count: '8,204', bg: '#FFF0E8' },
  { icon: '🎨', label: '디자인', count: '6,812', bg: '#EAF3DE' },
  { icon: '📱', label: '마케팅', count: '3,401', bg: '#E6F1FB' },
  { icon: '✍️', label: '글쓰기 · 번역', count: '2,970', bg: '#FAEEDA' },
  { icon: '🎬', label: '영상 · 사진', count: '2,115', bg: '#FBEAF0' },
  { icon: '🎵', label: '음악 · 오디오', count: '987', bg: '#E1F5EE' },
]

const budgetOptions = ['전체', '10만원 이하', '10 ~ 50만원', '50 ~ 100만원', '100만원 이상']
const deliveryOptions = ['3일 이내', '1주일 이내', '2주일 이내']

export default function Sidebar({ activeCategory, onCategoryChange }) {
  const [budget, setBudget] = useState('전체')
  const [delivery, setDelivery] = useState([])

  const toggleDelivery = (option) => {
    setDelivery((prev) =>
      prev.includes(option) ? prev.filter((d) => d !== option) : [...prev, option]
    )
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>카테고리</div>
        {categories.map((cat) => (
          <div
            key={cat.label}
            className={`${styles.catItem} ${activeCategory === cat.label ? styles.active : ''}`}
            onClick={() => onCategoryChange(cat.label)}
          >
            <div className={styles.catIcon} style={{ background: cat.bg }}>
              {cat.icon}
            </div>
            {cat.label}
            <span className={styles.catCount}>{cat.count}</span>
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>예산</div>
        {budgetOptions.map((opt) => (
          <label key={opt} className={styles.filterLabel}>
            <input
              type="radio"
              name="budget"
              checked={budget === opt}
              onChange={() => setBudget(opt)}
            />
            {opt}
          </label>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>납기일</div>
        {deliveryOptions.map((opt) => (
          <label key={opt} className={styles.filterLabel}>
            <input
              type="checkbox"
              checked={delivery.includes(opt)}
              onChange={() => toggleDelivery(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    </aside>
  )
}
