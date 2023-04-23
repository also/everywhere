import { Position } from 'geojson';
import RBush, { BBox } from 'rbush';
import Queue from 'tinyqueue';

export function compareDistance(
  a: { distance: number },
  b: { distance: number }
) {
  return a.distance - b.distance;
}

export type DistanceFunction = (a: Position, b: Position) => number;

export function squaredEuclideanDistance(a: Position, b: Position) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

export function pointLineSegmentDistance(
  c: Position,
  a: Position,
  b: Position,
  d: DistanceFunction = squaredEuclideanDistance
) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d2 = dx * dx + dy * dy;
  const t = d2 && ((c[0] - a[0]) * dx + (c[1] - a[1]) * (b[1] - a[1])) / d2;
  return d(c, t <= 0 ? a : t >= 1 ? b : [a[0] + t * dx, a[1] + t * dy]);
}

export function boxDist(
  point: Position,
  box: BBox,
  distanceFn: DistanceFunction
) {
  const x = point[0];
  const y = point[1];
  const nearestX = nearestCoord(x, box.minX, box.maxX),
    nearestY = nearestCoord(y, box.minY, box.maxY);
  return distanceFn([x, y], [nearestX, nearestY]);
}

function nearestCoord(k: number, min: number, max: number) {
  return k < min ? min : k <= max ? k : max;
}

type RBushNode<T> = RBushInternalNode<T> | RBushLeafNode<T>;

interface RBushInternalNode<T> extends BBox {
  leaf: false;
  children: RBushNode<T>[];
}

interface RBushLeafNode<T> extends BBox {
  leaf: true;
  children: T[];
}

export function nearest<T>(
  tree: RBush<T>,
  p: Position,
  itemDist: (point: Position, item: T, dist: DistanceFunction) => number,
  dist: DistanceFunction,
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
        const d = itemDist(p, item, dist);
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
        const d = boxDist(p, child, dist);
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

export function within<T>(
  tree: RBush<T>,
  p: Position,
  maxDistance: number,
  itemDist: (point: Position, item: T, dist: DistanceFunction) => number,
  dist: DistanceFunction
) {
  let node: RBushNode<T> | undefined = (tree as any).data;
  const queue: RBushNode<T>[] = [];
  const result: { distance: number; item: T }[] = [];

  while (node) {
    if (node.leaf) {
      for (const item of node.children) {
        const d = itemDist(p, item, dist);
        if (d < maxDistance) {
          result.push({ distance: d, item });
        }
      }
    } else {
      for (const child of node.children) {
        const d = boxDist(p, child, dist);
        if (d < maxDistance) {
          queue.push(child);
        }
      }
    }

    node = queue.pop();
  }

  return result;
}
