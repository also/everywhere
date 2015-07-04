import * as React from 'react/addons';
import {Link} from 'react-router';
import d3 from 'd3';
import MapComponent from './Map';


const Tree = React.createClass({
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

export default React.createClass({
  getInitialState() {
    return {selectedStreetName: null};
  },

  onMouseMove({geo}) {
    const {wayTree} = this.props;
    const leaf = wayTree.nearest(geo);
    this.setState({selectedStreetName: leaf.data.feature.properties.name});
  },

  shouldComponentUpdate(nextProps, nextState) {
    return nextProps.groupedWays !== this.props.groupedWays || nextState.selectedStreetName !== this.state.selectedStreetName;
  },

  render() {
    const {groupedWays} = this.props;

    return (
      <div>
        <MapComponent width="1000" height="1000" onMouseMove={this.onMouseMove} selectedStreetName={this.state.selectedStreetName}>
          {this.mapLayers}
        </MapComponent>
        <ul style={{WebkitColumnWidth: '200px'}}>
          {groupedWays.map(way => (
            <li key={way.name}><Link to={`/ways/${way.name}`}>{way.name || '(no name)'}</Link></li>
          ))}
        </ul>
      </div>
    );
  },

  mapLayers() {
    const {wayTree} = this.props;
    return <Tree tree={wayTree}/>;
  }
});
