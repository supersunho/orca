import { parseWorkspaceKey } from '../../../../shared/workspace-scope'

/**
 * Git Graph is a Git-only surface: folder workspaces have no graph to draw.
 * Git worktree ids are bare `${repoId}::${path}` with no scope prefix, so only
 * the explicit folder scope excludes the entry.
 */
export function showsGitGraphEntry(worktreeId: string): boolean {
  return parseWorkspaceKey(worktreeId)?.type !== 'folder'
}
