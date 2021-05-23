const MS_PER_MINUTE = 1000 * 60;
const MS_PER_HOUR = MS_PER_MINUTE * 60;

export function duration(d: number) {
  const hours = Math.floor(d / MS_PER_HOUR);
  const remainingMinutes = d % MS_PER_HOUR;
  const minutes = Math.floor(remainingMinutes / MS_PER_MINUTE);
  const remainingSeconds = remainingMinutes % MS_PER_MINUTE;
  const seconds = Math.floor(remainingSeconds / 1000);
  return [hours, minutes, seconds]
    .map((n) => n.toString().padStart(2, '0'))
    .join(':');
}
