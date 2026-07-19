import AppIcon from './AppIcon.jsx'
import { THEME_NAVIGATION } from '../uiThemes'

const TABS = [
  { key: 'map', label: '지도', icon: 'map' },
  { key: 'community', label: '커뮤니티', icon: 'community' },
  { key: 'chat', label: '채팅', icon: 'chat' },
  { key: 'menu', label: '메뉴', icon: 'menu' },
]

// 지도/커뮤니티/채팅/메뉴를 오가는 하단 탭바.
function TabBar({ activeTab, onChange, uiTheme }) {
  const tabs = THEME_NAVIGATION[uiTheme] ?? TABS

  return (
    <nav className="tab-bar" aria-label="주요 메뉴">
      {tabs.map((tab, index) => (
        <button
          key={tab.key}
          type="button"
          className={`tab-bar-item${activeTab === tab.key ? ' active' : ''}`}
          data-tab-key={tab.key}
          aria-current={activeTab === tab.key ? 'page' : undefined}
          aria-label={`${tab.label} 탭`}
          onClick={() => onChange(tab.key)}
        >
          <span className="tab-bar-index" aria-hidden="true">0{index + 1}</span>
          <span className="tab-bar-icon"><AppIcon name={tab.icon} size={22} /></span>
          <span className="tab-bar-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default TabBar
