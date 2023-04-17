import * as format from '../../format';

import PageTitle from '../PageTitle';
import VideoList from '../VideoList';
import Trips from '../Trips';
import MapComponent, { MapMouseHandler } from '../Map';
import Dot from '../Dot';
import { useCallback, useMemo, useState } from 'react';
import { StravaTripFeature } from '../../trips';
import StandardPage from '../StandardPage';
import { RTreeItem, nearestLineSegmentUsingRtree } from '../../geo';

export default function TripDetails({ trip }: { trip: StravaTripFeature }) {
  const [nearest, setNearest] =
    useState<RTreeItem<unknown> | undefined>(undefined);

  const {
    properties: { tree, id, start, movingTime, videos },
  } = trip;

  const trips = useMemo(() => [trip], [trip]);

  const onMouseMove: MapMouseHandler = useCallback(
    ({ geo }) => setNearest(nearestLineSegmentUsingRtree(tree, geo)?.item),
    [trip]
  );

  let dot = null;
  if (nearest) {
    const { p0: position } = nearest;
    // @ts-expect-error Position isn't a tuple for some reason
    dot = <Dot position={position} r={4} className="position" />;
  }

  return (
    <StandardPage>
      <PageTitle>{id}</PageTitle>
      <p>
        Started <strong>{start.format('LLL')}</strong>,{' '}
        {format.duration(movingTime)} moving
      </p>
      <MapComponent width={500} height={500} onMouseMove={onMouseMove}>
        <Trips trips={trips} />
        {dot}
      </MapComponent>
      <p>
        <a href={`https://strava.com/activities/${id}`}>View on Strava</a>
      </p>

      <h2>Videos</h2>
      <VideoList videos={videos} />
    </StandardPage>
  );
}
