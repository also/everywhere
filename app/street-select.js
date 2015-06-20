import * as React from 'react';
import Select from 'react-select';


export default React.createClass({
  render() {
    const {ways, selected} = this.props;

    const options = ways.map(({name, features}) => {
      const label = name || '(no name)';
      return {label, value: label, features};
    });

    return <Select options={options} onChange={this.props.onChange} value={selected}/>;
  }
});
