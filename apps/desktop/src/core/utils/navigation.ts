/**
 * Computes the next focused sidebar item index based on a keyboard event key.
 * Supports Home, End, ArrowDown, and ArrowUp for circular navigation.
 * @param key - The keyboard event key string.
 * @param currentIndex - The currently focused item index.
 * @param total - Total number of sidebar items.
 * @returns The new index to focus, or null if the key is not a navigation key.
 */
export function getNextSidebarIndex(key: string, currentIndex: number, total: number): number | null {
  if (total <= 0) {
    return null
  }

  if (key === 'Home') {
    return 0
  }

  if (key === 'End') {
    return total - 1
  }

  if (key === 'ArrowDown') {
    return (currentIndex + 1) % total
  }

  if (key === 'ArrowUp') {
    return (currentIndex - 1 + total) % total
  }

  return null
}
