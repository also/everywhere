import * as React from 'react';
import createReactClass from 'create-react-class';
import { withRouter } from 'react-router';

import * as format from '../../format';
import { findSeekPosition } from '../../videos';
import { featureCollection } from '../../geo';

import PageTitle from '../PageTitle';
import TripList from '../TripList';
import VideoPlayer from '../VideoPlayer';
import MapComponent from '../Map';
import Trips from '../Trips';
import Dot from '../Dot';
import MapBox from '../MapBox';

const VideoAndMap = withRouter(
  createReactClass({
    onClick({ geo }) {
      const { video } = this.props;
      const seekPosition = findSeekPosition(video, geo);
      this.props.history.push(`/videos/${video.name}/${seekPosition}`);
    },

    getInitialState() {
      return { location: null };
    },

    onLocationChange(location) {
      this.setState({ location });
    },

    render() {
      const { video, seek } = this.props;

      return (
        <span>
          <span style={{ display: 'inline-block' }}>
            <VideoPlayer
              video={video}
              seek={seek}
              onLocationChange={this.onLocationChange}
              ref="video"
            />
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
              onClick={this.onClick}
            >
              {this.mapLayers}
            </MapComponent>
          </MapBox>
        </span>
      );
    },

    mapLayers() {
      const { video } = this.props;
      const { location = [0, 0] } = this.state;
      return [
        <Trips trips={video.coverage} />,
        <Dot r={4} className="position" position={location} />,
      ];
    },
  })
);

export default function VideoDetails({ video, seek }) {
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
