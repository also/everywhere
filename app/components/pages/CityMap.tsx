import { useNavigate } from '@tanstack/react-router';

import Position from '../stylized/Position';
import Trips from '../Trips';
import MapComponent, { MapMouseEvent } from '../stylized/Map';
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
  const navigate = useNavigate();
  function onClick({ geo }: MapMouseEvent) {
    navigate({ to: '/locations/$coords', params: { coords: geo.join(',') } });
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
