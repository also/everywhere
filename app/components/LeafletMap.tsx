import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';

export default function LeafletMap({
  features = [],
  customize,
}: {
  features?: GeoJSON.Feature[];
  customize?(map: L.Map): void;
}) {
  const mapComponent = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map>();

  const tiles = useMemo(
    () =>
      L.tileLayer(
        'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}',
        {
          attribution:
            'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
          maxZoom: 22,
          id: 'mapbox/streets-v11',
          tileSize: 512,
          zoomOffset: -1,
          accessToken:
            'pk.eyJ1IjoicmJlcmRlZW4iLCJhIjoiZTU1YjNmOWU4MWExNDJhNWNlMTAxYjA2NjFlODBiNWUifQ.AHJ0I8wQi1pJekXfAaPxLw',
        }
      ),
    []
  );

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map(mapComponent.current!).setView(
        [42.389118, -71.097153],
        10
      );

      tiles.addTo(mapRef.current);
    }
    const map = mapRef.current;
    map.eachLayer((layer) => {
      if (layer !== tiles) {
        map.removeLayer(layer);
      }
    });

    if (customize) {
      customize(mapRef.current);
    }

    features.forEach((f) =>
      L.geoJSON(f)
        .addTo(map)
        .on('click', (e) => {
          console.log(e, f.properties);
        })
    );
  }, [features]);

  return <div ref={mapComponent} style={{ width: 1800, height: 1000 }} />;
}
