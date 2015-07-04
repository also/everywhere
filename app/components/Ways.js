import * as React from 'react/addons';


const Way = React.createClass({
  contextTypes: {
    path: React.PropTypes.any
  },

  render() {
    const {path} = this.context;
    const {feature, selected} = this.props;
    const {highway, name, id} = feature.properties;
    const className = selected ? 'selected' : '';
    return <path d={path(feature)} data-highway={highway} className={className} key={id}/>;
  }
});

const BaseWays = React.createClass({
  mixins: [React.addons.PureRenderMixin],

  render() {
    const {features} = this.props;
    return <g>{features.map((feature, i) => <Way key={i} feature={feature}/>)}</g>;
  }
});

export default React.createClass({
  render() {
    const {features, selectedStreetName} = this.props;
    const selectedWays = features.filter(({properties: {name}}) => name && name === selectedStreetName);
    return (
      <g className="roads">
        <BaseWays features={features} />
        {selectedWays.map(feature => <Way feature={feature} selected={true}/>)}
      </g>
    );
  }
});
