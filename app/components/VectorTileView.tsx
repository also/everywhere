import {
  Feature,
  GeoJsonProperties,
  LineString,
  MultiLineString,
} from 'geojson';

import { useMemo, useState } from 'react';
import CanvasLayer from '../CanvasLayer';
import { drawDistanceTile, drawTile } from '../vector-tiles';

import { lookup } from '../worker-stuff';
import { WorkerChannel } from '../WorkerChannel';
import LeafletMap from './LeafletMap';
import L from 'leaflet';
import { createPortal } from 'react-dom';
import FeatureDetails from './FeatureDetails';

export default function VectorTileView({
  channel,
}: {
  channel: WorkerChannel;
}) {
  const [selected, setSelected] =
    useState<{
      feature:
        | Feature<MultiLineString | LineString, GeoJsonProperties>
        | undefined;
      distance: number | undefined;
      lng: number;
      lat: number;
    }>();
  const popupDiv = useMemo(() => document.createElement('div'), []);

  const customize = useMemo(() => {
    return (l: L.Map, control: L.Control.Layers) => {
      control.addOverlay(
        new CanvasLayer(channel, drawDistanceTile),
        'Distance Heatmap'
      );
      const layer = new CanvasLayer(channel, drawTile).addTo(l);
      control.addOverlay(layer, 'Data');

      l.on('click', async ({ latlng: { lat, lng } }: L.LeafletMouseEvent) => {
        // TODO leaflet calls this handler twice? maybe https://github.com/Leaflet/Leaflet/issues/7255
        const selected = await channel.sendRequest(lookup, {
          coords: [lng, lat],
          zoom: l.getZoom(),
        });
        setSelected({
          feature: selected?.feature,
          distance: selected?.distance,
          lng,
          lat,
        });

        L.popup()
          // TODO by putting the popup at the location of the click, it
          // often covers the feature. maybe put it at the top of the feature?
          .setLatLng({ lat, lng })
          .setContent(() => popupDiv)
          .openOn(l);

        layer.setOpts({
          // TODO create a type that includes properties and everywhereFeatureIndex
          selectedIndex: selected?.feature.properties!.everywhereFeatureIndex,
        });
      });
    };
  }, [channel]);

  return (
    <>
      {selected &&
        createPortal(
          <>
            {selected.lat}, {selected.lng}; distance: {selected.distance}
            <FeatureDetails feature={selected?.feature} />
          </>,
          popupDiv
        )}
      <LeafletMap customize={customize} />
    </>
  );
}
