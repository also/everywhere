import PropTypes from 'prop-types';
import * as React from 'react';
import { findDOMNode } from 'react-dom';
import createReactClass from 'create-react-class';
import d3 from 'd3';

const Trip = createReactClass({
  contextTypes: {
    path: PropTypes.any,
  },

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
    const { path } = this.context;
    const { trip } = this.props;
    return <path className="trip" d={path(trip)} />;
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

export default createReactClass({
  render() {
    const { trips } = this.props;
    return (
      <g>
        {trips.map(trip => (
          <Trip trip={trip} />
        ))}
      </g>
    );
  },
});
