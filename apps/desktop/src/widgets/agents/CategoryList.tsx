// apps/desktop/src/widgets/agents/CategoryList.tsx
import { Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CategoryDef, CategoryId } from './types'

interface CategoryItem {
  name: string
  path?: string
}

interface CategoryListProps {
  categories: CategoryDef[]
  selectedCategory: CategoryId | null
  selectedItem: string | null
  categoryCounts: Record<string, number>
  itemsForCategory: CategoryItem[]
  onSelectCategory: (id: CategoryId) => void
  onSelectItem: (name: string) => void
  onAddNew?: () => void
}

export function CategoryList({
  categories, selectedCategory, selectedItem, categoryCounts, itemsForCategory,
  onSelectCategory, onSelectItem, onAddNew,
}: CategoryListProps) {
  return (
    <div className="flex flex-col h-full border-r border-border/20 bg-card/10 w-[220px] shrink-0">
      <div className="flex-1 overflow-y-auto py-2">
        {categories.map(cat => {
          const active = selectedCategory === cat.id
          const count = categoryCounts[cat.id] ?? 0
          const IconComponent = typeof cat.icon === 'string' ? null : (cat.icon as LucideIcon)
          return (
            <div key={cat.id}>
              <button
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
              {/* Sub-item list when expanded */}
              {active && itemsForCategory.length > 0 && (
                <div className="ml-5 border-l border-border/20">
                  {itemsForCategory.map(item => {
                    const key = item.path ?? item.name
                    const itemActive = selectedItem === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onSelectItem(key)}
                        className={`w-full text-left px-3 py-1.5 text-[11px] transition-all truncate ${
                          itemActive
                            ? 'text-primary font-semibold bg-primary/5'
                            : 'text-muted-foreground/50 hover:text-foreground'
                        }`}
                      >
                        {item.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {onAddNew && (
        <div className="border-t border-border/20 p-2">
          <button
            type="button"
            onClick={onAddNew}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 hover:text-foreground hover:bg-muted/20 transition-all"
          >
            <Plus size={12} /> Add New
          </button>
        </div>
      )}
    </div>
  )
}
