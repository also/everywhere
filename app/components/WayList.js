import * as React from 'react/addons';
import {Link} from 'react-router';
import d3 from 'd3';
import MapComponent from './Map';

const badPoint = [-71.11664793407073, 42.39703382408742];

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

const BadPoint = React.createClass({
  mixins: [React.addons.PureRenderMixin],

  contextTypes: {
    projection: React.PropTypes.any
  },

  render() {
    const {projection} = this.context;

    const [x, y] = projection(badPoint);
    return <circle cx={x} cy={y} r={4} className='position'/>;
  }
});

const SelectedLineSegment = React.createClass({
  mixins: [React.addons.PureRenderMixin],

  contextTypes: {
    projection: React.PropTypes.any
  },

  render() {
    const {projection} = this.context;
    const {coords} = this.props;

    return <path className="selected" d={d3.svg.line()(coords.map(projection))} />;
  }
});

export default React.createClass({
  mixins: [React.addons.PureRenderMixin],

  getInitialState() {
    return {selectedStreetName: null, selectedLineSegment: null};
  },

  onMouseMove({geo}) {
    this.selectGeo(geo);
  },

  componentWillMount() {
    this.selectGeo(badPoint);
  },

  selectGeo(coords) {
    const {wayTree} = this.props;
    const leaf = wayTree.nearest(coords);
    this.setState({/*selectedStreetName: leaf.data.feature.properties.name, */selectedLineSegment: leaf.coordinates});
  },

  render() {
    const {groupedWays} = this.props;
    const {selectedStreetName} = this.state;

    return (
      <div>
      <p>{selectedStreetName || `(no name)`}</p>
        <MapComponent width="1000" height="1000" onMouseMove={this.onMouseMove} selectedStreetName={selectedStreetName}>
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
    const {selectedLineSegment} = this.state;
    return [
      //<Tree tree={wayTree}/>,
      <BadPoint />,
      <SelectedLineSegment coords={selectedLineSegment}/>
    ];
  }
});
