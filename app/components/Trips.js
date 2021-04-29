import * as React from 'react';
import { findDOMNode } from 'react-dom';
import createReactClass from 'create-react-class';
import d3 from 'd3';

import MapContext from './MapContext';

const Trip = createReactClass({
  startAnimating() {
    let run = true;
    const stopAnimating = () => (run = false);
    this._stopAnimating = stopAnimating;
    const duration = 7000;
    const node = findDOMNode(this);
    const length = node.getTotalLength();
    const ease = d3.ease('linear');
    d3.timer(elapsed => {
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
    const { trip } = this.props;
    return (
      <MapContext.Consumer>
        {({ path }) => <path className="trip" d={path(trip)} />}
      </MapContext.Consumer>
    );
  },

  componentDidMount() {
    if (this.props.animate) {
      this.startAnimating();
    }
  },

  componentWillUnmount() {
    this.stopAnimating();
  },
});

export default function Trips({ trips }) {
  return (
    <g>
      {trips.map(trip => (
        <Trip trip={trip} />
      ))}
    </g>
  );
}
