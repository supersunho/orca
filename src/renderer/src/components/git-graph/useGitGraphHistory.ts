import { useCallback, useEffect, useRef, useState } from 'react'
import { getConnectionId } from '@/lib/connection-context'
import { requireGitOwnerTarget } from '../right-sidebar/worktree-git-owner-target'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { getRuntimeGitHistory } from '@/runtime/runtime-git-status-client'
import type { GitHistoryResult } from '../../../../shared/git-history'

const INITIAL_PAGE_SIZE = 300
const LOAD_MORE_PAGE_SIZE = 100
const MAX_LOADED_COMMITS = 5_000

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export function useGitGraphHistory({
  worktreeId,
  worktreePath,
  ownerTarget
}: {
  worktreeId: string
  worktreePath: string | null
  ownerTarget: RuntimeClientTarget | null
}): {
  result: GitHistoryResult | null
  status: 'idle' | 'loading' | 'refreshing' | 'error'
  error: string | null
  searchDraft: string
  setSearchDraft: (value: string) => void
  refFilter: string[]
  setRefFilter: React.Dispatch<React.SetStateAction<string[]>>
  refresh: () => void
  loadMore: () => Promise<void>
} {
  const [result, setResult] = useState<GitHistoryResult | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'refreshing' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [refFilter, setRefFilter] = useState<string[]>([])
  const [refreshToken, setRefreshToken] = useState(0)
  const requestSeqRef = useRef(0)
  const loadMoreAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchDraft.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [searchDraft])

  useEffect(() => {
    loadMoreAbortRef.current?.abort()
    loadMoreAbortRef.current = null
    if (!worktreePath || !ownerTarget) {
      requestSeqRef.current += 1
      return
    }
    const controller = new AbortController()
    const seq = requestSeqRef.current + 1
    requestSeqRef.current = seq
    setStatus('loading')
    setError(null)
    void getRuntimeGitHistory(
      {
        target: requireGitOwnerTarget(ownerTarget),
        worktreeId,
        worktreePath,
        connectionId: getConnectionId(worktreeId) ?? undefined
      },
      {
        allRefs: true,
        limit: INITIAL_PAGE_SIZE,
        ...(search ? { search } : {}),
        ...(refFilter.length > 0 ? { refFilter } : {})
      },
      { signal: controller.signal }
    )
      .then((next) => {
        if (requestSeqRef.current !== seq || controller.signal.aborted) {
          return
        }
        setResult(next)
        setStatus('idle')
      })
      .catch((nextError: unknown) => {
        if (requestSeqRef.current !== seq || controller.signal.aborted || isAbortError(nextError)) {
          return
        }
        setStatus('error')
        setError(errorMessage(nextError))
      })
    return () => {
      controller.abort()
      loadMoreAbortRef.current?.abort()
      loadMoreAbortRef.current = null
    }
  }, [worktreePath, ownerTarget, worktreeId, search, refFilter, refreshToken])

  const loadMore = useCallback(async () => {
    if (status !== 'idle' || !result?.hasMore || !worktreePath || !ownerTarget) {
      return
    }
    const remaining = MAX_LOADED_COMMITS - result.items.length
    if (remaining <= 0) {
      return
    }
    loadMoreAbortRef.current?.abort()
    const controller = new AbortController()
    loadMoreAbortRef.current = controller
    const seq = requestSeqRef.current + 1
    requestSeqRef.current = seq
    setStatus('refreshing')
    setError(null)
    try {
      const next = await getRuntimeGitHistory(
        {
          target: requireGitOwnerTarget(ownerTarget),
          worktreeId,
          worktreePath,
          connectionId: getConnectionId(worktreeId) ?? undefined
        },
        {
          allRefs: true,
          limit: Math.min(LOAD_MORE_PAGE_SIZE, remaining),
          skip: result.items.length,
          ...(search ? { search } : {}),
          ...(refFilter.length > 0 ? { refFilter } : {})
        },
        { signal: controller.signal }
      )
      if (requestSeqRef.current !== seq || controller.signal.aborted) {
        return
      }
      setResult((previous) => {
        if (!previous) {
          return next
        }
        const items = [...previous.items, ...next.items].slice(0, MAX_LOADED_COMMITS)
        return { ...next, items, hasMore: next.hasMore && items.length < MAX_LOADED_COMMITS }
      })
      setStatus('idle')
    } catch (nextError: unknown) {
      if (requestSeqRef.current !== seq || controller.signal.aborted || isAbortError(nextError)) {
        return
      }
      setStatus('error')
      setError(errorMessage(nextError))
    } finally {
      if (loadMoreAbortRef.current === controller) {
        loadMoreAbortRef.current = null
      }
    }
  }, [ownerTarget, refFilter, result, search, status, worktreeId, worktreePath])

  const refresh = useCallback(() => setRefreshToken((token) => token + 1), [])

  return {
    result,
    status,
    error,
    searchDraft,
    setSearchDraft,
    refFilter,
    setRefFilter,
    refresh,
    loadMore
  }
}
