import type { GrabPayload } from './use-grab-mode'

export function formatGrabPayload(payload: GrabPayload): string {
  const lines: string[] = []
  lines.push(`## Captured Element`)
  lines.push(``)
  lines.push(`**Page:** ${payload.page.title}`)
  lines.push(`**URL:** ${payload.page.url}`)
  lines.push(`**Viewport:** ${payload.page.viewport.width}×${payload.page.viewport.height}`)
  lines.push(``)
  lines.push(`### Element`)
  lines.push(`- **Tag:** \`<${payload.target.tag}>\``)
  lines.push(`- **Selector:** \`${payload.target.selector}\``)
  lines.push(`- **Size:** ${Math.round(payload.target.rect.width)}×${Math.round(payload.target.rect.height)}`)
  if (payload.target.text) {
    lines.push(`- **Text:** "${payload.target.text}"`)
  }
  lines.push(``)
  lines.push(`### Accessibility`)
  lines.push(`- **Role:** ${payload.accessibility.role}`)
  if (payload.accessibility.ariaLabel) {
    lines.push(`- **ARIA Label:** ${payload.accessibility.ariaLabel}`)
  }
  lines.push(``)
  lines.push(`### Key Styles`)
  const important = ['display', 'position', 'width', 'height', 'color', 'backgroundColor', 'fontSize']
  for (const prop of important) {
    if (payload.styles[prop]) {
      lines.push(`- **${prop}:** ${payload.styles[prop]}`)
    }
  }
  lines.push(``)
  lines.push(`### HTML`)
  lines.push('```html')
  lines.push(payload.target.html.slice(0, 2000))
  lines.push('```')
  return lines.join('\n')
}
