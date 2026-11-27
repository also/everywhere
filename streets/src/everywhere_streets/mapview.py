"""A self-contained Leaflet page showing done / partial / unridden blocks."""

from __future__ import annotations

import json

TEMPLATE = """<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Streets ridden</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; font: 13px system-ui, sans-serif; }
  .panel { background: #fff; padding: 8px 10px; border-radius: 6px; box-shadow: 0 1px 4px #0004; line-height: 1.6; }
  .sw { display: inline-block; width: 18px; height: 4px; vertical-align: middle; margin-right: 6px; }
  label { display: block; cursor: pointer; }
</style></head>
<body><div id="map"></div>
<script>
const data = __DATA__;
const home = __HOME__;
const map = L.map('map', { preferCanvas: true }).setView([home[1], home[0]], 14);
const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
L.tileLayer(esri + 'World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors', maxZoom: 20, maxNativeZoom: 16 }).addTo(map);
L.tileLayer(esri + 'World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, maxNativeZoom: 16, pane: 'shadowPane' }).addTo(map);
map.setMaxZoom(19);

const colors = { done: '#1a9850', partial: '#f39c12', todo: '#d73027' };
const kind = p => p.done ? 'done' : p.covered >= 0.2 ? 'partial' : 'todo';
const layers = {};
for (const k of Object.keys(colors)) {
  layers[k] = L.geoJSON({ type: 'FeatureCollection', features: data.features.filter(f => kind(f.properties) === k) }, {
    style: f => ({ color: colors[k], weight: k === 'done' ? 2 + Math.min(4, Math.log2(1 + f.properties.rides)) : 3, opacity: 0.85 }),
    onEachFeature: (f, l) => {
      const p = f.properties;
      l.bindPopup(`<b>${p.street}</b>, ${p.town}<br>${p.highway}, ${p.length_m} m<br>` +
        `covered ${Math.round(p.covered * 100)}% by ${p.rides} ride(s)<br>` +
        (p.first ? `first ${p.first}<br>` : '') + (p.done_date ? `done ${p.done_date}<br>` : '') +
        (p.last ? `last ${p.last}` : ''));
    },
  }).addTo(map);
}
const len = k => data.features.filter(f => kind(f.properties) === k).reduce((s, f) => s + f.properties.length_m, 0) / 1000;
const panel = L.control({ position: 'topright' });
panel.onAdd = () => {
  const d = L.DomUtil.create('div', 'panel');
  d.innerHTML = Object.keys(colors).map(k =>
    `<label><input type=checkbox checked data-k=${k}> <span class=sw style="background:${colors[k]}"></span>${k} ${len(k).toFixed(1)} km</label>`
  ).join('') + `<div style="max-width:220px;color:#666">${data.towns.join(', ')}</div>`;
  d.querySelectorAll('input').forEach(i => i.onchange = () => i.checked ? layers[i.dataset.k].addTo(map) : map.removeLayer(layers[i.dataset.k]));
  L.DomEvent.disableClickPropagation(d);
  return d;
};
panel.addTo(map);
</script></body></html>
"""


def write_map(geojson: dict, path: str, home: tuple[float, float]) -> None:
    html = TEMPLATE.replace("__DATA__", json.dumps(geojson, separators=(",", ":"))).replace(
        "__HOME__", json.dumps(list(home))
    )
    with open(path, "w") as fh:
        fh.write(html)
