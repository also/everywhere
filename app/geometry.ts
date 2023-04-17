import RBush, { BBox } from 'rbush';
import Queue from 'tinyqueue';
import { compareDistance } from './tree';

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
  bboxDist: (a: BBox, b: [number, number]) => number
) {
  let node: RBushNode<T> = (tree as any).data;
  const nearestNeighborPriorityQueue = new Queue<{
    distance: number;
    node: RBushNode<T>;
  }>([], compareDistance);
  let maxDistance = Infinity;
  let result: T | undefined = undefined;

  while (node) {
    if (node.leaf) {
      for (const item of node.children) {
        const d = itemDist(item, p);
        if (d < maxDistance) {
          maxDistance = d;
          result = item;
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
