import { useState } from 'react';
import { useHistory } from 'react-router';

import * as format from '../../format';
import { findSeekPosition, Video } from '../../videos';
import { featureCollection } from '../../geo';

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
        {video.stills.map(({ small, large }, i) => (
          <a href={large} key={i}>
            <img src={large} width="320" />
          </a>
        ))}
      </div>
    </div>
  );
}
