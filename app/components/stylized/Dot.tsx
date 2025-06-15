import { useContext } from 'react';

import MapContext from './MapContext';

export default function Dot({
  position,
  ...extraProps
}: {
  position: [number, number];
} & React.SVGAttributes<SVGCircleElement>) {
  const { projection } = useContext(MapContext);

  if (position) {
    const [x, y] = projection(position);
    return <circle cx={x} cy={y} {...extraProps} />;
  } else {
    return null;
  }
}
