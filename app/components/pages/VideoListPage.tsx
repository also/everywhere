import { useHistory } from 'react-router';
import { useCallback, useState } from 'react';

import PageTitle from '../PageTitle';
import VideoList from '../VideoList';
import Trips from '../Trips';
import MapComponent, { MapMouseHandler } from '../Map';
import Dot from '../Dot';
import { CoverageTree, Video } from '../../videos';
import { CoverageFeature } from '../../trips';
import StandardPage from '../StandardPage';
import { RTreeItem, nearestLineSegmentUsingRtree } from '../../geo';

export default function VideoListPage({
  videos,
  videoTree,
  videoCoverage,
}: {
  videos: Video[];
  videoCoverage: CoverageFeature[];
  videoTree: CoverageTree;
}) {
  const history = useHistory();
  const [nearest, setNearest] =
    useState<RTreeItem<CoverageFeature> | undefined>(undefined);

  const onMouseMove: MapMouseHandler = useCallback(
    ({ geo }) => setNearest(nearestLineSegmentUsingRtree(videoTree, geo)?.item),
    [videoTree]
  );

  const onClick: MapMouseHandler = useCallback(
    ({ geo }) => {
      const nearest = nearestLineSegmentUsingRtree(videoTree, geo)!.item;
      const {
        data: {
          properties: { start, video },
        },
        p0: coord,
      } = nearest;

      const [, , , timeOffsetSecs] = coord;

      const time = +start.clone().add(timeOffsetSecs, 's');
      history.push(`/videos/${video.name}/${time}`);
    },
    [videoTree]
  );

  let dot = null;
  if (nearest) {
    const { p0: position } = nearest;
    // @ts-expect-error Position isn't a tuple for some reason
    dot = <Dot position={position} r={4} className="position" />;
  }

  return (
    <StandardPage>
      <PageTitle>Videos</PageTitle>
      <MapComponent
        width={1000}
        height={1000}
        onMouseMove={onMouseMove}
        onClick={onClick}
      >
        <Trips trips={videoCoverage} />
        {dot}
      </MapComponent>
      <VideoList videos={videos} />
    </StandardPage>
  );
}
