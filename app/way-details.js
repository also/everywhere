import * as React from 'react';


export default React.createClass({
  render() {
    const {way} = this.props;
    return <h1>{way.name}</h1>;
  }
});
