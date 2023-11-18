import { positionDistance } from './distance';
import { GoodPosition, interpolateLineRange } from './interpolate-lines';
import * as assert from 'assert';

export default function () {
  const coordinates: GoodPosition[] = [
    [-71.12144222588788, 42.401261839044714],
    [-71.12415743256905, 42.39851676762913],
  ];

  const line = interpolateLineRange(coordinates, 50, positionDistance, 100);

  const expected = [
    { point: [-71.12144222588788, 42.401261839044714], index: 0 },
    { point: [-71.12216054915758, 42.400535614890764], index: 0 },
    { point: [-71.1228788724273, 42.39980939073681], index: 0 },
    { point: [-71.123597195697, 42.39908316658286], index: 0 },
    { point: [-71.12415743256905, 42.39851676762913], index: 1 },
  ];

  assert.deepStrictEqual([...line], expected);
  console.log('ok');
}
