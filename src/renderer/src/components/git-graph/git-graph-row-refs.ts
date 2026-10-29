import { dedupeRemoteTrackingRefs } from '../../../../shared/git-history-ref-display'
import type { GitHistoryItemRef } from '../../../../shared/git-history'

export const GIT_GRAPH_VISIBLE_REF_LIMIT = 2

export function shortRefName(ref: string): string {
  return ref.replace(/^refs\/(?:heads|remotes|tags)\//, '')
}

export function selectVisibleGraphRefs(
  refs: readonly GitHistoryItemRef[],
  activeRefFilter: readonly string[]
): { visible: GitHistoryItemRef[]; hidden: GitHistoryItemRef[] } {
  const deduped = dedupeRemoteTrackingRefs(refs, { preserveRefIds: activeRefFilter })
  return {
    visible: deduped.slice(0, GIT_GRAPH_VISIBLE_REF_LIMIT),
    hidden: deduped.slice(GIT_GRAPH_VISIBLE_REF_LIMIT)
  }
}
