import { Link } from 'react-router-dom';

import Thumbnails from './Thumbnails';
import Thumbnail from './Thumbnail';
import * as format from '../format';
import { Video } from '../videos';

export default function VideoList({ videos }: { videos: Video[] }) {
  return (
    <Thumbnails>
      {videos.map(({ name, duration, start, thumbnail }) => (
        <Thumbnail key={name}>
          <Link to={`/videos/${name}`}>
            <div>
              <img src={thumbnail.small} width="160" height="90" />
            </div>
            <div>
              <strong>{start.format('LLL')}</strong>
            </div>
            <div>
              {format.duration(duration)} <span className="name">{name}</span>
            </div>
          </Link>
        </Thumbnail>
      ))}
    </Thumbnails>
  );
}
