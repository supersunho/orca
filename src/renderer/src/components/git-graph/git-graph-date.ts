const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY

export function formatGitGraphDate(
  timestamp: number | null | undefined,
  relative: boolean,
  now = Date.now()
): string {
  if (!timestamp) {
    return ''
  }
  const date = new Date(timestamp)
  if (!relative) {
    return date.toLocaleDateString()
  }

  const seconds = Math.round((timestamp - now) / 1000)
  const magnitude = Math.abs(seconds)
  const [unit, divisor]: [Intl.RelativeTimeFormatUnit, number] =
    magnitude < HOUR
      ? ['minute', MINUTE]
      : magnitude < DAY
        ? ['hour', HOUR]
        : magnitude < MONTH
          ? ['day', DAY]
          : magnitude < YEAR
            ? ['month', MONTH]
            : ['year', YEAR]
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
    Math.round(seconds / divisor),
    unit
  )
}
