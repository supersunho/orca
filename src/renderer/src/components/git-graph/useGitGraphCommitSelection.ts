import { useEffect, useState } from 'react'
import { getRuntimeGitCommitRangeCompare } from '@/runtime/runtime-git-diff-client'
import { getConnectionId } from '@/lib/connection-context'
import { requireGitOwnerTarget } from '../right-sidebar/worktree-git-owner-target'
import type { GitHistoryItem, GitHistoryResult } from '../../../../shared/git-history'
import type { GitBranchChangeEntry } from '../../../../shared/git-diff-compare-types'
import type { GitGraphRangeCompareState } from './GitGraphDetailsPanel'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function useGitGraphCommitSelection({
  selectedIds,
  result,
  loadCommitFiles,
  worktreeId,
  worktreePath,
  ownerTarget
}: {
  selectedIds: string[]
  result: GitHistoryResult | null
  loadCommitFiles: (item: GitHistoryItem) => Promise<GitBranchChangeEntry[]>
  worktreeId: string
  worktreePath: string | null
  ownerTarget: RuntimeClientTarget | null
}): {
  singleSelected: GitHistoryItem | null
  files: GitBranchChangeEntry[]
  filesStatus: 'idle' | 'loading' | 'ready' | 'error'
  filesError: string | null
  rangeCompare: GitGraphRangeCompareState | null
} {
  const [files, setFiles] = useState<GitBranchChangeEntry[]>([])
  const [filesStatus, setFilesStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [filesError, setFilesError] = useState<string | null>(null)
  const [rangeCompare, setRangeCompare] = useState<GitGraphRangeCompareState | null>(null)

  const singleSelected =
    selectedIds.length === 1
      ? (result?.items.find((item) => item.id === selectedIds[0]) ?? null)
      : null

  useEffect(() => {
    if (!singleSelected) {
      setFiles([])
      setFilesStatus('idle')
      setFilesError(null)
      return
    }
    let cancelled = false
    setFilesStatus('loading')
    setFilesError(null)
    void loadCommitFiles(singleSelected)
      .then((entries) => {
        if (!cancelled) {
          setFiles(entries)
          setFilesStatus('ready')
        }
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setFilesStatus('error')
          setFilesError(errorMessage(nextError))
        }
      })
    return () => {
      cancelled = true
    }
  }, [loadCommitFiles, singleSelected])

  useEffect(() => {
    if (selectedIds.length !== 2 || !worktreePath || !ownerTarget) {
      setRangeCompare(null)
      return
    }
    const base = result?.items.find((item) => item.id === selectedIds[0])
    const head = result?.items.find((item) => item.id === selectedIds[1])
    if (!base || !head) {
      setRangeCompare(null)
      return
    }
    let cancelled = false
    setRangeCompare({
      base,
      head,
      result: {
        summary: { baseOid: base.id, headOid: head.id, changedFiles: 0, status: 'ready' },
        entries: []
      },
      status: 'loading'
    })
    void getRuntimeGitCommitRangeCompare(
      {
        target: requireGitOwnerTarget(ownerTarget),
        worktreeId,
        worktreePath,
        connectionId: getConnectionId(worktreeId) ?? undefined
      },
      base.id,
      head.id
    )
      .then((next) => {
        if (!cancelled) {
          setRangeCompare({
            base,
            head,
            result: next,
            status: next.summary.status === 'ready' ? 'ready' : 'error'
          })
        }
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setRangeCompare({
            base,
            head,
            result: {
              summary: {
                baseOid: base.id,
                headOid: head.id,
                changedFiles: 0,
                status: 'error',
                errorMessage: errorMessage(nextError)
              },
              entries: []
            },
            status: 'error'
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [selectedIds, result, worktreePath, ownerTarget, worktreeId])

  return { singleSelected, files, filesStatus, filesError, rangeCompare }
}
