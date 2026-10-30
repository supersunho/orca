// Git Graph specs rewrite history and remotes, so they cannot share the worker repo.
import { test as base, expect } from './orca-app'
import { createSeededTestRepo } from './seeded-test-repo'
import { cleanupTestRepository } from '../global-teardown'

export { expect }

export const test = base.extend({
  seededRepoPath: async ({ registerPostElectronShutdownCleanup }, provideFixture) => {
    const repoPath = createSeededTestRepo({ publishPath: false })
    registerPostElectronShutdownCleanup(async () => cleanupTestRepository(repoPath))
    await provideFixture(repoPath)
  }
})
