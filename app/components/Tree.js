import PropTypes from 'prop-types';
import * as React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import createReactClass from 'create-react-class';
import d3 from 'd3';

export default createReactClass({
  mixins: [PureRenderMixin],

  contextTypes: {
    projection: PropTypes.any,
  },

  propTypes: {
    tree: PropTypes.any.isRequired,
  },

  render() {
    const { tree } = this.props;
    const { projection } = this.context;

    const rects = [];

    const visit = node => {
      const { extent } = node;
      const coords = [
        [extent[0][0], extent[0][1]],
        [extent[1][0], extent[0][1]],
        [extent[1][0], extent[1][1]],
        [extent[0][0], extent[1][1]],
        [extent[0][0], extent[0][1]],
      ].map(projection);
      rects.push(<path className="extent" d={d3.svg.line()(coords)} />);

      if (node.children) {
        node.children.forEach(visit);
      }
    };

    visit(tree);

    return <g>{rects}</g>;
  },
});
