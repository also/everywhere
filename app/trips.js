import * as React from 'react';


const Trip = React.createClass({
  render() {
    const {trip, path} = this.props;
    return <path className="trip" d={path(trip)}/>;
  },

  componentDidMount() {
    // react doesn't support mask
    // https://github.com/facebook/react/issues/1657#issuecomment-63209488
    React.findDOMNode(this).setAttribute('mask', 'url(#boundary-mask)');
  }
});

export default React.createClass({
  render() {
    const {trips, path} = this.props;
    return (
      <g>
        {trips.map(trip => <Trip trip={trip} path={path}/>)}
      </g>
    );
  }
});
