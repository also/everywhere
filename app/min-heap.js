// from http://bl.ocks.org/mbostock/a76006c5bc2a95695c6f
// FIXME license?

export default function(compare) {
  const heap = {};
  const array = [];
  let size = 0;

  function up(object, i) {
    while (i > 0) {
      const j = ((i + 1) >> 1) - 1;
      const parent = array[j];

      if (compare(object, parent) >= 0) {
        break;
      }
      array[(parent._ = i)] = parent;
      array[(object._ = i = j)] = object;
    }
  }

  function down(object, i) {
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
      array[(child._ = i)] = child;
      array[(object._ = i = j)] = object;
    }
  }

  heap.size = function() {
    return size;
  };

  heap.push = function(object) {
    up((array[(object._ = size)] = object), size++);
    return size;
  };

  heap.pop = function() {
    if (size <= 0) {
      return null;
    }

    const removed = array[0];
    if (--size > 0) {
      const object = array[size];
      down((array[(object._ = 0)] = object), 0);
    }
    return removed;
  };

  heap.remove = function(removed) {
    const i = removed._;

    if (array[i] !== removed) {
      return null; // invalid request
    }

    if (i !== --size) {
      const object = array[size];
      (compare(object, removed) < 0 ? up : down)(
        (array[(object._ = i)] = object),
        i
      );
    }
    return i;
  };

  return heap;
}
