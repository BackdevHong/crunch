import { useState } from 'react'
import styles from './Hero.module.css'

const popularTags = ['웹 개발', '앱 디자인', '로고 제작', '영상 편집', '콘텐츠 기획', '번역']

export default function Hero() {
  const [query, setQuery] = useState('')

  return (
    <div className={styles.hero}>
      <div className={styles.badge}>
        <span className={styles.badgeDot} />
        실시간 프리랜서 매칭
      </div>

      <h1>
        당신의 프로젝트에<br />
        <span>딱 맞는 전문가</span>를 만나세요
      </h1>

      <p>디자인, 개발, 마케팅, 번역까지 — 모든 분야의 프리랜서가 기다립니다</p>

      <div className={styles.searchBox}>
        <input
          type="text"
          placeholder="어떤 서비스가 필요하신가요?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button>검색</button>
      </div>

      <div className={styles.tags}>
        {popularTags.map((tag) => (
          <span
            key={tag}
            className={styles.tag}
            onClick={() => setQuery(tag)}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
