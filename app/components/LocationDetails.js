import React from 'react/addons';

import MapComponent from './Map';
import Dot from './Dot';

export default React.createClass({
  render() {
    const {location} = this.props;
    return (
      <div>
        <h1>{location.join(', ')}</h1>
        <MapComponent width={1000} height={1000}>{this.mapLayers}</MapComponent>
      </div>
    );
  },

  mapLayers() {
    return <Dot r={4} className='position' position={this.props.location}/>;
  }
});
