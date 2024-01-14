// Copied from https://gist.github.com/twelch/1ef68c532639f6d3a23e

export type GoodPosition = [number, number];

/**
 * @param {Point} pt1
 * @param {Point} pt1
 * @return number The Euclidean distance between `pt1` and `pt2`.
 */
function euclideanDistance(pt1: GoodPosition, pt2: GoodPosition) {
  const deltaX = pt1[0] - pt2[0];
  const deltaY = pt1[1] - pt2[1];
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

/**
 * @param {array of Point} ctrlPoints The vertices of the (multi-segment) line
 *      to be interpolate along.
 * @param {int} number The number of points to interpolate along the line; this
 *      includes the endpoints, and has an effective minimum value of 2 (if a
 *      smaller number is given, then the endpoints will still be returned).
 * @param {int} [minGap] An optional minimum gap to maintain between subsequent
 *      interpolated points; if the projected gap between subsequent points for
 *      a set of `number` points is lower than this value, `number` will be
 *      decreased to a suitable value.
 */
export function* interpolateLineRange(
  ctrlPoints: GoodPosition[],
  __number: number,
  distance: (
    pt1: GoodPosition,
    pt2: GoodPosition
  ) => number = euclideanDistance,
  step: number = 0
): Generator<{ point: GoodPosition; index: number }> {
  yield { point: ctrlPoints[0], index: 0 };

  let prevCtrlPtInd = 0;
  let nextCtrlPtDist = 0;
  let currDist!: number;
  let currPoint!: GoodPosition;
  let ctrlPtsDist!: number;
  let ctrlPtsDeltaX!: number;
  let ctrlPtsDeltaY!: number;

  let nextInterpDist = step;

  function advance() {
    const prevCtrlPtDist = nextCtrlPtDist;
    currPoint = ctrlPoints[prevCtrlPtInd];
    const nextPoint = ctrlPoints[prevCtrlPtInd + 1];
    nextCtrlPtDist += distance(nextPoint, currPoint);
    currDist = prevCtrlPtDist;
    ctrlPtsDist = nextCtrlPtDist - prevCtrlPtDist;
    ctrlPtsDeltaX = nextPoint[0] - currPoint[0];
    ctrlPtsDeltaY = nextPoint[1] - currPoint[1];
  }

  advance();

  outer: while (true) {
    if (nextInterpDist < nextCtrlPtDist) {
      // don't need to advance control point
    } else {
      // Find the segment in which the next interpolated point lies.
      while (nextCtrlPtDist < nextInterpDist) {
        if (prevCtrlPtInd === ctrlPoints.length - 2) {
          break outer;
        }
        prevCtrlPtInd++;

        advance();
      }

      if (
        prevCtrlPtInd === ctrlPoints.length - 2 &&
        nextInterpDist === nextCtrlPtDist
      ) {
        break;
      }
    }

    // Interpolate the coordinates of the next point along the current segment.
    const remainingDist = nextInterpDist - currDist;
    const distRatio = remainingDist / ctrlPtsDist;

    currPoint = [
      currPoint[0] + ctrlPtsDeltaX * distRatio,
      currPoint[1] + ctrlPtsDeltaY * distRatio,
    ];

    yield { point: currPoint, index: prevCtrlPtInd };

    currDist = nextInterpDist;
    nextInterpDist += step;
  }

  yield {
    point: ctrlPoints[ctrlPoints.length - 1],
    index: ctrlPoints.length - 1,
  };
}
