import { useCallback, useEffect, useRef, useState } from 'react'
import { getConnectionId } from '@/lib/connection-context'
import { requireGitOwnerTarget } from '../right-sidebar/worktree-git-owner-target'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { getRuntimeGitHistory } from '@/runtime/runtime-git-status-client'
import type { GitHistoryResult } from '../../../../shared/git-history'

const PAGE_SIZE = 300

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchDraft.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [searchDraft])

  useEffect(() => {
    if (!worktreePath || !ownerTarget) {
      return
    }
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
        limit: PAGE_SIZE,
        ...(search ? { search } : {}),
        ...(refFilter.length > 0 ? { refFilter } : {})
      }
    )
      .then((next) => {
        if (requestSeqRef.current !== seq) {
          return
        }
        setResult(next)
        setStatus('idle')
      })
      .catch((nextError: unknown) => {
        if (requestSeqRef.current !== seq) {
          return
        }
        setStatus('error')
        setError(errorMessage(nextError))
      })
  }, [worktreePath, ownerTarget, worktreeId, search, refFilter, refreshToken])

  const loadMore = useCallback(async () => {
    if (!result?.hasMore || !worktreePath || !ownerTarget) {
      return
    }
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
          limit: PAGE_SIZE,
          skip: result.items.length,
          ...(search ? { search } : {}),
          ...(refFilter.length > 0 ? { refFilter } : {})
        }
      )
      if (requestSeqRef.current !== seq) {
        return
      }
      setResult((previous) =>
        previous ? { ...next, items: [...previous.items, ...next.items] } : next
      )
      setStatus('idle')
    } catch (nextError: unknown) {
      if (requestSeqRef.current !== seq) {
        return
      }
      setStatus('error')
      setError(errorMessage(nextError))
    }
  }, [ownerTarget, refFilter, result, search, worktreeId, worktreePath])

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
