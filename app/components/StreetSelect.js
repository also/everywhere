import * as React from 'react';
import Select from 'react-select';


export default React.createClass({
  render() {
    const {ways, selected} = this.props;

    const byName = new Map();

    const options = ways.map(way => {
      const {name} = way;
      byName.set(name, way);
      const label = name || '(no name)';
      return {label, value: label, name};
    });

    return <Select options={options} onChange={(name, [sel]) => this.props.onChange(sel ? byName.get(sel.name) : null)} value={selected ? selected.name : null}/>;
  }
});
