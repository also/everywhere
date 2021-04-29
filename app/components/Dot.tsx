import MapContext from './MapContext';

export default function Dot({ position, ...extraProps }) {
  if (position) {
    return (
      <MapContext.Consumer>
        {({ projection }) => {
          const [x, y] = projection(position);
          return <circle cx={x} cy={y} {...extraProps} />;
        }}
      </MapContext.Consumer>
    );
  } else {
    return null;
  }
}
