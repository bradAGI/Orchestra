/** Shared input validation for forms across the desktop app. */

/** Validates a task title. Returns an error message or empty string. */
export function validateTaskTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) return 'Title is required'
  if (trimmed.length < 3) return 'Title must be at least 3 characters'
  if (trimmed.length > 500) return 'Title must be under 500 characters'
  return ''
}

/** Validates a task description. Returns an error message or empty string. */
export function validateTaskDescription(description: string): string {
  if (description.length > 10000) return 'Description must be under 10,000 characters'
  return ''
}

/** Validates a URL string. Returns an error message or empty string. */
export function validateUrl(url: string): string {
  if (!url.trim()) return ''
  try {
    new URL(url)
    return ''
  } catch {
    return 'Must be a valid URL (e.g. https://example.com)'
  }
}

/** Validates a backend base URL. Returns an error message or empty string. */
export function validateBaseUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return 'Base URL is required'
  try {
    const parsed = new URL(trimmed)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'URL must use http or https'
    }
    return ''
  } catch {
    return 'Must be a valid URL (e.g. http://127.0.0.1:4010)'
  }
}

/** Validates a project path. Returns an error message or empty string. */
export function validateProjectPath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return 'Path is required'
  if (!trimmed.startsWith('/') && !trimmed.match(/^[A-Za-z]:\\/)) {
    return 'Path must be absolute'
  }
  return ''
}
