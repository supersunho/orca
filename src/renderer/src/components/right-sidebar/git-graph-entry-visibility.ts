import { parseWorkspaceKey } from '../../../../shared/workspace-scope'

/**
 * Git Graph is a Git-only surface: folder workspaces have no graph to draw.
 * Git worktree ids are bare `${repoId}::${path}` with no scope prefix, so only
 * the explicit folder scope excludes them; empty or malformed ids fail closed
 * because a worktree must be mounted for the graph to open.
 */
export function showsGitGraphEntry(worktreeId: string): boolean {
  if (worktreeId.length === 0) {
    return false
  }
  return parseWorkspaceKey(worktreeId)?.type !== 'folder'
}
