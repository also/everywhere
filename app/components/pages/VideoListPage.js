import * as React from 'react';
import createReactClass from 'create-react-class';
import { withRouter } from 'react-router';

import PageTitle from '../PageTitle';
import VideoList from '../VideoList';
import Trips from '../Trips';
import MapComponent from '../Map';
import Dot from '../Dot';

export default withRouter(
  createReactClass({
    getInitialState() {
      return { nearest: null };
    },

    onMouseMove({ geo }) {
      const { videoTree } = this.props;
      const nearest = videoTree.nearest(geo);
      this.setState({ nearest });
    },

    onClick({ geo }) {
      const { videoTree } = this.props;
      const nearest = videoTree.nearest(geo);
      const {
        data: {
          feature: {
            properties: { start, video },
          },
        },
        coordinates: [coord],
      } = nearest;
      const [, , , timeOffsetSecs] = coord;
      const time = +start.clone().add(timeOffsetSecs, 's');
      this.props.history.push(`/videos/${video.name}/${time}`);
    },

    render() {
      const { videos } = this.props;

      return (
        <div>
          <PageTitle>Videos</PageTitle>
          <MapComponent
            width="1000"
            height="1000"
            onMouseMove={this.onMouseMove}
            onClick={this.onClick}
          >
            {this.mapLayers}
          </MapComponent>
          <VideoList videos={videos} />
        </div>
      );
    },

    mapLayers() {
      const { nearest } = this.state;

      let dot = null;
      if (nearest) {
        const {
          coordinates: [position],
        } = nearest;
        dot = <Dot position={position} r={4} className="position" />;
      }

      const { videoCoverage } = this.props;
      return [<Trips trips={videoCoverage} />, dot];
    },
  })
);
