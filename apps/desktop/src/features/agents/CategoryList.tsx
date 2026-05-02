// apps/desktop/src/widgets/agents/CategoryList.tsx
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@ui/badge'
import type { CategoryDef, CategoryId } from './types'

interface CategoryListProps {
  categories: CategoryDef[]
  selectedCategory: CategoryId | null
  categoryCounts: Record<string, number>
  onSelectCategory: (id: CategoryId) => void
}

export function CategoryList({
  categories, selectedCategory, categoryCounts, onSelectCategory,
}: CategoryListProps) {
  return (
    <div className="flex flex-col h-full border-r border-border/20 bg-card/10 w-[200px] shrink-0">
      <div className="flex-1 overflow-y-auto py-2">
        {categories.map(cat => {
          const active = selectedCategory === cat.id
          const count = categoryCounts[cat.id] ?? 0
          const IconComponent = typeof cat.icon === 'string' ? null : (cat.icon as LucideIcon)
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all ${
                active
                  ? 'bg-primary/8 text-foreground'
                  : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/20'
              }`}
            >
              {IconComponent ? (
                <IconComponent size={14} className={active ? 'text-primary' : 'text-muted-foreground/40'} />
              ) : (
                <span className="text-sm">{cat.icon as string}</span>
              )}
              <span className="text-xs font-semibold flex-1">{cat.label}</span>
              {count > 0 && (
                <Badge variant="outline" className="text-[9px] font-bold h-4 px-1.5 rounded-full">
                  {count}
                </Badge>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
