import { positionDistance } from './distance';
import { GoodPosition, interpolateLineRange } from './interpolate-lines';
import * as assert from 'assert';

function test(
  coordinates: GoodPosition[],
  expected?: { point: GoodPosition; index: number }[]
) {
  test2(interpolateLineRange(coordinates, 50, positionDistance, 100), expected);
}

function test2(
  actual: Generator<{ point: GoodPosition; index: number }>,
  expected?: { point: GoodPosition; index: number }[]
) {
  if (expected) {
    const actualArray = [...actual];
    console.log(actualArray);
    assert.deepStrictEqual(actualArray, expected);
  } else {
    console.log(JSON.stringify([...actual]));
  }
}

export default function () {
  // way/9430174
  test(
    [
      [-71.12144222588788, 42.401261839044714],
      [-71.12415743256905, 42.39851676762913],
    ],
    [
      { point: [-71.12144222588788, 42.401261839044714], index: 0 },
      { point: [-71.12216054915758, 42.400535614890764], index: 0 },
      { point: [-71.1228788724273, 42.39980939073681], index: 0 },
      { point: [-71.123597195697, 42.39908316658286], index: 0 },
      { point: [-71.12415743256905, 42.39851676762913], index: 1 },
    ]
  );

  // way/9429413
  test(
    [
      [-71.1175834524288, 42.398901883684175],
      [-71.11742445383938, 42.39912131027368],
      [-71.11721041727667, 42.39941238636179],
      [-71.11708199533905, 42.399560163452676],
      [-71.11695357340142, 42.3996542034196],
      [-71.11683126679416, 42.39973480910554],
      [-71.11672119084763, 42.39977511194851],
      [-71.11664780688326, 42.39978406813584],
      [-71.11659888424036, 42.399793024323166],
      [-71.11648269296347, 42.399797502416824],
      [-71.11643988565092, 42.399793024323166],
      [-71.11636650168657, 42.39978406813584],
      [-71.11626865640076, 42.399766155761185],
      [-71.1162441950793, 42.39976167766752],
      [-71.11618304177568, 42.3997392871992],
      [-71.11593842856117, 42.39964524723228],
    ],
    [
      { point: [-71.1175834524288, 42.398901883684175], index: 0 },
      { point: [-71.11694338039361, 42.3996609210811], index: 4 },
      { point: [-71.11593842856117, 42.39964524723228], index: 15 },
    ]
  );

  // way/46785938
  test(
    [
      [-71.13065802874493, 42.407974501445935],
      [-71.1306457980842, 42.407884939572675],
      [-71.13062133676276, 42.40782224626139],
      [-71.13058464478057, 42.40769685963881],
      [-71.13049291482513, 42.4075401263606],
      [-71.1303828388786, 42.40743265211268],
      [-71.13025441694097, 42.40735652452041],
      [-71.12963065324395, 42.40709231699427],
      [-71.12867666170732, 42.40673406950121],
      [-71.12767986285814, 42.406362387727164],
      [-71.12678702462514, 42.40601757451509],
      [-71.12646902744626, 42.40585188504955],
      [-71.12621829890138, 42.405681717490346],
      [-71.12604095432086, 42.40553841849312],
      [-71.12583914841888, 42.40543542233887],
      [-71.12546611326674, 42.405260776686],
      [-71.12468946631063, 42.40495178822324],
      [-71.12401066464034, 42.40467414641611],
      [-71.12348474622912, 42.40445919792028],
      [-71.12309948041624, 42.404293508454735],
      [-71.12256744667467, 42.40405616949059],
      [-71.12223721883507, 42.403894958118705],
      [-71.12212714288853, 42.40384122099475],
      [-71.1217174157542, 42.40363522868624],
      [-71.12134438060207, 42.40341132400307],
      [-71.12106919073572, 42.40318741931991],
      [-71.12068392492286, 42.40285604038883],
      [-71.1203292357618, 42.40260526714369],
      [-71.12009073787765, 42.40245301195914],
      [-71.12007239188655, 42.402448533865474],
      [-71.11968712607369, 42.40227388821261],
      [-71.11924682228755, 42.402108198747065],
      [-71.11875148052815, 42.401982812124494],
      [-71.11834175339382, 42.40187981597024],
      [-71.1179320262595, 42.4017141265047],
      [-71.11752229912518, 42.401476787540545],
      [-71.11738164652682, 42.40136931329263],
      [-71.11722876326776, 42.40126631713838],
    ],
    [
      { point: [-71.13065802874493, 42.407974501445935], index: 0 },
      { point: [-71.13003274670854, 42.40726263168245], index: 6 },
      { point: [-71.12895820260647, 42.40683979509462], index: 7 },
      { point: [-71.12787140438817, 42.40643380885264], index: 8 },
      { point: [-71.12679075063852, 42.40601901349764], index: 9 },
      { point: [-71.12585907121569, 42.40544559038367], index: 13 },
      { point: [-71.12480407106023, 42.40499738364485], index: 15 },
      { point: [-71.1237378930788, 42.404562661753076], index: 17 },
      { point: [-71.12268628996074, 42.4041091851928], index: 19 },
      { point: [-71.12167430330467, 42.40360935155563], index: 23 },
      { point: [-71.12081954397297, 42.40297269048952], index: 25 },
      { point: [-71.11991554576174, 42.40237743362], index: 29 },
      { point: [-71.1188157688095, 42.40199908551618], index: 31 },
      { point: [-71.11773535982178, 42.40160020530031], index: 34 },
      { point: [-71.11722876326776, 42.40126631713838], index: 37 },
    ]
  );

  test2(
    interpolateLineRange(
      [
        [0, 0],
        [3, 0],
      ],
      50,
      undefined,
      1
    ),
    [
      { point: [0, 0], index: 0 },
      { point: [1, 0], index: 0 },
      { point: [2, 0], index: 0 },
      { point: [3, 0], index: 1 },
    ]
  );

  test2(
    interpolateLineRange(
      [
        [0, 0],
        [2, 0],
        [3, 0],
      ],
      50,
      undefined,
      1
    ),
    [
      { point: [0, 0], index: 0 },
      { point: [1, 0], index: 0 },
      { point: [2, 0], index: 0 },
      { point: [3, 0], index: 2 },
    ]
  );

  test2(
    interpolateLineRange(
      [
        [0, 0],
        [2, 0],
        [2.5, 0],
        [3, 0],
      ],
      50,
      undefined,
      1
    ),
    [
      { point: [0, 0], index: 0 },
      { point: [1, 0], index: 0 },
      { point: [2, 0], index: 0 },
      { point: [3, 0], index: 3 },
    ]
  );
}
