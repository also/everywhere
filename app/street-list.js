import * as React from 'react';
import Select from 'react-select';


export default React.createClass({
  render() {
    const {features, selected} = this.props;

    const streets = new Map();

    const options = [];

    features.forEach(feature => {
      const {properties: {id, name}} = feature;
      let streetFeatures = streets.get(name);
      if (!streetFeatures) {
        streetFeatures = [];
        streets.set(name, streetFeatures);
        const label = name || '(no name)';
        options.push({value: label, label, features: streetFeatures});
      }
      streetFeatures.push(id);
    });

    options.sort(({label: a}, {label: b}) => a === b ? 0 : a > b ? 1 : -1);

    return <Select options={options} onChange={this.props.onChange} value={selected}/>;
  }
});
