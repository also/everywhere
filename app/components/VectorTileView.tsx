import {
  Feature,
  GeoJsonProperties,
  LineString,
  MultiLineString,
} from 'geojson';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  syncUrl,
}: {
  channel: WorkerChannel;
  syncUrl?: string | null;
}) {
  const [selected, setSelected] = useState<{
    feature:
      | Feature<MultiLineString | LineString, GeoJsonProperties>
      | undefined;
    distance: number | undefined;
    lng: number;
    lat: number;
  }>();
  const popupDiv = useMemo(() => document.createElement('div'), []);
  const mapRef = useRef<L.Map | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mouseCursorRef = useRef<L.CircleMarker | null>(null);

  // WebSocket connection for map sync
  useEffect(() => {
    if (!syncUrl) return;

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(syncUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[Map Sync] Connected to WebSocket server');
        };

        ws.onmessage = async (event) => {
          try {
            let data;
            if (event.data instanceof Blob) {
              const text = await event.data.text();
              data = JSON.parse(text);
            } else {
              data = JSON.parse(event.data);
            }
            
            console.log('[Map Sync] Received data:', data);
            
            if (data.bounds && mapRef.current) {
              const bounds = L.latLngBounds(
                [data.bounds.south, data.bounds.west],
                [data.bounds.north, data.bounds.east]
              );
              mapRef.current.fitBounds(bounds);
            }
            
            // Update mouse cursor position
            if (data.mousePosition && mapRef.current) {
              const { lat, lng } = data.mousePosition;
              
              if (mouseCursorRef.current) {
                mouseCursorRef.current.setLatLng([lat, lng]);
              } else {
                mouseCursorRef.current = L.circleMarker([lat, lng], {
                  radius: 5,
                  color: '#ff0000',
                  fillColor: '#ff0000',
                  fillOpacity: 0.8,
                  weight: 2
                }).addTo(mapRef.current);
              }
            }
          } catch (error) {
            console.error('[Map Sync] Error parsing message:', error);
          }
        };

        ws.onclose = () => {
          console.log('[Map Sync] WebSocket connection closed, retrying in 5s...');
          setTimeout(connectWebSocket, 5000);
        };

        ws.onerror = (error) => {
          console.error('[Map Sync] WebSocket error:', error);
        };
      } catch (error) {
        console.error('[Map Sync] Failed to connect to WebSocket:', error);
        setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mouseCursorRef.current && mapRef.current) {
        mapRef.current.removeLayer(mouseCursorRef.current);
        mouseCursorRef.current = null;
      }
    };
  }, [syncUrl]);

  const customize = useMemo(() => {
    return (l: L.Map, control: L.Control.Layers) => {
      mapRef.current = l;
      
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
            <FeatureDetails feature={selected.feature} />
            <div>
              Filename: {selected.feature?.properties?.everywhereFilename}
            </div>
            <div>Tool: {selected.feature?.properties?.everywhereTool}</div>
          </>,
          popupDiv
        )}
      <LeafletMap customize={customize} />
    </>
  );
}
