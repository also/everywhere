import * as React from 'react';
import {Link} from 'react-router';
import MapComponent from './Map';


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
          {() => null}
        </MapComponent>
        <ul style={{WebkitColumnWidth: '200px'}}>
          {groupedWays.map(way => (
            <li key={way.name}><Link to={`/ways/${way.name}`}>{way.name || '(no name)'}</Link></li>
          ))}
        </ul>
      </div>
    );
  }
});
