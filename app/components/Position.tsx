import { useEffect, useState } from 'react';

import Dot from './Dot';

export default function Position() {
  const [position, setPosition] = useState<GeolocationPosition>();

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(position =>
      setPosition(position)
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  console.log('Position!');

  if (position) {
    const {
      coords: { latitude, longitude },
    } = position;
    return <Dot position={[longitude, latitude]} r={4} className="position" />;
  } else {
    return null;
  }
}
