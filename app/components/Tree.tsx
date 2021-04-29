import { memo, useContext } from 'react';
import d3 from 'd3';

import { TreeNode } from '../tree';
import MapContext from './MapContext';

export default memo(function Tree({ tree }: { tree: TreeNode }) {
  const { projection } = useContext(MapContext);
  const rects = [];

  const visit = (node: TreeNode, depth = 0) => {
    const { extent } = node;
    const coords = [
      [extent[0][0], extent[0][1]],
      [extent[1][0], extent[0][1]],
      [extent[1][0], extent[1][1]],
      [extent[0][0], extent[1][1]],
      [extent[0][0], extent[0][1]],
    ].map(projection);
    rects.push(<path className="extent" d={d3.svg.line()(coords)} />);

    if (node.children && depth < 5) {
      node.children.forEach(c => visit(c, depth + 1));
    }
  };

  visit(tree);

  return <g>{rects}</g>;
});