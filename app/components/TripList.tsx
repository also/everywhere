import { Link } from 'react-router-dom';

import Thumbnails from './Thumbnails';
import Thumbnail from './Thumbnail';
import MapComponent from './Map';
import Trips from './Trips';
import { TripFeature } from '../trips';

export default function TripList({ trips }: { trips: TripFeature[] }) {
  return (
    <Thumbnails>
      {trips.map(trip => {
        const {
          properties: { id, start, videos },
        } = trip;
        return (
          <Thumbnail key={id}>
            <Link to={`/trips/${id}`}>
              <MapComponent width={160} height={160} showWays={false}>
                <Trips trips={[trip]} />
              </MapComponent>
              <div>
                <strong>{start.format('LLL')}</strong>
              </div>
              <div className="name">{id}</div>
              <div>
                {videos.length > 0 ? (
                  <img
                    src={videos[0].thumbnail.small}
                    width="160"
                    height="90"
                  />
                ) : null}
              </div>
            </Link>
          </Thumbnail>
        );
      })}
    </Thumbnails>
  );
}
