import moment from 'moment';

export function duration(d) {
  return `${Math.floor(d.asHours())}:${moment.utc(d.asMilliseconds()).format('mm:ss')}`;
}
