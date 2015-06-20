import * as React from 'react';

import StreetList from './street-list';


export default React.createClass({
  getInitialState() {
    return {selected: null, selectedOption: null};
  },

  onChange(selected, [selectedOption]) {
    this.setState({selected, selectedOption});
    const {onSelectionChange} = this.props;
    if (onSelectionChange) {
      onSelectionChange(selectedOption);
    }
  },

  render() {
    const {features} = this.props;
    const {selected, selectedOption} = this.state;

    let info = null;

    if (selectedOption != null) {
      const {features: selectedFeatures} = selectedOption;
      info = <p>{selected}: {selectedFeatures.length} features</p>;
    }

    return (
      <div>
        <StreetList features={features} onChange={this.onChange} selected={selected}/>
        {info}
      </div>
    );
  }
});
