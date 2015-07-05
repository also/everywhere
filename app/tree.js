// TODO support quantized, delta-encoded arcs
// TODO group arcs based on connectedness!
// from http://bl.ocks.org/mbostock/a76006c5bc2a95695c6f
// FIXME license?

import minHeap from './min-heap';

function compareDistance(a, b) {
  return a.distance - b.distance;
}

function pointDistance(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function pointLineSegmentDistance(c, a, b) {
  var dx = b[0] - a[0],
      dy = b[1] - a[1],
      d2 = dx * dx + dy * dy,
      t = d2 && ((c[0] - a[0]) * dx + (c[1] - a[1]) * (b[1] - a[1])) / d2;
  return pointDistance(c, t <= 0 ? a : t >= 1 ? b : [a[0] + t * dx, a[1] + t * dy]);
}

function group(children) {
  let n0;

  while ((n0 = children.length) > 1) {
    const children1 = new Array(Math.ceil(n0 / 2));
    let i0, i1;
    for (i0 = 0, i1 = 0; i0 < n0 - 1; i0 += 2, i1 += 1) {
      const child0 = children[i0];
      const child1 = children[i0 + 1];
      children1[i1] = new Node(child0, child1);
    }

    if (i0 < n0) {
      children1[i1] = children[i0];
    }

    children = children1;
  }

  return children[0];
}

class Node {
  constructor(child0, child1) {
    const e0 = child0.extent;
    const e1 = child1.extent;
    this.children = [child0, child1];
    this.extent = [
      [Math.min(e0[0][0], e1[0][0]), Math.min(e0[0][1], e1[0][1])],
      [Math.max(e0[1][0], e1[1][0]), Math.max(e0[1][1], e1[1][1])]
    ];
  }

  distance(point) {
    const [x, y] = point;
    const [[x0, y0], [x1, y1]] = this.extent;

    return x < x0 ? pointLineSegmentDistance(point, [x0, y0], [x0, y1])
         : x > x1 ? pointLineSegmentDistance(point, [x1, y0], [x1, y1])
         : y < y0 ? pointLineSegmentDistance(point, [x0, y0], [x1, y0])
         : y > y1 ? pointLineSegmentDistance(point, [x0, y1], [x1, y1])
         : 0;
  }

  nearest(point) {
    let minNode;
    let minDistance = Infinity;
    const heap = minHeap(compareDistance);
    let node = this;
    let candidate = {distance: node.distance(point), node};

    do {
      node = candidate.node;
      if (node.children) {
        heap.push({distance: node.children[0].distance(point), node: node.children[0]});
        heap.push({distance: node.children[1].distance(point), node: node.children[1]});
      } else {
        const distance = node.distance(point);
        if (distance < minDistance) {
          minDistance = distance;
          minNode = node;
        }
      }

    } while ((candidate = heap.pop()) && (candidate.distance <= minDistance));

    return minNode;
  }
}

class Leaf {
  constructor(point0, point1, index, data) {
    this.coordinates = [point0, point1];
    this.extent = [
      [Math.min(point0[0], point1[0]), Math.min(point0[1], point1[1])],
      [Math.max(point0[0], point1[0]), Math.max(point0[1], point1[1])]
    ];
    this.index = index;
    this.data = data;
  }

  distance(point) {
    return pointLineSegmentDistance(point, this.coordinates[0], this.coordinates[1]);
  }
}

export default function(topology) {
  return group(topology.arcs.map(arc => {
    let i = 0;
    const n = arc.length;
    let p0;
    let p1 = arc[0];
    const children = new Array(n - 1);

    while (++i < n) {
      p0 = p1;
      p1 = arc[i];
      children[i - 1] = new Leaf(p0, p1, i, arc);
    }

    return group(children);
  }));
}
