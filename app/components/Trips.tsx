import { useRef, useEffect, useContext, memo } from 'react';
import d3 from 'd3';

import MapContext from './MapContext';
import { StravaTripFeature } from '../trips';

function AnimTrip({ trip }: { trip: StravaTripFeature }) {
  const { path } = useContext(MapContext);
  const ref = useRef<SVGPathElement>(null);
  const running = useRef(true);
  useEffect(() => {
    const duration = 7000;
    const node = ref.current!;
    const length = node.getTotalLength();
    const ease = d3.ease('linear');
    d3.timer((elapsed) => {
      const t = elapsed / duration;

      const e = ease(t);
      const l = e * length;

      node.setAttribute('stroke-dasharray', `${l},${length}`);

      if (t > 1) {
        running.current = false;
      }
      return !running.current;
    });

    return () => {
      running.current = false;
    };
  }, []);

  return <path className="trip" d={path(trip)} ref={ref} />;
}

function Trip({ trip }: { trip: StravaTripFeature }) {
  const { path } = useContext(MapContext);

  return <path className="trip" d={path(trip)} />;
}

export default memo(function Trips({ trips }: { trips: StravaTripFeature[] }) {
  return (
    <g>
      {trips.map((trip) => (
        <Trip trip={trip} />
      ))}
    </g>
  );
});
