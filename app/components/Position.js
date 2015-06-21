import * as React from 'react';


export default React.createClass({
  contextTypes: {
    projection: React.PropTypes.any
  },

  getInitialState() {
    return {position: null};
  },

  componentWillMount() {
    if ('geolocation' in navigator) {
      this.watchId = navigator.geolocation.watchPosition(position => this.setState({position}));
    } else {
      /* geolocation IS NOT available */
    }
  },

  componentWillUnmount() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
    }
  },

  render() {
    const {projection} = this.context;
    const {position} = this.state;

    if (position) {
      const {coords: {latitude, longitude}} = position;
      const [x, y] = projection([longitude, latitude]);
      return <circle cx={x} cy={y} r={4} className='position'/>;
    } else {
      return null;
    }
  }
});
