import * as React from 'react';
import createReactClass from 'create-react-class';

import Dot from './Dot';

export default createReactClass({
  getInitialState() {
    return { position: null };
  },

  componentWillMount() {
    if ('geolocation' in navigator) {
      this.watchId = navigator.geolocation.watchPosition(position =>
        this.setState({ position })
      );
    }
  },

  componentWillUnmount() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
    }
  },

  render() {
    const { position } = this.state;

    if (position) {
      const {
        coords: { latitude, longitude },
      } = position;
      return (
        <Dot position={[longitude, latitude]} r={4} className="position" />
      );
    } else {
      return null;
    }
  },
});
