import { useContext } from 'react';

import MapContext from './MapContext';

export default function Contours({ features }) {
  const { path } = useContext(MapContext);

  return (
    <g>
      {features.map((contour, i) => (
        <path key={i} className="contour" d={path(contour)} />
      ))}
    </g>
  );
}
