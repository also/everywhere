import * as format from '../../format';
import { waysById } from '../../ways';

import PageTitle from '../PageTitle';
import VideoList from '../VideoList';
import Trips from '../Trips';
import MapComponent from '../Map';
import Dot from '../Dot';
import { useCallback, useMemo, useState } from 'react';

export default function TripDetails({ trip }) {
  const [state, setState] = useState({ nearest: null });

  const {
    properties: { tree, id, start, movingTime, videos },
  } = trip;

  const trips = useMemo(() => [trip], [trip]);

  const onMouseMove = useCallback(
    ({ geo }) => {
      const nearest = tree.nearest(geo);
      const coord = nearest.coordinates[0];
      const wayId = coord[coord.length - 1][0];
      const way = waysById.get(wayId);
      setState({ nearest, way });
    },
    [trip]
  );

  const { nearest } = state;

  let dot = null;
  if (nearest) {
    const {
      coordinates: [position],
    } = nearest;
    dot = <Dot position={position} r={4} className="position" />;
  }

  return (
    <div>
      <PageTitle>{id}</PageTitle>
      <p>
        Started <strong>{start.format('LLL')}</strong>,{' '}
        {format.duration(movingTime)} moving
      </p>
      <MapComponent width="500" height="500" onMouseMove={onMouseMove}>
        <Trips trips={trips} />
        {dot}
      </MapComponent>

      <h2>Videos</h2>
      <VideoList videos={videos} />
    </div>
  );
}
