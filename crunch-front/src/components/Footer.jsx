import styles from './Footer.module.css'

const footerLinks = [
  {
    title: '서비스',
    links: ['서비스 찾기', '프리랜서 찾기', '프로젝트 올리기', '기업 솔루션'],
  },
  {
    title: '회사',
    links: ['소개', '블로그', '채용', '언론 보도'],
  },
  {
    title: '고객지원',
    links: ['고객센터', '이용약관', '개인정보처리방침', '분쟁해결'],
  },
]

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <div className={styles.logoMark}>
              <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            크런치
          </div>
          <p>국내 최고의 프리랜서 플랫폼으로<br />당신의 비즈니스를 성장시키세요.</p>
        </div>

        {footerLinks.map((col) => (
          <div key={col.title} className={styles.col}>
            <h4>{col.title}</h4>
            {col.links.map((link) => (
              <a key={link} href="#" className={styles.link}>{link}</a>
            ))}
          </div>
        ))}
      </div>

      <div className={styles.bottom}>
        <span>© 2026 크런치. All rights reserved.</span>
        <span>사업자등록번호: 123-45-67890 | 통신판매업신고: 2026-서울강남-0001</span>
      </div>
    </footer>
  )
}
