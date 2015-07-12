import * as React from 'react';
import Select from 'react-select';


export default React.createClass({
  render() {
    const {ways, selected} = this.props;

    const byName = new Map();

    const options = ways.map(way => {
      const {displayName} = way;
      byName.set(displayName, way);
      const label = displayName;
      return {label, value: label, name};
    });

    return <Select options={options} onChange={(name, [sel]) => this.props.onChange(sel ? byName.get(sel.name) : null)} value={selected ? selected.name : null}/>;
  }
});
