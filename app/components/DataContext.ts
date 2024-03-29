import {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
} from 'geojson';
import React from 'react';
import { WayProperties } from '../ways';

export default React.createContext<{
  ways: FeatureCollection<LineString | MultiLineString, WayProperties>;
  boundary: Feature;
  contours: FeatureCollection;
}>(undefined as any);
