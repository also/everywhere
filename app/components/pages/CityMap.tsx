import { useHistory } from 'react-router';

import Position from '../Position';
import Trips from '../Trips';
import MapComponent, { MapMouseEvent } from '../Map';
import { StravaTripFeature } from '../../trips';

export default function CityMap({
  trips,
  tripsLength,
  waysLength,
}: {
  trips: StravaTripFeature[];
  tripsLength: number;
  waysLength: number;
}) {
  const history = useHistory();

  function onClick({ geo }: MapMouseEvent) {
    history.push(`/locations/${geo.join(',')}`);
  }

  return (
    <div>
      <p>
        {Math.round(tripsLength / 1000)} / {Math.round(waysLength / 1000)} km
      </p>

      <MapComponent width={1000} height={1000} onClick={onClick}>
        <Trips trips={trips} />
        <Position />
      </MapComponent>
    </div>
  );
}
