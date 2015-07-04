import * as React from 'react';

import StreetSelect from './StreetSelect';


export default React.createClass({
  getInitialState() {
    return {selected: null, selectedOption: null};
  },

  onChange(selected) {
    this.setState({selected});
    const {onSelectionChange} = this.props;
    if (onSelectionChange) {
      onSelectionChange(selected);
    }
  },

  render() {
    const {ways} = this.props;
    const {selected} = this.state;

    let info = null;

    if (selected != null) {
      const {features: selectedFeatures} = selected;
      info = <p>{selected.name}: {selectedFeatures.length} features</p>;
    }

    return (
      <div>
        <StreetSelect ways={ways} onChange={this.onChange} selected={selected}/>
        {info}
      </div>
    );
  }
});
