import * as React from 'react/addons';
import {Link} from 'react-router';

import MapComponent from './Map';


export default React.createClass({
  getInitialState() {
    return {hoveredStreetName: null};
  },

  onMouseMove({geo}) {
    const {wayTree} = this.props;
    const leaf = wayTree.nearest(geo);
    this.setState({hoveredStreetName: leaf.data.feature.properties.name});
  },

  shouldComponentUpdate(nextProps, nextState) {
    return nextProps.groupedWays !== this.props.groupedWays || nextState.hoveredStreetName !== this.state.hoveredStreetName;
  },

  render() {
    const {groupedWays} = this.props;
    const {hoveredStreetName} = this.state;

    return (
      <div>
        <p>{hoveredStreetName || '(no name)'}</p>
        <MapComponent width="1000" height="1000" onMouseMove={this.onMouseMove} selectedStreetName={hoveredStreetName}>
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
    return null;
  }
});
