import { useState } from 'react'
import ServiceCard from './ServiceCard'
import styles from './ServiceGrid.module.css'

const CARDS = [
  { id: 1, emoji: '🌐', thumbBg: '#FFF8F5', badge: '베스트', avatarBg: '#FFF0E8', avatarColor: '#C04A1A', sellerName: '김민준', title: '반응형 웹사이트 풀스택 개발해 드립니다', rating: 4.9, reviewCount: 124, price: 200000 },
  { id: 2, emoji: '📱', thumbBg: '#EAF3DE', badge: null, avatarBg: '#EAF3DE', avatarColor: '#3B6D11', sellerName: '이소연', title: 'iOS · Android 앱 개발 및 유지보수', rating: 4.8, reviewCount: 87, price: 500000 },
  { id: 3, emoji: '⚡', thumbBg: '#E6F1FB', badge: '인기', avatarBg: '#E6F1FB', avatarColor: '#185FA5', sellerName: '박재현', title: '쇼핑몰 · 커머스 플랫폼 제작 전문', rating: 5.0, reviewCount: 211, price: 350000 },
  { id: 4, emoji: '🤖', thumbBg: '#FAEEDA', badge: null, avatarBg: '#FAEEDA', avatarColor: '#854F0B', sellerName: '최다은', title: 'AI · 챗봇 · 자동화 스크립트 개발', rating: 4.7, reviewCount: 56, price: 150000 },
  { id: 5, emoji: '🛡️', thumbBg: '#FBEAF0', badge: null, avatarBg: '#FBEAF0', avatarColor: '#993556', sellerName: '정우성', title: '서버 보안 점검 · AWS 인프라 구축', rating: 4.9, reviewCount: 43, price: 300000 },
  { id: 6, emoji: '📊', thumbBg: '#E1F5EE', badge: null, avatarBg: '#E1F5EE', avatarColor: '#0F6E56', sellerName: '한지원', title: '데이터 분석 · 시각화 대시보드 제작', rating: 4.8, reviewCount: 72, price: 180000 },
]

const TOTAL_PAGES = 5

export default function ServiceGrid({ category }) {
  const [sort, setSort] = useState('추천순')
  const [page, setPage] = useState(1)

  return (
    <div className={styles.content}>
      <div className={styles.header}>
        <h2>
          {category} <span>{CARDS.length.toLocaleString()}개</span>
        </h2>
        <select
          className={styles.sortSelect}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {['추천순', '인기순', '낮은 가격순', '최신순'].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>

      <div className={styles.grid}>
        {CARDS.map((card) => (
          <ServiceCard key={card.id} card={card} />
        ))}
      </div>

      <div className={styles.pagination}>
        <button className={styles.pageBtn} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
        {Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className={`${styles.pageBtn} ${page === n ? styles.active : ''}`}
            onClick={() => setPage(n)}
          >
            {n}
          </button>
        ))}
        <button className={styles.pageBtn} onClick={() => setPage((p) => Math.min(TOTAL_PAGES, p + 1))}>›</button>
      </div>
    </div>
  )
}
