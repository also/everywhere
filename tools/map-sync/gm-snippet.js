// snippet to paste into a page that uses google maps to sync the map state
((enableReceiving = false) => {
  let mapInstances = [];
  let ws = null;
  let lastSentLocation = null;

  // WebSocket connection
  const connectWebSocket = () => {
    try {
      ws = new WebSocket('ws://localhost:8081/map-sync');

      ws.onopen = () => {
        console.log('[Map Sync] Connected to WebSocket server');
      };

      if (enableReceiving) {
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Update all map instances with received location
            mapInstances.forEach((map) => {
              if (data.center) {
                map.setCenter(data.center);
              }
              if (data.zoom !== undefined) {
                map.setZoom(data.zoom);
              }
            });
          } catch (error) {
            console.error('[Map Sync] Error parsing message:', error);
          }
        };
      }

      ws.onclose = () => {
        console.log(
          '[Map Sync] WebSocket connection closed, retrying in 5s...'
        );
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

  // Send map data to server
  const sendMapData = (map, extraProps = {}) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const center = map.getCenter();
    const zoom = map.getZoom();
    const bounds = map.getBounds();

    if (!bounds) {
      return;
    }

    const mapData = {
      center: {
        lat: center.lat(),
        lng: center.lng(),
      },
      zoom: zoom,
      bounds: {
        north: bounds.getNorthEast().lat(),
        south: bounds.getSouthWest().lat(),
        east: bounds.getNorthEast().lng(),
        west: bounds.getSouthWest().lng(),
      },
      timestamp: Date.now(),
      ...extraProps,
    };

    // Avoid sending duplicate locations for non-mousemove events
    if (
      !extraProps.type &&
      lastSentLocation &&
      Math.abs(lastSentLocation.center.lat - mapData.center.lat) < 0.0001 &&
      Math.abs(lastSentLocation.center.lng - mapData.center.lng) < 0.0001 &&
      lastSentLocation.zoom === mapData.zoom
    ) {
      return;
    }

    if (!extraProps.type) {
      lastSentLocation = mapData;
    }

    ws.send(JSON.stringify(mapData));
  };

  const exposeMap = (map) => {
    mapInstances.push(map);
    console.log('[Map Hook] Captured map instance:', map);

    // Add event listeners for map changes
    map.addListener('center_changed', () => {
      sendMapData(map);
    });

    map.addListener('zoom_changed', () => {
      sendMapData(map);
    });

    map.addListener('mousemove', (event) => {
      sendMapData(map, {
        type: 'mousemove',
        mousePosition: {
          lat: event.latLng.lat(),
          lng: event.latLng.lng(),
        },
      });
    });
  };

  // Initialize WebSocket connection
  connectWebSocket();

  // 1. Intercept window.google
  let _google;
  Object.defineProperty(window, 'google', {
    configurable: true,
    enumerable: true,
    get: () => _google,
    set: (val) => {
      _google = val;
      console.log('[Map Hook] window.google set.');

      // 2. Intercept google.maps
      let _maps;
      Object.defineProperty(val, 'maps', {
        configurable: true,
        enumerable: true,
        get: () => _maps,
        set: (mapsVal) => {
          _maps = mapsVal;
          console.log('[Map Hook] google.maps set.');

          // 3. Intercept google.maps.Map
          let _Map;
          Object.defineProperty(mapsVal, 'Map', {
            configurable: true,
            enumerable: true,
            get: () => _Map,
            set: (MapConstructor) => {
              _Map = function (...args) {
                const instance = new MapConstructor(...args);
                exposeMap(instance);
                return instance;
              };
              _Map.prototype = MapConstructor.prototype;
              _Map.prototype.constructor = _Map;
              console.log('[Map Hook] google.maps.Map wrapped.');
            },
          });
        },
      });
    },
  });

  console.log('[Map Hook] Recursive google.maps.Map hook installed.');
})();
