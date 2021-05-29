import { useState } from 'react';
import { useHistory } from 'react-router';
import { useInView } from 'react-intersection-observer';

import * as format from '../../format';
import { findSeekPosition, Video } from '../../videos';
import { featureCollection } from '../../geo';
import { Still } from '../../videos';

import PageTitle from '../PageTitle';
import TripList from '../TripList';
import VideoPlayer from '../VideoPlayer';
import MapComponent from '../Map';
import Trips from '../Trips';
import Dot from '../Dot';
import MapBox from '../MapBox';
import moment from 'moment';

function VideoAndMap({ video, seek }: { video: Video; seek: number }) {
  const history = useHistory();
  const [location, setLocation] = useState<[number, number] | undefined>();
  const [time, setTime] = useState<moment.Moment | undefined>();

  function onClick({ geo }: { geo: [number, number] }) {
    history.push(`/videos/${video.name}/${findSeekPosition(video, geo)}`);
  }

  return (
    <span>
      <span style={{ display: 'inline-block' }}>
        <VideoPlayer
          video={video}
          seek={seek}
          onLocationChange={(loc, time) => {
            setLocation(loc);
            setTime(time);
          }}
        />
        <p>{time ? time.format('LTS') : '--:--'}</p>
      </span>
      <MapBox
        style={{
          display: 'inline-block',
          verticalAlign: 'top',
          marginLeft: '1em',
        }}
      >
        <MapComponent
          width={360}
          height={360}
          zoomFeature={featureCollection(video.coverage)}
          onClick={onClick}
        >
          <Trips trips={video.coverage} />
          {location ? (
            <Dot r={4} className="position" position={location} />
          ) : null}
        </MapComponent>
      </MapBox>
    </span>
  );
}

function StillImage({ still: { small, large } }: { still: Still }) {
  const { ref, inView } = useInView({ threshold: 0.9, triggerOnce: true });
  return (
    <a href={large} ref={ref}>
      <img src={inView ? small : undefined} width="320" height="180" />
    </a>
  );
}

export default function VideoDetails({
  video,
  seek,
}: {
  video: Video;
  seek: number;
}) {
  return (
    <div>
      <PageTitle>{video.name}</PageTitle>
      <p>
        Taken <strong>{video.start.format('LLL')}</strong>,{' '}
        {format.duration(video.duration)} long
      </p>
      <VideoAndMap video={video} seek={seek} />
      <h2>Trips</h2>
      <TripList trips={video.trips} />
      <h2>Stills</h2>
      <div>
        {video.stills.map((still, i) => (
          <StillImage still={still} key={i} />
        ))}
      </div>
    </div>
  );
}
