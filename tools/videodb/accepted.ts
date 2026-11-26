// Problems that have been looked at and accepted for specific files. The run
// records them in the file's meta (acceptedProblems) instead of stopping.
export type Accepted = {
  fileId: string;
  // substring of the problem message
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
];
