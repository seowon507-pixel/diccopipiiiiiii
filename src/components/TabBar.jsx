import { MapIcon, CommunityIcon, ChatIcon, MenuIcon } from '../icons'

const TABS = [
  { key: 'map', label: '지도', Icon: MapIcon },
  { key: 'community', label: '커뮤니티', Icon: CommunityIcon },
  { key: 'chat', label: '채팅', Icon: ChatIcon },
  { key: 'menu', label: '메뉴', Icon: MenuIcon },
]

// 지도/커뮤니티/채팅/메뉴를 오가는 하단 탭바.
function TabBar({ activeTab, onChange }) {
  return (
    <nav className="tab-bar">
      {TABS.map((tab) => {
        const active = activeTab === tab.key
        return (
          <button
            key={tab.key}
            type="button"
            className={`tab-bar-item${active ? ' active' : ''}`}
            onClick={() => onChange(tab.key)}
          >
            <span className="tab-bar-icon">
              <tab.Icon size={24} filled={active} />
            </span>
            <span className="tab-bar-label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default TabBar
