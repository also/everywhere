import { Position } from 'geojson';
import RBush, { BBox } from 'rbush';
import Queue from 'tinyqueue';

export function compareDistance(
  a: { distance: number },
  b: { distance: number }
) {
  return a.distance - b.distance;
}

export function pointDistance(a: Position, b: Position) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

export function pointLineSegmentDistance(
  c: Position,
  a: Position,
  b: Position,
  d: typeof pointDistance = pointDistance
) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d2 = dx * dx + dy * dy;
  const t = d2 && ((c[0] - a[0]) * dx + (c[1] - a[1]) * (b[1] - a[1])) / d2;
  return d(c, t <= 0 ? a : t >= 1 ? b : [a[0] + t * dx, a[1] + t * dy]);
}

// function boxDist(x: number, y: number, box: BBox) {
//   const dx = axisDist(x, box.minX, box.maxX),
//     dy = axisDist(y, box.minY, box.maxY);
//   return dx * dx + dy * dy;
// }

// function axisDist(k: number, min: number, max: number) {
//   return k < min ? min - k : k <= max ? 0 : k - max;
// }

type DistanceFunction = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => number;

export const euclideanDistance: DistanceFunction = (x1, y1, x2, y2) => {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
};

export function boxDist(
  x: number,
  y: number,
  box: BBox,
  distanceFn: DistanceFunction
) {
  const nearestX = nearestCoord(x, box.minX, box.maxX),
    nearestY = nearestCoord(y, box.minY, box.maxY);
  return distanceFn(x, y, nearestX, nearestY);
}

function nearestCoord(k: number, min: number, max: number) {
  return k < min ? min : k <= max ? k : max;
}

type RBushNode<T> = RBushInternalNode<T> | RBushLeaflNode<T>;

interface RBushInternalNode<T> extends BBox {
  leaf: false;
  children: RBushNode<T>[];
}

interface RBushLeaflNode<T> extends BBox {
  leaf: true;
  children: T[];
}

export function nearestUsingRTree<T>(
  tree: RBush<T>,
  p: [number, number],
  itemDist: (a: T, b: [number, number]) => number,
  bboxDist: (a: BBox, b: [number, number]) => number,
  maxDistance: number = Infinity,
  minDistance: number = 0
) {
  let node: RBushNode<T> = (tree as any).data;
  const nearestNeighborPriorityQueue = new Queue<{
    distance: number;
    node: RBushNode<T>;
  }>([], compareDistance);
  let result: T | undefined = undefined;

  while (node) {
    if (node.leaf) {
      for (const item of node.children) {
        const d = itemDist(item, p);
        if (d < maxDistance) {
          maxDistance = d;
          result = item;
        }
        if (d < minDistance) {
          break;
        }
      }
    } else {
      for (const child of node.children) {
        const d = bboxDist(child, p);
        if (d < maxDistance) {
          nearestNeighborPriorityQueue.push({ node: child, distance: d });
        }
      }
    }

    const next = nearestNeighborPriorityQueue.pop();
    if (next && next.distance < maxDistance) {
      node = next.node;
    } else {
      break;
    }
  }

  return result ? { item: result, distance: maxDistance } : undefined;
}

export function withinUsingRTree<T>(
  tree: RBush<T>,
  p: [number, number],
  maxDistance: number,
  itemDist: (a: T, b: [number, number]) => number,
  bboxDist: (a: BBox, b: [number, number]) => number
) {
  let node: RBushNode<T> | undefined = (tree as any).data;
  const queue: RBushNode<T>[] = [];
  const result: { distance: number; item: T }[] = [];

  while (node) {
    if (node.leaf) {
      for (const item of node.children) {
        const d = itemDist(item, p);
        if (d < maxDistance) {
          result.push({ distance: d, item });
        }
      }
    } else {
      for (const child of node.children) {
        const d = bboxDist(child, p);
        if (d < maxDistance) {
          queue.push(child);
        }
      }
    }

    node = queue.pop();
  }

  return result;
}
