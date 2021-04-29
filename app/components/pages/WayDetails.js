import * as React from 'react';
import createReactClass from 'create-react-class';
import { Link } from 'react-router-dom';

import { featureCollection } from '../../geo';

import PageTitle from '../PageTitle';
import MapComponent from '../Map';
import Ways from '../Ways';
import WayListColumns from '../WayListColumns';
import MapBox from '../MapBox';

export default createReactClass({
  render() {
    const { way } = this.props;
    const intersections = new Set();

    way.features.forEach(feat => {
      feat.intersections.forEach(intersection => {
        intersection.ways.forEach(iway =>
          intersections.add(iway.properties.displayName)
        );
      });
    });

    intersections.delete(way.displayName);

    return (
      <div>
        <PageTitle>{way.displayName}</PageTitle>
        <MapBox>
          <MapComponent
            width={400}
            height={400}
            zoomFeature={featureCollection(way.features)}
            zoom={0.7}
          >
            {this.mapLayers}
          </MapComponent>
        </MapBox>
        <h2>Intersections</h2>
        <WayListColumns>
          {Array.from(intersections)
            .sort()
            .map(int => (
              <li>
                <Link key={int} to={`/ways/${int}`}>
                  {int}
                </Link>
              </li>
            ))}
        </WayListColumns>
      </div>
    );
  },

  mapLayers() {
    const { way } = this.props;
    return <Ways features={way.features} selected={true} />;
  },
});
