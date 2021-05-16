import * as format from '../../format';

import PageTitle from '../PageTitle';
import VideoList from '../VideoList';
import Trips from '../Trips';
import MapComponent from '../Map';
import Dot from '../Dot';
import { useCallback, useMemo, useState } from 'react';
import { TripFeature } from '../../trips';
import { Leaf } from '../../tree';

export default function TripDetails({ trip }: { trip: TripFeature }) {
  const [nearest, setNearest] = useState<Leaf<unknown> | undefined>(undefined);

  const {
    properties: { tree, id, start, movingTime, videos },
  } = trip;

  const trips = useMemo(() => [trip], [trip]);

  const onMouseMove = useCallback(
    ({ geo }) => setNearest(tree.nearest(geo)),
    [trip]
  );

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
