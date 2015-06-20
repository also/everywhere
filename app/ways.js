import * as React from 'react';


const Way = React.createClass({
  render() {
    const {feature, path, selectedStreetName} = this.props;
    const {highway, name, id} = feature.properties;
    const className = name && name === selectedStreetName ? 'selected' : '';
    return <path d={path(feature)} data-highway={highway} className={className} key={id}/>;
  }
});

export default React.createClass({
  render() {
    const {features, path, selectedStreetName} = this.props;
    return (
      <g className="roads">
        {features.map(feature => <Way feature={feature} path={path} selectedStreetName={selectedStreetName}/>)}
      </g>
    );
  }
});
