export const streamNames = [
  'latlng',
  'altitude',
  'time',
  'distance',
  'velocity_smooth',
  'heartrate',
  'cadence',
  'watts',
  'temp',
  'moving',
  'grade_smooth',
] as const;

export const otherStreamNames = streamNames.slice(1);

export type ActivityType =
  | 'AlpineSki'
  | 'BackcountrySki'
  | 'Canoeing'
  | 'Crossfit'
  | 'EBikeRide'
  | 'Elliptical'
  | 'Golf'
  | 'Handcycle'
  | 'Hike'
  | 'IceSkate'
  | 'InlineSkate'
  | 'Kayaking'
  | 'Kitesurf'
  | 'NordicSki'
  | 'Ride'
  | 'RockClimbing'
  | 'RollerSki'
  | 'Rowing'
  | 'Run'
  | 'Sail'
  | 'Skateboard'
  | 'Snowboard'
  | 'Snowshoe'
  | 'Soccer'
  | 'StairStepper'
  | 'StandUpPaddling'
  | 'Surfing'
  | 'Swim'
  | 'Velomobile'
  | 'VirtualRide'
  | 'VirtualRun'
  | 'Walk'
  | 'WeightTraining'
  | 'Wheelchair'
  | 'Windsurf'
  | 'Workout'
  | 'Yoga';

export type Activity = {
  id: string;
  type: ActivityType;
  name: string;
  start_date: string;
  elapsed_time: number;
  moving_time: number;
};

export type StravaCoord = [number, number, ...any];

type LatLngStrm = { type: 'latlng'; data: [number, number][] };
type AltitudeStream = { type: 'altitude'; data: number[] };
type TimeStream = {
  type: 'time';
  /** The sequence of time values for this stream, in seconds */
  data: number[];
};
type DistanceStream = {
  type: 'distance';
  /** The sequence of distance values for this stream, in meters */
  data: number[];
};
type SmoothVelocityStream = {
  type: 'velocity_smooth';
  /** The sequence of velocity values for this stream, in meters per second*/
  data: number[];
};
type HeartrateStream = {
  type: 'heartrate';
  /** The sequence of heart rate values for this stream, in beats per minute */
  data: number[];
};

type CadenceStream = {
  type: 'cadence';
  /** The sequence of cadence values for this stream, in rotations per minute */
  data: number[];
};

type PowerStream = {
  type: 'watts';
  /** The sequence of power values for this stream, in watts */
  data: number[];
};

type TemperatureStream = {
  type: 'temp';
  /** The sequence of temperature values for this stream, in celsius degrees */
  data: number[];
};

type MovingStream = {
  type: 'moving';
  /** The sequence of moving values for this stream, as boolean values */
  data: boolean[];
};

type SmoothGradeStream = {
  type: 'grade_smooth';
  /** The sequence of velocity values for this stream, in meters per second */
  data: number[];
};

export type Stream =
  | LatLngStrm
  | AltitudeStream
  | TimeStream
  | DistanceStream
  | SmoothVelocityStream
  | HeartrateStream
  | CadenceStream
  | PowerStream
  | TemperatureStream
  | MovingStream
  | SmoothGradeStream;

type SBT = {
  [K in Stream['type']]?: Extract<Stream, { type: K }>['data'];
};

export type StreamsByType = {
  activity: Activity;
} & SBT;

export type SummaryActivity = {
  id: string;
  type: ActivityType;
  name: string;
  manual: boolean;
};
