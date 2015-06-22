import * as React from 'react';
import d3 from 'd3';


const Trip = React.createClass({
  contextTypes: {
    path: React.PropTypes.any
  },

  startAnimating() {
    let run = true;
    const stopAnimating = () => run = false;
    this._stopAnimating = stopAnimating;
    const duration = 7000;
    const node = React.findDOMNode(this);
    const length = node.getTotalLength();
    const ease = d3.ease('linear');
    d3.timer((elapsed) => {
      const t = elapsed / duration;

      const e = ease(t);
      const l = e * length;

      node.setAttribute('stroke-dasharray', `${l},${length}`);

      if (t > 1) {
        stopAnimating();
      }
      return !run;
    });
  },

  stopAnimating() {
    if (this._stopAnimating) {
      this._stopAnimating();
    }
  },

  render() {
    const {path} = this.context;
    const {trip} = this.props;
    return <path className="trip" d={path(trip)}/>;
  },

  componentDidMount() {
    // react doesn't support mask
    // https://github.com/facebook/react/issues/1657#issuecomment-63209488
    React.findDOMNode(this).setAttribute('mask', 'url(#boundary-mask)');
    if (this.props.animate) {
      this.startAnimating();
    }
  },

  componentWillUnmount() {
    this.stopAnimating();
  }
});

export default React.createClass({
  render() {
    const {trips} = this.props;
    return (
      <g>
        {trips.map(trip => <Trip trip={trip}/>)}
      </g>
    );
  }
});
