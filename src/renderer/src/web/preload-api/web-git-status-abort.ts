import { callAbortableRuntimeEnvironment } from '../../runtime/abortable-runtime-environment-call'
import { requireActiveEnvironment, updateEnvironmentFromResponse } from './web-runtime-session'

export const webGitStatusAbortControllers = new Map<string, AbortController>()

export async function callAbortableRuntimeStatus<TResult>(
  requestToken: string,
  params: unknown
): Promise<TResult> {
  const environment = requireActiveEnvironment()
  webGitStatusAbortControllers.get(requestToken)?.abort()
  const controller = new AbortController()
  webGitStatusAbortControllers.set(requestToken, controller)
  try {
    const response = await callAbortableRuntimeEnvironment(
      environment.id,
      'git.status',
      params,
      undefined,
      controller.signal
    )
    updateEnvironmentFromResponse(environment, response)
    if (!response.ok) {
      throw new Error(response.error.message)
    }
    return response.result as TResult
  } finally {
    if (webGitStatusAbortControllers.get(requestToken) === controller) {
      webGitStatusAbortControllers.delete(requestToken)
    }
  }
}
