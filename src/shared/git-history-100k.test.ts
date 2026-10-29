import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { performance } from 'node:perf_hooks'
import { afterAll, describe, expect, it } from 'vitest'
import {
  loadGitHistoryFromExecutor,
  type GitHistoryExecutor,
  type GitHistoryResult
} from './git-history'

const ENABLED = process.env.ORCA_GIT_GRAPH_BENCH === '1'
const COMMITS = 100_000
const REFS = 1_000

const executor: GitHistoryExecutor = async (args, cwd) => ({
  stdout: execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  })
})

let repo = ''

function fastImportStream(): string {
  let stream = 'blob\nmark :1\ndata 2\nx\n\n'
  for (let index = 1; index <= COMMITS; index += 1) {
    const mark = index + 1
    const message = `bench commit ${index}`
    stream += `commit refs/heads/main\nmark :${mark}\n`
    stream += `author Bench <bench@example.test> ${index} +0000\n`
    stream += `committer Bench <bench@example.test> ${index} +0000\n`
    stream += `data ${Buffer.byteLength(message)}\n${message}\n`
    if (mark > 2) {
      stream += `from :${mark - 1}\n`
    }
    stream += 'M 100644 :1 tracked.txt\n\n'
  }
  const tipMark = COMMITS + 1
  for (let index = 0; index < REFS; index += 1) {
    stream += `reset refs/heads/bench-${index}\nfrom :${tipMark}\n\n`
  }
  return stream
}

async function measure(
  label: string,
  run: () => Promise<GitHistoryResult>
): Promise<{ label: string; ms: number; result: GitHistoryResult }> {
  const startedAt = performance.now()
  const result = await run()
  return { label, ms: Math.round(performance.now() - startedAt), result }
}

describe.skipIf(!ENABLED)('git graph history 100k commits / 1k refs', () => {
  afterAll(async () => {
    if (repo) {
      await rm(path.dirname(repo), { recursive: true, force: true })
    }
  })

  it('records initial, load-more, and search latency', async () => {
    repo = path.join(await mkdtemp(path.join(tmpdir(), 'orca-git-graph-bench-')), 'repo')
    execFileSync('git', ['init', '--quiet', repo])
    execFileSync('git', ['fast-import', '--quiet'], {
      cwd: repo,
      input: fastImportStream(),
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['pipe', 'ignore', 'pipe']
    })
    const refCount = Number(
      execFileSync('git', ['for-each-ref', '--format=%(refname)'], {
        cwd: repo,
        encoding: 'utf8'
      })
        .trim()
        .split('\n').length
    )

    const initial = await measure('initial-300', () =>
      loadGitHistoryFromExecutor(executor, repo, { allRefs: true, limit: 300 })
    )
    const loadMore = await measure('load-more-100', () =>
      loadGitHistoryFromExecutor(executor, repo, { allRefs: true, limit: 100, skip: 300 })
    )
    const search = await measure('search', () =>
      loadGitHistoryFromExecutor(executor, repo, {
        allRefs: true,
        limit: 300,
        search: 'bench commit 99999'
      })
    )

    expect(initial.result.items).toHaveLength(300)
    expect(initial.result.scope).toBe('all-refs')
    expect(initial.result.hasMore).toBe(true)
    expect(loadMore.result.items).toHaveLength(100)
    expect(search.result.items[0]?.subject).toContain('bench commit 99999')
    expect(refCount).toBeGreaterThanOrEqual(REFS)

    console.log(
      JSON.stringify({
        commits: COMMITS,
        refs: refCount,
        metrics: [initial, loadMore, search].map(({ label, ms }) => ({ label, ms }))
      })
    )
  }, 120_000)
})
