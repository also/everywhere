// Problems that have been looked at and accepted for specific files. The run
// records them in the file's meta (acceptedProblems) instead of stopping.
export type Accepted = {
  fileId: string;
  // substring of the problem message; '' accepts all of the file's problems
  match: string;
  reason: string;
};

// HERO5 and HERO7 recordings of 0.2 to 1.8s (MP4 and LRV) with no gpmd
// track. Others of 1.2s and up do have one, so there's no clean cut-off;
// each was looked at. Same as the HERO7 GL010619.LRV case below.
const SHORT_WITHOUT_GPMD: [string, string][] = [
  ['f1_60de8befd3da58ac4dacfa8ff265c3cc', 'GOPR0680.MP4'], // greece/DCIM/100GOPRO
  ['f1_7a5335329acffa356d3d226a7f6c3414', 'GOPR0680.LRV'], // greece/DCIM/100GOPRO
  ['f1_cebbf1bd3785a8824ca45f65355646fb', 'GOPR2852.MP4'], // kate nz and panama/DCIM/101GOPRO
  ['f1_1c96d1accb6d723f5b4e45caa9b028ea', 'GOPR2852.LRV'], // kate nz and panama/DCIM/101GOPRO
  ['f1_9187f1e0762655e2e6809222e488d51d', 'GOPR2911.MP4'], // kate nz and panama/DCIM/101GOPRO
  ['f1_9bfd5b81b3d1622f1483daebcf5ff760', 'GOPR2911.LRV'], // kate nz and panama/DCIM/101GOPRO
  ['f1_d3c972bc0ac3d9f091a824acec3feeb3', 'GH010003.MP4'], // nz trip/snorkel
  ['f1_27bac2fe0d4a7ea4510205fc872fa259', 'GH010013.MP4'], // nz trip/gopro seal vids
  ['f1_2a75507e7a6e804ed91450927121d4fa', 'GH010232.MP4'], // panama/gopro/DCIM/100GOPRO
  ['f1_681f050361966bf8bf49cc0f93044023', 'GL010232.LRV'], // panama/gopro/DCIM/100GOPRO
  ['f1_8444416469cf6a189cdc6122d19c46a3', 'GH010262.MP4'], // panama/gopro/DCIM/100GOPRO
  ['f1_6aaa076c809887e91465fad288e94afe', 'GL010262.LRV'], // panama/gopro/DCIM/100GOPRO
  ['f1_acebe158e4a1df67ab817e23692244bc', 'GH010282.MP4'], // panama/gopro/DCIM/100GOPRO
  ['f1_749518400414e40668257d2caa15f0ed', 'GL010282.LRV'], // panama/gopro/DCIM/100GOPRO
];

export const ACCEPTED: Accepted[] = [
  {
    // HERO13 recording 2370, last chapter: every track is ~12s shorter than
    // in its LRV (625.6s vs 637.9s); the next recording's last chapter matches
    // exactly. The recording probably ended abnormally. IDs and links are fine.
    fileId: 'f1_d82a66e80847cb789de9420f723c9238', // GX042370.MP4
    match: 'differs from proxy',
    reason:
      'last chapter shorter than its LRV; recording likely ended abnormally',
  },
  {
    // HERO9 recording 0122 was cut off: the MP4 (renamed GH010122.MP4-broken)
    // is ftyp + mdat with no moov. Its 11s LRV was finalized, but every value
    // in its udta GPMF block is written twice. Link key and IDs are fine.
    fileId: 'f1_998528404077561520b1d778e3dd8ba6', // GL010122.LRV
    match: 'GPMF model name',
    reason: 'proxy of an interrupted recording; udta GPMF values doubled',
  },
  // HERO7 GL010619.LRV is a 1.9s recording (its MP4 isn't in the folder) with
  // no gpmd telemetry track; probably too short for any telemetry.
  {
    fileId: 'f1_9ce1eff8c35c2ab24e5afbc95f597eee',
    match: 'track signature',
    reason: '1.9s recording without a telemetry track',
  },
  {
    fileId: 'f1_9ce1eff8c35c2ab24e5afbc95f597eee',
    match: 'gpmd track missing',
    reason: '1.9s recording without a telemetry track',
  },
  // MAX recording 0035 (florida 2021) is 1.1s: 33 frames per lens and 34 GPMF
  // samples, but no audio tracks in the .360 or the LRV. The other 31 MAX
  // recordings all have audio; probably stopped before audio started.
  {
    fileId: 'f1_f69f13665e39968c67a8222ba4248d98', // GS010035.360
    match: 'track signature',
    reason: '1.1s recording without audio tracks',
  },
  {
    fileId: 'f1_caf7ede2c79d09e33f4073b8d92a0361', // GS010035.LRV
    match: 'track signature',
    reason: '1.1s recording without audio tracks',
  },
  ...SHORT_WITHOUT_GPMD.flatMap(([fileId]) =>
    ['track signature', 'gpmd track missing'].map((match) => ({
      fileId,
      match,
      reason: 'recording under 2s without a telemetry track',
    }))
  ),
];
