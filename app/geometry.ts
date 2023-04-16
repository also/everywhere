import RBush, { BBox } from 'rbush';
import Queue from 'tinyqueue';
import { compareDistance } from './tree';

function boxDist(x: number, y: number, box: BBox) {
  const dx = axisDist(x, box.minX, box.maxX),
    dy = axisDist(y, box.minY, box.maxY);
  return dx * dx + dy * dy;
}

function axisDist(k: number, min: number, max: number) {
  return k < min ? min - k : k <= max ? 0 : k - max;
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
  // should return the distance between the point and the item squared
  distance: (a: T, b: [number, number]) => number
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
        const d = distance(item, p);
        if (d < maxDistance) {
          maxDistance = d;
          result = item;
        }
      }
    } else {
      for (const child of node.children) {
        const d = boxDist(p[0], p[1], child);
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

  return result;
}
