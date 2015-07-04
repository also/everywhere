import * as React from 'react';
import {Link} from 'react-router';


export default React.createClass({
  render() {
    const {way} = this.props;
    const intersections = new Set();

    way.features.forEach(feat => {
      feat.intersections.forEach(intersection => {
        intersection.ways.forEach(iway => intersections.add(iway.properties.name));
      });
    });

    intersections.delete(way.name);

    return (
      <div>
        <h1>{way.name}</h1>
        <p>{way.features.length} features</p>
        <h2>Intersections</h2>
        {Array.from(intersections).sort().map(int => <p><Link key={int} to={`/ways/${int}`}>{int}</Link></p>)}
      </div>
    );
  }
});
