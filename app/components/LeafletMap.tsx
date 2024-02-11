import { useEffect, useRef } from 'react';
import L from 'leaflet';
import React from 'react';
import { Feature } from 'geojson';

const heatmapOpts = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../../creds/heatmaps.json') as {
      title: string;
      url: string;
      opts: Record<string, any>;
    }[];
  } catch (e) {
    return [];
  }
})();

const mapboxOpts = {
  attribution:
    'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
  maxZoom: 22,
  id: 'mapbox/streets-v11',
  tileSize: 512,
  zoomOffset: -1,
  accessToken:
    'pk.eyJ1IjoicmJlcmRlZW4iLCJhIjoiZTU1YjNmOWU4MWExNDJhNWNlMTAxYjA2NjFlODBiNWUifQ.AHJ0I8wQi1pJekXfAaPxLw',
};

function createMap(
  element: HTMLElement,
  center: [number, number],
  zoom: number
) {
  const streets = L.tileLayer(
    'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}',
    mapboxOpts
  );

  const satellite = L.tileLayer(
    'https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token={accessToken}',
    mapboxOpts
  );

  const control = L.control.layers();
  control.addBaseLayer(streets, 'Streets');
  control.addBaseLayer(satellite, 'Satellite');

  const heatmaps = heatmapOpts.map((opts) => {
    const heatmap = L.tileLayer(opts.url, opts.opts);
    control.addOverlay(heatmap, opts.title);
    return heatmap;
  });

  const map = L.map(element!, {
    layers: [
      streets,
      ...heatmaps.filter((l) => (l.options as any).enabledByDefault !== false),
    ],
  }).setView(center, zoom);

  control.addTo(map);

  return {
    map,
    defaultLayers: new Set([streets, satellite, ...heatmaps]),
    control,
  };
}

export default React.memo(function LeafletMap({
  features = [],
  customize,
  center = [42.389118, -71.097153],
  zoom = 11,
}: {
  features?: Feature[];
  customize?(map: L.Map, control: L.Control.Layers): void;
  center?: [number, number];
  zoom?: number;
}) {
  const mapComponent = useRef<HTMLDivElement>(null);
  const mapRef =
    useRef<{
      map: L.Map;
      defaultLayers: Set<L.Layer>;
      control: L.Control.Layers;
    }>();

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = createMap(mapComponent.current!, center, zoom);
    }

    const { map, defaultLayers, control } = mapRef.current;
    map.eachLayer((layer) => {
      if (!defaultLayers.has(layer)) {
        map.removeLayer(layer);
      }
    });

    if (customize) {
      customize(map, control);
    }

    features.forEach((f) =>
      L.geoJSON(f)
        .addTo(map)
        .on('click', (e) => {
          console.log(e, f.properties);
        })
    );
  }, [features]);

  return <div ref={mapComponent} style={{ flex: 1 }} />;
});
