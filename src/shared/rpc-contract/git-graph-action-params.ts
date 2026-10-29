/* eslint-disable no-control-regex -- Why: graph action inputs must reject control characters before they reach a git argv. */
import { z } from 'zod'
import type { GitGraphAction } from '../git-graph-actions'

const GitGraphRefInput = z
  .string()
  .min(1, 'Missing git ref')
  .max(255)
  // Why: reject flag-like, control, range, and reflog syntax before it reaches a git argv.
  .refine(
    (value) =>
      !value.startsWith('-') &&
      !/[\s\x00-\x1f\x7f]/.test(value) &&
      !value.includes('..') &&
      !value.includes('@{'),
    'Invalid git ref'
  )

const GitGraphRevisionInput = z
  .string()
  .min(1, 'Missing git revision')
  .max(1024)
  .refine(
    (value) =>
      !value.startsWith('-') &&
      !/[\s\x00-\x1f\x7f]/.test(value) &&
      !value.includes('..') &&
      !value.includes('@{') &&
      !/[?:*[\\]/.test(value),
    'Invalid git revision'
  )

const GitGraphStashIndex = z.number().int().min(0).max(10_000)
const GitGraphMessage = z.string().max(20_000)
const GitGraphRemoteUrl = z
  .string()
  .min(1, 'Missing remote URL')
  .max(2048)
  .refine(
    (value) => !value.startsWith('-') && !/[\s\x00-\x1f\x7f]/.test(value),
    'Invalid remote URL'
  )

export const GitGraphActionSchema: z.ZodType<GitGraphAction> = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('checkout'), branch: GitGraphRefInput }),
  z.strictObject({
    kind: z.literal('createBranch'),
    name: GitGraphRefInput,
    startPoint: GitGraphRevisionInput,
    checkout: z.boolean()
  }),
  z.strictObject({
    kind: z.literal('renameBranch'),
    oldName: GitGraphRefInput,
    newName: GitGraphRefInput
  }),
  z.strictObject({
    kind: z.literal('deleteBranch'),
    name: GitGraphRefInput,
    force: z.boolean()
  }),
  z.strictObject({
    kind: z.literal('createTag'),
    name: GitGraphRefInput,
    target: GitGraphRevisionInput,
    message: GitGraphMessage.optional(),
    push: z.boolean(),
    remote: GitGraphRefInput.optional()
  }),
  z.strictObject({ kind: z.literal('deleteTag'), name: GitGraphRefInput }),
  z.strictObject({
    kind: z.literal('pushTag'),
    name: GitGraphRefInput,
    remote: GitGraphRefInput.optional()
  }),
  z.strictObject({
    kind: z.literal('stashCreate'),
    includeUntracked: z.boolean(),
    message: GitGraphMessage.optional()
  }),
  z.strictObject({
    kind: z.literal('stashApply'),
    index: GitGraphStashIndex,
    reinstateIndex: z.boolean()
  }),
  z.strictObject({
    kind: z.literal('stashPop'),
    index: GitGraphStashIndex,
    reinstateIndex: z.boolean()
  }),
  z.strictObject({ kind: z.literal('stashDrop'), index: GitGraphStashIndex }),
  z.strictObject({
    kind: z.literal('merge'),
    target: GitGraphRevisionInput,
    noFastForward: z.boolean(),
    squash: z.boolean(),
    noCommit: z.boolean()
  }),
  z.strictObject({
    kind: z.literal('rebase'),
    onto: GitGraphRevisionInput,
    ignoreDate: z.boolean()
  }),
  z.strictObject({
    kind: z.literal('cherryPick'),
    commit: GitGraphRevisionInput,
    noCommit: z.boolean(),
    recordOrigin: z.boolean()
  }),
  z.strictObject({ kind: z.literal('revert'), commit: GitGraphRevisionInput }),
  z.strictObject({
    kind: z.literal('reset'),
    target: GitGraphRevisionInput,
    mode: z.enum(['soft', 'mixed', 'hard'])
  }),
  z.strictObject({ kind: z.literal('restoreBackup'), ref: GitGraphRefInput }),
  z.strictObject({ kind: z.literal('dropCommit'), commit: GitGraphRevisionInput }),
  z.strictObject({
    kind: z.literal('remoteAdd'),
    name: GitGraphRefInput,
    url: GitGraphRemoteUrl
  }),
  z.strictObject({ kind: z.literal('remoteRemove'), name: GitGraphRefInput }),
  z.strictObject({
    kind: z.literal('remoteSetUrl'),
    name: GitGraphRefInput,
    url: GitGraphRemoteUrl
  }),
  z.strictObject({ kind: z.literal('continueOperation') }),
  z.strictObject({ kind: z.literal('skipOperation') }),
  z.strictObject({ kind: z.literal('abortOperation') })
])
