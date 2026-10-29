import type { GitHistoryOptions, GitHistoryScope } from './git-history-types'

/** Full refs only: short names and revision ranges would widen the query beyond the UI selection. */
// eslint-disable-next-line no-control-regex -- Reject control characters before they reach git.
export const GIT_HISTORY_REF_FILTER_PATTERN = /^refs\/(?:heads|remotes|tags)\/[^\s\x00-\x1f]+$/

const HISTORY_SEARCH_MAX_LENGTH = 500
const HISTORY_REF_FILTER_MAX_LENGTH = 200
const HISTORY_SKIP_MAX = 10_000_000

type GitHistoryOptionSource = {
  limit?: unknown
  skip?: unknown
  baseRef?: unknown
  allRefs?: unknown
  search?: unknown
  refFilter?: unknown
}

export function pickGitHistoryOptions(source: GitHistoryOptionSource): GitHistoryOptions {
  const options: GitHistoryOptions = {}
  if (typeof source.limit === 'number' && Number.isFinite(source.limit)) {
    options.limit = source.limit
  }
  if (typeof source.skip === 'number' && Number.isFinite(source.skip)) {
    options.skip = source.skip
  }
  if (typeof source.baseRef === 'string' || source.baseRef === null) {
    options.baseRef = source.baseRef
  }
  if (typeof source.allRefs === 'boolean') {
    options.allRefs = source.allRefs
  }
  if (typeof source.search === 'string') {
    const search = normalizeGitHistorySearch(source.search)
    if (search) {
      options.search = search
    }
  }
  if (Array.isArray(source.refFilter)) {
    const refFilter = normalizeGitHistoryRefFilter(
      source.refFilter.filter((value): value is string => typeof value === 'string')
    )
    if (refFilter) {
      options.refFilter = refFilter
    }
  }
  return options
}

export function clampGitHistorySkip(skip: number | undefined): number {
  if (!Number.isFinite(skip)) {
    return 0
  }
  return Math.min(HISTORY_SKIP_MAX, Math.max(0, Math.trunc(skip ?? 0)))
}

export function normalizeGitHistorySearch(search: string | null | undefined): string | undefined {
  const normalized = search?.trim()
  if (!normalized) {
    return undefined
  }
  return normalized.slice(0, HISTORY_SEARCH_MAX_LENGTH)
}

export function normalizeGitHistoryRefFilter(
  refFilter: readonly string[] | null | undefined
): string[] | undefined {
  if (!refFilter?.length) {
    return undefined
  }
  const unique: string[] = []
  for (const ref of refFilter) {
    if (unique.length >= HISTORY_REF_FILTER_MAX_LENGTH) {
      break
    }
    if (GIT_HISTORY_REF_FILTER_PATTERN.test(ref) && !unique.includes(ref)) {
      unique.push(ref)
    }
  }
  return unique.length > 0 ? unique : undefined
}

export function gitHistoryScopeForOptions(options: GitHistoryOptions): GitHistoryScope {
  return options.allRefs ? 'all-refs' : 'head'
}
