const TABS = [
  { key: 'map', label: '지도', icon: '🗺️' },
  { key: 'community', label: '커뮤니티', icon: '📋' },
  { key: 'chat', label: '채팅', icon: '💬' },
  { key: 'menu', label: '메뉴', icon: '☰' },
]

// 지도/커뮤니티/채팅/메뉴를 오가는 하단 탭바.
function TabBar({ activeTab, onChange }) {
  return (
    <nav className="tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`tab-bar-item${activeTab === tab.key ? ' active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          <span className="tab-bar-icon">{tab.icon}</span>
          <span className="tab-bar-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default TabBar
