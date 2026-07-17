import { useState } from 'react'
import { CATEGORIES, CATEGORY_COLORS } from '../categories'

// 상단에 카테고리 칩을 가로로 쭉 늘어놓는 대신, "필터" 버튼 하나만 두고
// 누르면 카테고리들이 세로로 펼쳐진다. 각 항목을 눌러 보고 싶은 것만 켜고 끌 수 있다.
function CategoryFilter({ activeCategories, onToggle }) {
  const [open, setOpen] = useState(false)
  const activeCount = CATEGORIES.filter((name) => activeCategories.has(name)).length

  return (
    <div className={`category-filter${open ? ' open' : ''}`}>
      <button
        type="button"
        className="category-filter-toggle"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="category-filter-toggle-icon" aria-hidden="true">☰</span>
        필터
        <span className="category-filter-count">{activeCount}/{CATEGORIES.length}</span>
      </button>

      {open && (
        <div className="category-filter-list" role="group" aria-label="카테고리 필터">
          {CATEGORIES.map((name) => {
            const active = activeCategories.has(name)

            return (
              <button
                key={name}
                type="button"
                className={`category-filter-item${active ? ' active' : ''}`}
                aria-pressed={active}
                onClick={() => onToggle(name)}
              >
                <span
                  className="category-filter-dot"
                  style={{ backgroundColor: CATEGORY_COLORS[name] }}
                  aria-hidden="true"
                />
                <span className="category-filter-item-label">{name}</span>
                <span className="category-filter-check" aria-hidden="true">{active ? '✓' : ''}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CategoryFilter
