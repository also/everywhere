import {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Polygon,
} from 'geojson';
import React from 'react';
import { WayProperties } from '../ways';

export default React.createContext<{
  ways: FeatureCollection<LineString | MultiLineString, WayProperties>;
  boundary: Feature<Polygon>;
  contours: FeatureCollection;
}>(undefined as any);
