import React from 'react'
import type { GitHistoryGraphColorId } from '../../../../../../shared/git-history'
import {
  getGitHistoryItemColor,
  getGitHistoryItemLaneIndex,
  getGitHistoryMergeParentLaneIndex,
  type GitHistoryItemViewModel
} from '../../../../../../shared/git-history-graph'

const ROW_PITCH_GIT_GRAPH = 28
const SWIMLANE_WIDTH = 11
const SWIMLANE_CURVE_RADIUS = 5
const SWIMLANE_NODE_Y = (rowPitch: number) => rowPitch / 2
const CIRCLE_RADIUS = 3.5
const CIRCLE_STROKE_WIDTH = 1.5

export function graphColor(color: GitHistoryGraphColorId): string {
  return `var(--${color})`
}

function GraphPath({
  d,
  color,
  strokeWidth = 2
}: {
  d: string
  color: GitHistoryGraphColorId
  strokeWidth?: number
}): React.JSX.Element {
  return (
    <path
      d={d}
      fill="none"
      stroke={graphColor(color)}
      strokeLinecap="round"
      strokeWidth={strokeWidth}
    />
  )
}

export function GitHistoryGraphSvg({
  viewModel,
  rowPitch = ROW_PITCH_GIT_GRAPH
}: {
  viewModel: GitHistoryItemViewModel
  /** The rendered row's outer height: lanes must span it exactly or they break between rows. */
  rowPitch?: number
}): React.JSX.Element {
  const historyItem = viewModel.historyItem
  const inputSwimlanes = viewModel.inputSwimlanes
  const outputSwimlanes = viewModel.outputSwimlanes
  const inputIndex = inputSwimlanes.findIndex((node) => node.id === historyItem.id)
  const circleIndex = getGitHistoryItemLaneIndex(viewModel)
  const circleColor = getGitHistoryItemColor(viewModel)

  const paths: React.JSX.Element[] = []
  let outputSwimlaneIndex = 0

  for (let index = 0; index < inputSwimlanes.length; index += 1) {
    const color = inputSwimlanes[index]!.color
    if (inputSwimlanes[index]!.id === historyItem.id) {
      if (index !== circleIndex) {
        paths.push(
          <GraphPath
            key={`base-${inputSwimlanes[index]!.id}`}
            color={color}
            d={[
              `M ${SWIMLANE_WIDTH * (index + 1)} 0`,
              `A ${SWIMLANE_WIDTH} ${rowPitch / 2} 0 0 1 ${SWIMLANE_WIDTH * index} ${SWIMLANE_NODE_Y(rowPitch)}`,
              `H ${SWIMLANE_WIDTH * (circleIndex + 1)}`
            ].join(' ')}
          />
        )
      } else if (historyItem.parentIds.length > 0) {
        outputSwimlaneIndex += 1
      }
      continue
    }

    if (
      outputSwimlaneIndex < outputSwimlanes.length &&
      inputSwimlanes[index]!.id === outputSwimlanes[outputSwimlaneIndex]!.id
    ) {
      if (index === outputSwimlaneIndex) {
        paths.push(
          <GraphPath
            key={`vertical-${inputSwimlanes[index]!.id}`}
            color={color}
            d={`M ${SWIMLANE_WIDTH * (index + 1)} 0 V ${rowPitch}`}
          />
        )
      } else {
        paths.push(
          <GraphPath
            key={`shift-${inputSwimlanes[index]!.id}-${outputSwimlanes[outputSwimlaneIndex]!.id}`}
            color={color}
            d={[
              `M ${SWIMLANE_WIDTH * (index + 1)} 0`,
              'V 6',
              `A ${SWIMLANE_CURVE_RADIUS} ${rowPitch / 4} 0 0 1 ${
                SWIMLANE_WIDTH * (index + 1) - SWIMLANE_CURVE_RADIUS
              } ${rowPitch / 2}`,
              `H ${SWIMLANE_WIDTH * (outputSwimlaneIndex + 1) + SWIMLANE_CURVE_RADIUS}`,
              `A ${SWIMLANE_CURVE_RADIUS} ${rowPitch / 4} 0 0 0 ${
                SWIMLANE_WIDTH * (outputSwimlaneIndex + 1)
              } ${rowPitch / 2 + SWIMLANE_CURVE_RADIUS}`,
              `V ${rowPitch}`
            ].join(' ')}
          />
        )
      }
      outputSwimlaneIndex += 1
    }
  }

  for (let index = 1; index < historyItem.parentIds.length; index += 1) {
    const parentId = historyItem.parentIds[index]!
    const parentOutputIndex = getGitHistoryMergeParentLaneIndex(viewModel, parentId)
    if (parentOutputIndex === -1) {
      continue
    }
    paths.push(
      <GraphPath
        key={`merge-parent-${parentId}`}
        color={outputSwimlanes[parentOutputIndex]!.color}
        d={[
          `M ${SWIMLANE_WIDTH * (circleIndex + 1)} ${rowPitch / 2}`,
          `A ${SWIMLANE_WIDTH} ${rowPitch / 2} 0 0 1 ${SWIMLANE_WIDTH * (parentOutputIndex + 1)} ${rowPitch}`
        ].join(' ')}
      />
    )
  }

  if (inputIndex !== -1) {
    paths.push(
      <GraphPath
        key="into-node"
        color={inputSwimlanes[inputIndex]!.color}
        d={`M ${SWIMLANE_WIDTH * (circleIndex + 1)} 0 V ${rowPitch / 2}`}
      />
    )
  }
  if (historyItem.parentIds.length > 0) {
    paths.push(
      <GraphPath
        key="out-of-node"
        color={circleColor}
        d={`M ${SWIMLANE_WIDTH * (circleIndex + 1)} ${rowPitch / 2} V ${rowPitch}`}
      />
    )
  }

  const cx = SWIMLANE_WIDTH * (circleIndex + 1)
  const cy = SWIMLANE_NODE_Y(rowPitch)
  const width = SWIMLANE_WIDTH * (Math.max(inputSwimlanes.length, outputSwimlanes.length, 1) + 1)
  const isBoundaryNode =
    viewModel.kind === 'incoming-changes' || viewModel.kind === 'outgoing-changes'
  const isMergeNode = historyItem.parentIds.length > 1

  return (
    <svg
      aria-hidden="true"
      className="shrink-0 overflow-visible"
      width={width}
      height={rowPitch}
      viewBox={`0 0 ${width} ${rowPitch}`}
    >
      {paths}
      {viewModel.kind === 'HEAD' && (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={CIRCLE_RADIUS + 3}
            fill={graphColor(circleColor)}
            stroke="var(--background)"
            strokeWidth={CIRCLE_STROKE_WIDTH}
          />
          <circle cx={cx} cy={cy} r={CIRCLE_STROKE_WIDTH} fill="var(--background)" />
        </>
      )}
      {isBoundaryNode && (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={CIRCLE_RADIUS + 3}
            fill={graphColor(circleColor)}
            stroke="var(--background)"
            strokeWidth={CIRCLE_STROKE_WIDTH}
          />
          <circle
            cx={cx}
            cy={cy}
            r={CIRCLE_RADIUS + 1}
            fill="var(--background)"
            stroke="var(--background)"
            strokeWidth={CIRCLE_STROKE_WIDTH + 1}
          />
          <circle
            cx={cx}
            cy={cy}
            r={CIRCLE_RADIUS + 1}
            fill="none"
            stroke={graphColor(circleColor)}
            strokeDasharray="4 2"
            strokeWidth={CIRCLE_STROKE_WIDTH - 1}
          />
        </>
      )}
      {!isBoundaryNode && viewModel.kind !== 'HEAD' && isMergeNode && (
        <rect
          x={cx - CIRCLE_RADIUS - 1}
          y={cy - CIRCLE_RADIUS - 1}
          width={(CIRCLE_RADIUS + 1) * 2}
          height={(CIRCLE_RADIUS + 1) * 2}
          fill={graphColor(circleColor)}
          stroke="var(--background)"
          strokeWidth={CIRCLE_STROKE_WIDTH}
          transform={`rotate(45 ${cx} ${cy})`}
        />
      )}
      {!isBoundaryNode && viewModel.kind !== 'HEAD' && !isMergeNode && (
        <circle cx={cx} cy={cy} r={CIRCLE_RADIUS} fill={graphColor(circleColor)} />
      )}
    </svg>
  )
}
