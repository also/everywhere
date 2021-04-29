import d3 from 'd3';
import React from 'react';

export default React.createContext<{
  projection: d3.geo.Projection;
  path: d3.geo.Path;
}>(undefined as any);
