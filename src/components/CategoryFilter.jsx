import { useState } from 'react'
import { REALTIME_CATEGORIES, FREE_CATEGORIES, CATEGORY_COLORS } from '../categories'

// 지도 상단 카테고리 필터 — 예전엔 칩이 가로로 나열돼 있었지만, 이제 메뉴 버튼 하나를 눌러야
// 세로 목록(실시간 알림/커뮤니티 구분)이 펼쳐지고, 각 카테고리를 개별적으로 켜고 끌 수 있다.
function CategoryFilter({ activeCategories, onToggle }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="category-filter">
      <button
        type="button"
        className={`category-filter-toggle${open ? ' active' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        ☰ 카테고리
      </button>

      {open && (
        <div className="category-filter-menu">
          <CategoryGroup
            label="실시간 알림"
            names={REALTIME_CATEGORIES}
            activeCategories={activeCategories}
            onToggle={onToggle}
          />
          <CategoryGroup
            label="커뮤니티"
            names={FREE_CATEGORIES}
            activeCategories={activeCategories}
            onToggle={onToggle}
          />
        </div>
      )}
    </div>
  )
}

function CategoryGroup({ label, names, activeCategories, onToggle }) {
  return (
    <div className="category-filter-group">
      <span className="category-filter-group-label">{label}</span>
      {names.map((name) => {
        const active = activeCategories.has(name)

        return (
          <button
            key={name}
            type="button"
            className={`category-filter-row${active ? ' active' : ''}`}
            aria-pressed={active}
            onClick={() => onToggle(name)}
          >
            <span className="category-filter-row-dot" style={{ backgroundColor: CATEGORY_COLORS[name] }} />
            <span className="category-filter-row-label">{name}</span>
            <span className="category-filter-switch" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

export default CategoryFilter
