// Problems that have been looked at and accepted for specific files. The run
// records them in the file's meta (acceptedProblems) instead of stopping.
export type Accepted = {
  fileId: string;
  // substring of the problem message; '' accepts all of the file's problems
  match: string;
  reason: string;
};

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
];
