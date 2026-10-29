import { describe, expect, it } from 'vitest'
import { formatGitGraphDate } from './git-graph-date'

const NOW = Date.UTC(2026, 9, 29, 12, 0, 0)

describe('formatGitGraphDate', () => {
  it('returns an empty label without a timestamp', () => {
    expect(formatGitGraphDate(null, true, NOW)).toBe('')
  })

  it('uses relative units when enabled', () => {
    expect(formatGitGraphDate(NOW - 3 * 86_400_000, true, NOW)).toBe('3 days ago')
    expect(formatGitGraphDate(NOW - 2 * 3_600_000, true, NOW)).toBe('2 hours ago')
  })

  it('uses the locale date when disabled', () => {
    const timestamp = NOW - 3 * 86_400_000
    expect(formatGitGraphDate(timestamp, false, NOW)).toBe(new Date(timestamp).toLocaleDateString())
  })
})
