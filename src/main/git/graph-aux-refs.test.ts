import { describe, expect, it, vi } from 'vitest'
import type * as RunnerModule from './runner'
import { listGraphAuxRefs } from './graph-aux-refs'
import { gitExecFileAsync } from './runner'

vi.mock('./runner', async (importOriginal) => {
  const actual = await importOriginal<typeof RunnerModule>()
  return { ...actual, gitExecFileAsync: vi.fn() }
})

const git = vi.mocked(gitExecFileAsync)

describe('listGraphAuxRefs', () => {
  it('parses stashes and backup refs', async () => {
    git.mockImplementation(async (args) => {
      if (args[0] === 'stash') {
        return {
          stdout:
            'stash@{0}\0aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\0WIP on main: base\n' +
            'stash@{1}\0bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\0WIP on main: older\n',
          stderr: ''
        }
      }
      if (args[0] === 'for-each-ref') {
        return {
          stdout:
            'refs/orca/backup/1700000000000-main\0' +
            'cccccccccccccccccccccccccccccccccccccccc' +
            '\0' +
            '1700000000\n',
          stderr: ''
        }
      }
      throw new Error(`unexpected git args: ${args.join(' ')}`)
    })

    const refs = await listGraphAuxRefs('/repo')

    expect(refs.stashes).toEqual([
      {
        index: 0,
        oid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        message: 'WIP on main: base'
      },
      {
        index: 1,
        oid: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        message: 'WIP on main: older'
      }
    ])
    expect(refs.backups).toEqual([
      {
        ref: 'refs/orca/backup/1700000000000-main',
        oid: 'cccccccccccccccccccccccccccccccccccccccc',
        createdAt: 1_700_000_000_000
      }
    ])
  })

  it('returns empty lists when git has no stash or backup refs', async () => {
    git.mockResolvedValue({ stdout: '', stderr: '' })

    await expect(listGraphAuxRefs('/repo')).resolves.toEqual({ stashes: [], backups: [] })
  })
})
