import { useHistory } from 'react-router';
import { useCallback, useState } from 'react';

import PageTitle from '../PageTitle';
import VideoList from '../VideoList';
import Trips from '../Trips';
import MapComponent from '../Map';
import Dot from '../Dot';
import { Leaf } from '../../tree';
import { CoverageTree, Video } from '../../videos';
import { CoverageFeature } from '../../trips';

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
    useState<Leaf<CoverageFeature> | undefined>(undefined);

  const onMouseMove = useCallback(
    ({ geo }) => setNearest(videoTree.nearest(geo)),
    [videoTree]
  );

  const onClick = useCallback(
    ({ geo }) => {
      const nearest = videoTree.nearest(geo);
      const {
        data: {
          properties: { start, video },
        },
        coordinates: [coord],
      } = nearest;

      const [, , , timeOffsetSecs] = coord;

      const time = +start.clone().add(timeOffsetSecs, 's');
      history.push(`/videos/${video.name}/${time}`);
    },
    [videoTree]
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
    </div>
  );
}
