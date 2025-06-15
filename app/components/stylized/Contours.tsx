import { Feature } from 'geojson';
import { useContext } from 'react';
import styled from 'styled-components';

import MapContext from './MapContext';

const ContoursLayer = styled.g`
  path.contour {
    fill: none;
    stroke-width: 1px;
    stroke: #55b7a6;
  }
`;

export default function Contours({ features }: { features: Feature[] }) {
  const { path } = useContext(MapContext);

  return (
    <ContoursLayer>
      {features.map((contour, i) => (
        <path key={i} className="contour" d={path(contour)} />
      ))}
    </ContoursLayer>
  );
}
