import styles from './StatsBar.module.css'

const stats = [
  { num: '28,400+', label: '등록된 전문가' },
  { num: '142,000+', label: '완료된 프로젝트' },
  { num: '4.9 / 5', label: '평균 만족도' },
  { num: '97%', label: '기한 내 완료율' },
]

export default function StatsBar() {
  return (
    <div className={styles.statsRow}>
      {stats.map((s) => (
        <div key={s.label} className={styles.stat}>
          <div className={styles.statNum}>{s.num}</div>
          <div className={styles.statLabel}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}
