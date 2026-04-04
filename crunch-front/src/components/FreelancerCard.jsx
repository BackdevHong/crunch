import styles from './FreelancerCard.module.css'

const BADGE_STYLE = { Top: styles.badgeTop, Pro: styles.badgePro, New: styles.badgeNew }

export default function FreelancerCard({ freelancer, onClick }) {
  const { name, role, avatarBg, avatarColor, badge, rating, completedJobs, skills, hourlyRate, online } = freelancer
  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.top}>
        <div className={styles.avatarWrap}>
          <div className={styles.avatar} style={{ background: avatarBg, color: avatarColor }}>{name[0]}</div>
          {online && <span className={styles.onlineDot} />}
        </div>
        <div className={styles.info}>
          <div className={styles.name}>{name}</div>
          <div className={styles.role}>{role}</div>
          <div className={styles.rating}><span className={styles.star}>★</span>{rating} · 완료 {completedJobs}건</div>
        </div>
        <span className={`${styles.badge} ${BADGE_STYLE[badge]}`}>{badge}</span>
      </div>
      <div className={styles.tags}>{skills.map(s => <span key={s} className={styles.tag}>{s}</span>)}</div>
      <div className={styles.footer}>
        <div><div className={styles.rateLabel}>시간당</div><div className={styles.rate}>{hourlyRate.toLocaleString()}원</div></div>
        <button className={styles.btn} onClick={e => { e.stopPropagation(); onClick && onClick() }}>프로필 보기</button>
      </div>
    </div>
  )
}
