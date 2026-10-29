import type { Tab } from '../../../../shared/tab-types'

type GitGraphTabCandidate = Pick<Tab, 'id' | 'groupId' | 'contentType'>

export function visibleGitGraphTabIds(
  tabs: readonly GitGraphTabCandidate[],
  groupId: string | null,
  webClient: boolean
): string[] {
  if (webClient) {
    return []
  }
  return tabs
    .filter((tab) => tab.groupId === groupId && tab.contentType === 'git-graph')
    .map((tab) => tab.id)
}
