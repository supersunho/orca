import type {
  GitGraphActionFailureCode,
  GitGraphActionResult,
  GitGraphConflictOperation
} from '../../shared/git-graph-actions'

export type BackupResult = { ref?: string; warning?: string }

export function success(backup: BackupResult): GitGraphActionResult {
  if (backup.warning) {
    return { ok: true, message: backup.warning, ...(backup.ref ? { backupRef: backup.ref } : {}) }
  }
  return { ok: true, ...(backup.ref ? { backupRef: backup.ref } : {}) }
}

export function failure(
  code: GitGraphActionFailureCode,
  message: string,
  conflict?: GitGraphConflictOperation,
  backupRef?: string
): GitGraphActionResult {
  return {
    ok: false,
    code,
    message,
    ...(conflict ? { conflict } : {}),
    ...(backupRef ? { backupRef } : {})
  }
}
