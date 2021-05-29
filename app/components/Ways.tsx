import { useContext } from 'react';

import { WayFeature } from '../ways';
import MapContext from './MapContext';

function Way({
  feature,
  selected,
}: {
  feature: WayFeature;
  selected?: boolean;
}) {
  const { path } = useContext(MapContext);

  const { highway, id } = feature.properties;
  const className = selected ? 'selected' : '';
  return (
    <path
      d={path(feature)}
      data-highway={highway}
      className={className}
      key={id}
      markerEnd={selected ? 'url(#selected-arrow)' : undefined}
    />
  );
}

export default function Ways({
  features,
  selected,
}: {
  features: WayFeature[];
  selected?: boolean;
}) {
  return (
    <g className="roads">
      {features.map((feature, i) => (
        <Way key={i} feature={feature} selected={selected} />
      ))}
    </g>
  );
}
