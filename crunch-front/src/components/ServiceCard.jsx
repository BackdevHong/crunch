import styles from './ServiceCard.module.css'

export default function ServiceCard({ card, onClick }) {
  const { emoji, thumbBg, badge, avatarBg, avatarColor, sellerName, title, rating, reviewCount, price } = card
  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.thumb} style={{ background: thumbBg }}>
        {badge && <span className={styles.badge}>{badge}</span>}
        <span className={styles.emoji}>{emoji}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.seller}>
          <div className={styles.avatar} style={{ background: avatarBg, color: avatarColor }}>{sellerName[0]}</div>
          <span className={styles.sellerName}>{sellerName}</span>
        </div>
        <div className={styles.title}>{title}</div>
        <div className={styles.footer}>
          <div className={styles.rating}><span className={styles.star}>★</span>{rating} ({reviewCount})</div>
          <div className={styles.price}><span className={styles.priceLabel}>부터 </span>{price.toLocaleString()}원</div>
        </div>
      </div>
    </div>
  )
}
