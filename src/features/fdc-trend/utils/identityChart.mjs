export const MAX_RENDERED_POINTS_PER_SERIES = 800
export const MAX_OTHER_IDENTITY_POINTS_PER_EQP = 600
export const IDENTITY_GROUP_INSET = 0.06
const RECENT_WINDOW_MS = 26 * 60 * 60 * 1000

export function samplePoints(points, limit = MAX_RENDERED_POINTS_PER_SERIES) {
  if (points.length <= limit) return points

  const sampled = [points[0]]
  const interval = (points.length - 1) / (limit - 1)
  for (let index = 1; index < limit - 1; index += 1) {
    sampled.push(points[Math.round(index * interval)])
  }
  sampled.push(points.at(-1))
  return sampled
}

export function buildIdentityChartPoints(groups) {
  return groups.flatMap((group, groupIndex) => {
    const firstTime = group.points[0]?.actTimeMs ?? 0
    const lastTime = group.points.at(-1)?.actTimeMs ?? firstTime
    const timeRange = lastTime - firstTime
    const recentThresholdMs = lastTime - RECENT_WINDOW_MS
    const availableWidth = 1 - IDENTITY_GROUP_INSET * 2

    return group.points.map((point) => ({
      ...point,
      eqpCb: group.eqpCb,
      isSelected: group.isSelected,
      isRecent: point.actTimeMs >= recentThresholdMs,
      identityX: timeRange
        ? groupIndex + IDENTITY_GROUP_INSET
          + ((point.actTimeMs - firstTime) / timeRange) * availableWidth
        : groupIndex + 0.5,
    }))
  })
}

export function selectRenderedIdentityPoints(groups, identityPoints, zoomDomain) {
  const visiblePoints = zoomDomain
    ? identityPoints.filter((point) => (
      point.identityX >= zoomDomain.x[0]
      && point.identityX <= zoomDomain.x[1]
      && point.value >= zoomDomain.y[0]
      && point.value <= zoomDomain.y[1]
    ))
    : identityPoints
  const otherGroupLimit = Math.min(
    MAX_OTHER_IDENTITY_POINTS_PER_EQP,
    Math.max(60, Math.floor(2400 / Math.max(groups.length, 1))),
  )
  const byGroup = new Map()
  visiblePoints.forEach((point) => {
    const points = byGroup.get(point.eqpCb) ?? []
    points.push(point)
    byGroup.set(point.eqpCb, points)
  })

  const selected = []
  const others = []
  groups.forEach((group) => {
    const points = byGroup.get(group.eqpCb) ?? []
    if (group.isSelected) {
      selected.push(
        ...samplePoints(points.filter((point) => !point.isRecent)),
        ...samplePoints(points.filter((point) => point.isRecent)),
      )
    } else {
      others.push(...samplePoints(points, otherGroupLimit))
    }
  })

  return {
    selected,
    others,
    points: [...others, ...selected],
  }
}
