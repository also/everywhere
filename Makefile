.PHONY: download

download:
	curl -o map.xml http://overpass-api.de/api/map?bbox=-71.1631,42.3589,-71.0417,42.4270	
	
map.geojson: map.xml
	node --max_old_space_size=8192 ./node_modules/.bin/osmtogeojson map.xml > map.geojson

highways.geojson: map.geojson
	jq '{type, features: (.features | map(select((.properties | objects | (has("highway") and .highway != "steps" and .highway != "service" and .highway != "proposed" and .highway != "motorway" and .highway != "motorway_link" and .highway != "footway" and .highway != "pedestrian" and .type != "multipolygon")) and .geometry.type != "Point")))}' map.geojson > highways.geojson

somerville.geojson: map.geojson
	jq '{type, features: (.features | map(select(.properties | (.name == "Somerville" and .type == "boundary"))))}' map.geojson > somerville.geojson

highways-clipped.geojson: highways.geojson somerville.geojson
	rm -f highways-clipped.geojson && ogr2ogr -f GeoJSON -clipsrc somerville.geojson highways-clipped.geojson highways.geojson

highways-clipped-topo.geojson: highways-clipped.geojson
	./node_modules/.bin/topojson highways-clipped.geojson -p highway,name,oneway,user,id -o highways-clipped-topo.geojson

somerville-topo.geojson: somerville.geojson
	 ./node_modules/.bin/topojson somerville.geojson -o somerville-topo.geojson

bundle.js: somerville-topo.geojson highways-clipped-topo.geojson trips/*
	webpack

strava-raw/%.geojson: strava-raw/%.gpx
	./node_modules/.bin/togeojson $< > $@

trips/strava-%.geojson: strava-raw/%.geojson
	./node_modules/.bin/topojson $< -o $@

clean:
	rm -f *.geojson

all: bundle.js
