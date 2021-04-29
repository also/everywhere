import MapContext from './MapContext';

export default function Contours({ features }) {
  return (
    <MapContext.Consumer>
      {({ path }) => (
        <g>
          {features.map((contour, i) => (
            <path key={i} className="contour" d={path(contour)} />
          ))}
        </g>
      )}
    </MapContext.Consumer>
  );
}
