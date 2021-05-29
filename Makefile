.PHONY: download

download:
	curl -o data/raw/map.xml http://overpass-api.de/api/map?bbox=-71.1631,42.3589,-71.0417,42.4270

download-metro:
	curl -o data/raw/map.xml "https://overpass-api.de/api/interpreter?data=way%5Bhighway%5D%2842.19596877629178%2C-71.52374267578125%2C42.5379038984207%2C-70.83503723144531%29%3B%0A%28._%3B%3E%3B%29%3B%0Aout%3B"

# data/build/map.geojson: data/raw/map.xml
# 	node --max_old_space_size=8192 ./node_modules/.bin/osmtogeojson data/raw/map.xml > data/build/map.geojson

data/build/map.geojson: data/raw/map.xml
	node --max_old_space_size=8192 tools osm-to-geojson data/raw/map.xml > data/build/map.geojson

data/build/highways.geojson: data/build/map.geojson
	jq '{type, features: (.features | map(select((.properties | objects | .bikeable))))}' data/build/map.geojson > data/build/highways.geojson

data/build/intersections.geojson: data/build/map.geojson
	jq '{type, features: (.features | map(select(.geometry.type == "Point" and .refCount > 0) | {type, geometry: {type: "Point", coordinates: [(.geometry.coordinates[0] | tonumber), (.geometry.coordinates[1] | tonumber)]}, properties: {refs: .refs}}))}' data/build/map.geojson > data/build/intersections.geojson

data/build/somerville.geojson: data/build/map.geojson
	jq '{type, features: (.features | map(select(.properties | (.name == "Somerville" and .type == "boundary"))))}' data/build/map.geojson > data/build/somerville.geojson

data/build/highways-clipped.geojson: data/build/highways.geojson data/build/somerville.geojson
	rm -f data/build/highways-clipped.geojson && ogr2ogr -f GeoJSON -clipsrc data/build/somerville.geojson data/build/highways-clipped.geojson data/build/highways.geojson

data/build/intersections-clipped.geojson: data/build/intersections.geojson data/build/somerville.geojson
	rm -f data/build/intersections-clipped.geojson && ogr2ogr -f GeoJSON -clipsrc data/build/somerville.geojson data/build/intersections-clipped.geojson data/build/intersections.geojson

app-data/highways-clipped-topo.geojson: data/build/highways-clipped.geojson
	./node_modules/.bin/topojson data/build/highways-clipped.geojson -p highway,name,oneway,user,id -o app-data/highways-clipped-topo.geojson

app-data/highways-topo.geojson: data/build/highways.geojson
	./node_modules/.bin/topojson data/build/highways.geojson -p highway,name,oneway,user,id -o app-data/highways-topo.geojson

app-data/intersections-clipped-topo.geojson: data/build/intersections-clipped.geojson
	./node_modules/.bin/topojson data/build/intersections-clipped.geojson -p refs -o app-data/intersections-clipped-topo.geojson

app-data/somerville-topo.geojson: data/build/somerville.geojson
	./node_modules/.bin/topojson data/build/somerville.geojson -o app-data/somerville-topo.geojson

data/build/elevation-4326.tiff: data/raw/elevation_2005_FP/img_elev2005_fp.img data/build/somerville.geojson
	gdalwarp -t_srs EPSG:4326 -r bilinear -crop_to_cutline -cutline data/build/somerville.geojson data/raw/elevation_2005_FP/img_elev2005_fp.img data/build/elevation-4326.tiff

data/build/contour.geojson: data/build/elevation-4326.tiff
	rm -rf $@ && gdal_contour -a height -f geojson $< $@ -i 5

app-data/contour.geojson: data/build/contour.geojson
	./node_modules/.bin/topojson $< -o $@

bundle.js: app-data/somerville-topo.geojson app-data/highways-clipped-topo.geojson app-data/trips/* app/* webpack.config.js
	./node_modules/.bin/webpack

app-data/video-metadata/%.json: video/%.MP4
	ffprobe -show_streams -of json $< | jq '.streams[0] | {duration, "start": .tags.creation_time}' > $@

ALL_VIDEOS = $(wildcard video/*.MP4)
ALL_VIDEO_METADATA = $(patsubst video/%.MP4,app-data/video-metadata/%.json,$(ALL_VIDEOS))

all-video-metadata: $(ALL_VIDEO_METADATA)

clean:
	rm -f *.geojson

all: bundle.js
