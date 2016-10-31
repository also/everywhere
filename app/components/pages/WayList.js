import * as React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import {Link, Navigation} from 'react-router';

import MapComponent from '../Map';
import Ways from '../Ways';


const WayList = React.createClass({
  mixins: [PureRenderMixin],

  render() {
    const {groupedWays} = this.props;

    return (
      <ul style={{WebkitColumnWidth: '200px'}}>
        {groupedWays.map(way => (
          <li key={way.displayName}><Link to={`/ways/${way.displayName}`}>{way.displayName}</Link></li>
        ))}
      </ul>
    );
  }
});

export default React.createClass({
  mixins: [PureRenderMixin, Navigation],

  getInitialState() {
    return {hoveredStreet: null};
  },

  onMouseMove({geo}) {
    const {wayTree} = this.props;
    const leaf = wayTree.nearest(geo);
    this.setState({hoveredStreet: leaf.data.feature});
  },

  onClick({geo}) {
    const {wayTree} = this.props;
    const leaf = wayTree.nearest(geo);
    const way = leaf.data.feature;
    this.transitionTo(`/ways/${way.properties.displayName}`);
  },

  render() {
    const {groupedWays} = this.props;
    const {hoveredStreet} = this.state;

    return (
      <div>
        <h1>Streets</h1>
        <div className='way-map'>
          <div className='way-hover-info'>{hoveredStreet ? (hoveredStreet.properties.displayName) : '(hover over a street)'}</div>
          <MapComponent width="1000" height="1000" onMouseMove={this.onMouseMove} onClick={this.onClick}>
            {this.mapLayers}
          </MapComponent>
        </div>
        <WayList groupedWays={groupedWays}/>
      </div>
    );
  },

  mapLayers() {
    const {hoveredStreet} = this.state;
    return hoveredStreet ? <Ways features={[hoveredStreet]} selected={true}/> : null;
  }
});