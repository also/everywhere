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
export function interpolateLineRange(
  ctrlPoints: GoodPosition[],
  number: number,
  distance: (
    pt1: GoodPosition,
    pt2: GoodPosition
  ) => number = euclideanDistance,
  minGap: number = 0
) {
  // Calculate path distance from each control point (vertex) to the beginning
  // of the line.
  let totalDist = 0;
  const ctrlPtDists = [0];
  for (let pt = 1; pt < ctrlPoints.length; pt++) {
    const dist = distance(ctrlPoints[pt], ctrlPoints[pt - 1]);
    totalDist += dist;
    ctrlPtDists.push(totalDist);
  }

  if (totalDist / (number - 1) < minGap) {
    number = totalDist / minGap + 1;
  }

  // Variables used to control interpolation.
  const step = totalDist / (number - 1);
  const interpPoints: { point: GoodPosition; index: number }[] = [
    { point: ctrlPoints[0], index: 0 },
  ];
  let prevCtrlPtInd = 0;
  let currDist = 0;
  let currPoint = ctrlPoints[0];
  let nextDist = step;

  for (let pt = 0; pt < number - 2; pt++) {
    // Find the segment in which the next interpolated point lies.
    while (nextDist > ctrlPtDists[prevCtrlPtInd + 1]) {
      prevCtrlPtInd++;
      currDist = ctrlPtDists[prevCtrlPtInd];
      currPoint = ctrlPoints[prevCtrlPtInd];
    }

    // Interpolate the coordinates of the next point along the current segment.
    const remainingDist = nextDist - currDist;
    const ctrlPtsDeltaX =
      ctrlPoints[prevCtrlPtInd + 1][0] - ctrlPoints[prevCtrlPtInd][0];
    const ctrlPtsDeltaY =
      ctrlPoints[prevCtrlPtInd + 1][1] - ctrlPoints[prevCtrlPtInd][1];
    const ctrlPtsDist =
      ctrlPtDists[prevCtrlPtInd + 1] - ctrlPtDists[prevCtrlPtInd];
    const distRatio = remainingDist / ctrlPtsDist;

    currPoint = [
      currPoint[0] + ctrlPtsDeltaX * distRatio,
      currPoint[1] + ctrlPtsDeltaY * distRatio,
    ];

    interpPoints.push({ point: currPoint, index: prevCtrlPtInd });

    currDist = nextDist;
    nextDist += step;
  }

  interpPoints.push({
    point: ctrlPoints[ctrlPoints.length - 1],
    index: ctrlPoints.length - 1,
  });
  return interpPoints;
}
