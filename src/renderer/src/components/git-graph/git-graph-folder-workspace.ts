import { projectGroupIdFromRepoId } from '../../../../shared/folder-workspace-worktree'
import { parseWorkspaceKey } from '../../../../shared/workspace-scope'
import type { Worktree } from '../../../../shared/worktree/types'

export function isFolderGitGraphWorkspace(
  worktree: Worktree | null | undefined,
  worktreeId: string
): boolean {
  return (
    (worktree != null && projectGroupIdFromRepoId(worktree.repoId) !== null) ||
    parseWorkspaceKey(worktree?.id ?? worktreeId)?.type === 'folder'
  )
}
