import { Feature } from 'geojson';
import { useContext } from 'react';

import MapContext from './MapContext';

export default function Contours({ features }: { features: Feature[] }) {
  const { path } = useContext(MapContext);

  return (
    <g>
      {features.map((contour, i) => (
        <path key={i} className="contour" d={path(contour)} />
      ))}
    </g>
  );
}
