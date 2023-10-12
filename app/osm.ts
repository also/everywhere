export const highwayLevels = Object.fromEntries(
  ([] as [string, number][]).concat(
    ...Object.entries({
      motorway: 3,
      trunk: 5,
      primary: 10,
      secondary: 11,
      tertiary: 11,
      unclassified: 11,
      residential: 12,
    }).map(
      ([k, v]) =>
        [
          [k, v],
          [`${k}_link`, Math.max(12, v)],
        ] as [string, number][]
    )
  )
);

export function shouldShowHighwayAtZoom(highway: string, z: number): boolean {
  const level = highwayLevels[highway];
  return level != null && level < z;
}
