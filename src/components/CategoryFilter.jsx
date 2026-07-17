import { CATEGORIES, CATEGORY_COLORS } from '../categories'

function CategoryFilter({ activeCategories, onToggle }) {
  return (
    <div className="category-filter">
      {CATEGORIES.map((name) => {
        const active = activeCategories.has(name)

        return (
          <button
            key={name}
            type="button"
            className={`category-filter-chip${active ? ' active' : ''}`}
            style={active ? { backgroundColor: CATEGORY_COLORS[name], borderColor: CATEGORY_COLORS[name] } : undefined}
            aria-pressed={active}
            onClick={() => onToggle(name)}
          >
            {name}
          </button>
        )
      })}
    </div>
  )
}

export default CategoryFilter
