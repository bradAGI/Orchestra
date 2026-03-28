// apps/desktop/src/widgets/agents/CategoryList.tsx
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { AgentConfig } from '@/lib/orchestra-types'
import { CATEGORIES } from './constants'
import type { CategoryId } from './types'

interface CategoryListProps {
  selectedCategory: CategoryId | null
  selectedItem: string | null
  categoryCounts: Record<CategoryId, number>
  itemsForCategory: AgentConfig[]
  onSelectCategory: (id: CategoryId) => void
  onSelectItem: (path: string) => void
  onAddNew: () => void
}

export function CategoryList({
  selectedCategory, selectedItem, categoryCounts, itemsForCategory,
  onSelectCategory, onSelectItem, onAddNew,
}: CategoryListProps) {
  return (
    <div className="flex flex-col h-full border-r border-border/20 bg-card/10 w-[220px] shrink-0">
      <div className="flex-1 overflow-y-auto py-2">
        {CATEGORIES.map(cat => {
          const active = selectedCategory === cat.id
          const count = categoryCounts[cat.id] ?? 0
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
                {cat.pinned && <span className="text-amber-500 text-[10px]">★</span>}
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
                    const itemActive = selectedItem === item.path
                    const label = item.name.split('/').pop() ?? item.name
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => onSelectItem(item.path)}
                        className={`w-full text-left px-3 py-1.5 text-[11px] transition-all truncate ${
                          itemActive
                            ? 'text-primary font-semibold bg-primary/5'
                            : 'text-muted-foreground/50 hover:text-foreground'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="border-t border-border/20 p-2">
        <button
          type="button"
          onClick={onAddNew}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 hover:text-foreground hover:bg-muted/20 transition-all"
        >
          <Plus size={12} /> Add New
        </button>
      </div>
    </div>
  )
}
