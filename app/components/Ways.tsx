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

  const { highway, id, oneway } = feature.properties;
  let start = 'circle';
  let end = 'circle';
  if (oneway === 'yes') {
    end = 'arrow';
  } else if (oneway === '-1') {
    start = 'arrow';
  }
  const className = selected ? 'selected' : '';
  return (
    <path
      d={path(feature)}
      data-highway={highway}
      className={className}
      key={id}
      markerStart={selected ? `url(#selected-${start})` : undefined}
      markerEnd={selected ? `url(#selected-${end})` : undefined}
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
