// from http://bl.ocks.org/mbostock/a76006c5bc2a95695c6f
// FIXME license?

type Heap<T> = {
  size(): number;
  push(v: T): number;
  pop(): T | null;
  remove(v: T): number | null;
};

export default function <T>(compare: (a: T, b: T) => number): Heap<T> {
  const heap: Heap<T> = {} as any;
  const array: T[] = [];
  let size = 0;

  function up(object: T, i: number) {
    while (i > 0) {
      const j = ((i + 1) >> 1) - 1;
      const parent = array[j];

      if (compare(object, parent) >= 0) {
        break;
      }
      array[i] = parent;
      array[(i = j)] = object;
    }
  }

  function down(object: T, i: number) {
    while (true) {
      const r = (i + 1) << 1;
      const l = r - 1;
      let j = i;
      let child = array[j];

      if (l < size && compare(array[l], child) < 0) {
        child = array[(j = l)];
      }
      if (r < size && compare(array[r], child) < 0) {
        child = array[(j = r)];
      }
      if (j === i) {
        break;
      }
      array[i] = child;
      array[(i = j)] = object;
    }
  }

  heap.size = function () {
    return size;
  };

  heap.push = function (object) {
    up((array[size] = object), size++);
    return size;
  };

  heap.pop = function () {
    if (size <= 0) {
      return null;
    }

    const removed = array[0];
    if (--size > 0) {
      const object = array[size];
      down((array[0] = object), 0);
    }
    return removed;
  };

  heap.remove = function (removed) {
    const i = array.indexOf(removed);

    if (i < 0) {
      return null; // invalid request
    }

    if (i !== --size) {
      const object = array[size];
      (compare(object, removed) < 0 ? up : down)((array[i] = object), i);
    }
    return i;
  };

  return heap;
}
