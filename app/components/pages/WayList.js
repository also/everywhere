import * as React from 'react';
import createReactClass from 'create-react-class';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import { Link } from 'react-router-dom';
import { withRouter } from 'react-router';
import styled from 'styled-components';

import MapComponent from '../Map';
import Ways from '../Ways';

const WayList = createReactClass({
  mixins: [PureRenderMixin],

  render() {
    const { groupedWays } = this.props;

    return (
      <ul style={{ WebkitColumnWidth: '200px' }}>
        {groupedWays.map(way => (
          <li key={way.displayName}>
            <Link to={`/ways/${way.displayName}`}>{way.displayName}</Link>
          </li>
        ))}
      </ul>
    );
  },
});

const WayMap = styled.div`
  position: relative;
  display: inline-block;
`;

const WayHoverInfo = styled.div`
  position: absolute;
  // just kinda inside somerville
  top: 350px;
  left: 400px;

  padding: 0.4em;
  background: #eee;
  box-shadow: 3px 3px 0 0 #dfdfdf;
  font-weight: bold;
`;

export default withRouter(
  createReactClass({
    mixins: [PureRenderMixin],

    getInitialState() {
      return { hoveredStreet: null };
    },

    onMouseMove({ geo }) {
      const { wayTree } = this.props;
      const leaf = wayTree.nearest(geo);
      this.setState({ hoveredStreet: leaf.data.feature });
    },

    onClick({ geo }) {
      const { wayTree } = this.props;
      const leaf = wayTree.nearest(geo);
      const way = leaf.data.feature;
      this.props.history.push(`/ways/${way.properties.displayName}`);
    },

    render() {
      const { groupedWays } = this.props;
      const { hoveredStreet } = this.state;

      return (
        <div>
          <h1>Streets</h1>
          <WayMap>
            <WayHoverInfo>
              {hoveredStreet
                ? hoveredStreet.properties.displayName
                : '(hover over a street)'}
            </WayHoverInfo>
            <MapComponent
              width="1000"
              height="1000"
              onMouseMove={this.onMouseMove}
              onClick={this.onClick}
            >
              {this.mapLayers}
            </MapComponent>
          </WayMap>
          <WayList groupedWays={groupedWays} />
        </div>
      );
    },

    mapLayers() {
      const { hoveredStreet } = this.state;
      return hoveredStreet ? (
        <Ways features={[hoveredStreet]} selected={true} />
      ) : null;
    },
  })
);
