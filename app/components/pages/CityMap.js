import createReactClass from 'create-react-class';
import { useHistory } from 'react-router';

import Position from '../Position';
import Trips from '../Trips';
import MapComponent from '../Map';

export default function CityMap({ trips, tripsLength, waysLength }) {
  const history = useHistory();

  function onClick({ geo }) {
    history.push(`/locations/${geo.join(',')}`);
  }

  return (
    <div>
      <p>
        {Math.round(tripsLength / 1000)} / {Math.round(waysLength / 1000)} km
      </p>

      <MapComponent width="1000" height="1000" onClick={onClick}>
        <Trips trips={trips} />
        <Position />
      </MapComponent>
    </div>
  );
}
