import * as React from 'react/addons';
import d3 from 'd3';

export default React.createClass({
  mixins: [React.addons.PureRenderMixin],

  contextTypes: {
    projection: React.PropTypes.any
  },

  propTypes: {
    tree: React.PropTypes.any.isRequired
  },

  render() {
    const {tree} = this.props;
    const {projection} = this.context;

    const rects = [];

    const visit = node => {
      const {extent} = node;
      const coords = [
        [extent[0][0], extent[0][1]],
        [extent[1][0], extent[0][1]],
        [extent[1][0], extent[1][1]],
        [extent[0][0], extent[1][1]],
        [extent[0][0], extent[0][1]]
      ].map(projection);
      rects.push(<path className="extent" d={d3.svg.line()(coords)}/>);

      if (node.children) {
        node.children.forEach(visit);
      }
    };

    visit(tree);

    return (
      <g>
        {rects}
      </g>
    );
  }
});
