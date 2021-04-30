import moment from 'moment';

export function duration(d: moment.Duration) {
  return `${Math.floor(d.asHours())}:${moment
    .utc(d.asMilliseconds())
    .format('mm:ss')}`;
}
