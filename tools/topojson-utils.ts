import {
  GeometryCollection,
  GeometryObject,
  Properties,
  Topology,
} from 'topojson-specification';

// the type of topology used for strava trips
export type SimpleTopology<T extends GeometryObject<any> = GeometryObject> =
  Topology<{ geoJson: T }>;

export type CombinedTrips<P extends Properties = Record<string, any>> =
  Topology<{
    geoJson: GeometryCollection<P>;
  }>;

/**
 * A negative arc index indicates that the arc at the ones’ complement of the index must be reversed to reconstruct the geometry: -1 refers to the reversed first arc, -2 refers to the reversed second arc, and so on. In JavaScript, you can negate a negative arc index i using the [bitwise NOT operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators#Bitwise_NOT), `~i`.
 *
 * https://github.com/topojson/topojson-specification#214-arc-indexes
 */
export function addArcOffset(n: number, offset: number): number {
  return n < 0 ? ~(~n + offset) : n + offset;
}

type PropsOf<T> = T extends GeometryObject<infer P> ? P : never;

export function combineTopologies<
  PropsOut extends Properties,
  T extends GeometryObject<any>,
  P extends PropsOf<T>
>(
  topologies: Iterable<SimpleTopology<T>>,
  transformProps: (input: P) => PropsOut
): CombinedTrips<PropsOut> {
  const result: CombinedTrips<PropsOut> = {
    type: 'Topology',
    arcs: [],
    objects: { geoJson: { type: 'GeometryCollection', geometries: [] } },
  };

  for (const t of topologies) {
    addTopology(result, t, transformProps(t.objects.geoJson.properties));
  }
  return result;
}

export function addTopology<P extends Properties>(
  target: CombinedTrips<P>,
  topology: SimpleTopology<any>,
  props: P
): void {
  const arcStart = target.arcs.length;
  const coll = topology.objects.geoJson;
  let obj: GeometryObject;
  if (coll.type !== 'GeometryCollection') {
    obj = coll;
  } else {
    if (coll.geometries.length !== 1) {
      throw new Error(
        `expected a single geometry, got ${coll.geometries.length}`
      );
    }
    obj = coll.geometries[0];
  }
  if (obj.type === 'MultiLineString') {
    target.objects.geoJson.geometries.push({
      type: 'MultiLineString',
      id: obj.id,
      properties: props,
      arcs: obj.arcs.map((arcs) => arcs.map((i) => addArcOffset(i, arcStart))),
    });
  } else if (obj.type === 'LineString') {
    target.objects.geoJson.geometries.push({
      type: 'LineString',
      id: obj.id,
      properties: props,
      arcs: obj.arcs.map((i) => addArcOffset(i, arcStart)),
    });
  } else if (obj.type === 'Point') {
    target.objects.geoJson.geometries.push({
      type: 'Point',
      id: obj.id,
      properties: props,
      coordinates: obj.coordinates,
    });
  } else {
    throw new Error(`unexpected ${obj.type}`);
  }

  target.arcs.push(...topology.arcs);
}
