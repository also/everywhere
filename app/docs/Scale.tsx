import { color } from '../tile-drawing';

export default function Scale() {
  return (
    <span>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            marginRight: 1,
            minWidth: '2em',
            textAlign: 'center',
            padding: '0.25em 0.5em',
            fontWeight: 'bold',
            backgroundColor: color(i * 50)
              .replace('rgb', 'rgba')
              .replace(')', ', 0.5)'),
          }}
        >
          {i * 50}
        </span>
      ))}
    </span>
  );
}
