import { GeometryObject, Topology } from 'topojson-specification';

// the type of topolojy used for strava trips
export type SimpleTopology<T extends GeometryObject = GeometryObject> =
  Topology<{ geoJson: T }>;

/**
 * A negative arc index indicates that the arc at the ones’ complement of the index must be reversed to reconstruct the geometry: -1 refers to the reversed first arc, -2 refers to the reversed second arc, and so on. In JavaScript, you can negate a negative arc index i using the [bitwise NOT operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators#Bitwise_NOT), `~i`.
 *
 * https://github.com/topojson/topojson-specification#214-arc-indexes
 */
export function addArcOffset(n: number, offset: number): number {
  return n < 0 ? ~(~n + offset) : n + offset;
}

export function combineTolologies(
  topologies: Iterable<SimpleTopology>
): SimpleTopology<TopoJSON.GeometryCollection> {
  const result: SimpleTopology<TopoJSON.GeometryCollection> = {
    type: 'Topology',
    arcs: [],
    objects: { geoJson: { type: 'GeometryCollection', geometries: [] } },
  };

  for (const t of topologies) {
    addTopology(result, t);
  }
  return result;
}

export function addTopology(
  target: SimpleTopology<TopoJSON.GeometryCollection>,
  toploogy: SimpleTopology
) {
  const arcStart = target.arcs.length;
  const coll = toploogy.objects.geoJson;
  let obj: GeometryObject;
  if (coll.type !== 'GeometryCollection') {
    obj = coll;
  } else {
    if (coll.geometries.length !== 1) {
      throw new Error('expected a single geometry');
    }
    obj = coll.geometries[0];
  }
  if (obj.type === 'MultiLineString') {
    target.objects.geoJson.geometries.push({
      type: 'MultiLineString',
      id: obj.id,
      arcs: obj.arcs.map((arcs) => arcs.map((i) => addArcOffset(i, arcStart))),
    });
  } else if (obj.type === 'LineString') {
    target.objects.geoJson.geometries.push({
      type: 'LineString',
      id: obj.id,
      arcs: obj.arcs.map((i) => addArcOffset(i, arcStart)),
    });
  } else {
    throw new Error(`unxpected ${obj.type}`);
  }

  target.arcs.push(...toploogy.arcs);
}
