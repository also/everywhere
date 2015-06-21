import * as React from 'react';

import StreetSelect from './StreetSelect';


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
    const {ways} = this.props;
    const {selected, selectedOption} = this.state;

    let info = null;

    if (selectedOption != null) {
      const {features: selectedFeatures} = selectedOption;
      info = <p>{selected}: {selectedFeatures.length} features</p>;
    }

    return (
      <div>
        <StreetSelect ways={ways} onChange={this.onChange} selected={selected}/>
        {info}
      </div>
    );
  }
});
