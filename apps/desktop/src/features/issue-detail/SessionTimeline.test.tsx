import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { SessionTimeline } from './SessionTimeline'

describe('SessionTimeline', () => {
  it('renders empty state when no logs', () => {
    render(<SessionTimeline logs="" loading={false} />)
    expect(screen.getByText('No session activity')).toBeTruthy()
  })

  it('renders loading spinner when loading', () => {
    render(<SessionTimeline logs="" loading={true} />)
    expect(screen.getByTestId('timeline-loading')).toBeTruthy()
  })

  it('renders agent message from JSONL', () => {
    const logs = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Hello from the agent' }] },
      timestamp: '2026-03-20T10:00:00Z',
    })
    render(<SessionTimeline logs={logs} loading={false} />)
    expect(screen.getByText('Hello from the agent')).toBeTruthy()
  })

  it('renders tool call from JSONL', () => {
    const logs = JSON.stringify({
      type: 'tool_use',
      tool_name: 'Bash',
      parameters: { command: 'ls -la' },
      timestamp: '2026-03-20T10:00:01Z',
    })
    render(<SessionTimeline logs={logs} loading={false} />)
    expect(screen.getByTestId('tool-call')).toBeTruthy()
    expect(screen.getByText('[Bash]')).toBeTruthy()
    expect(screen.getByText('ls -la')).toBeTruthy()
  })

  it('expands tool result on click', async () => {
    const user = userEvent.setup()
    const content = 'Result output from the tool execution'
    const logs = JSON.stringify({
      type: 'tool_result',
      output: content,
      status: 'success',
      timestamp: '2026-03-20T10:00:02Z',
    })
    render(<SessionTimeline logs={logs} loading={false} />)
    const toggle = screen.getByTestId('result-toggle')
    expect(toggle).toBeTruthy()
    // Should not show expanded content initially
    expect(screen.queryByTestId('result-expanded')).toBeNull()
    await user.click(toggle)
    expect(screen.getByTestId('result-expanded')).toBeTruthy()
    expect(screen.getByTestId('result-expanded').textContent).toBe(content)
  })
})
