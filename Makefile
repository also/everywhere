.PHONY: download

# approximate the original(?) data I downloaded in 2015
# /api/map https://github.com/drolbr/Overpass-API/blob/master/src/cgi-bin/map
#   data=[bbox];(node(bbox);way(bn);node(w););(._;(rel(bn)->.a;rel(bw)->.a;);rel(br););out meta;
# bbox=-71.1631,42.3589,-71.0417,42.4270
# the data is from before https://www.openstreetmap.org/changeset/32424783
# [date:"2015-07-05T12:00:00Z"];
# https://overpass-api.de/api/interpreter?data=[date:"2015-07-05T12:00:00Z"][bbox];(node(bbox);way(bn);node(w););(._;(rel(bn)->.a;rel(bw)->.a;);rel(br););out meta;&bbox=-71.1631,42.3589,-71.0417,42.4270
# unfortunately this query times out
# curl -o data/raw/map.xml "https://overpass-api.de/api/interpreter?data=%5Bdate%3A%222015-07-05T12%3A00%3A00Z%22%5D%5Bbbox%5D%3B(node(bbox)%3Bway(bn)%3Bnode(w)%3B)%3B(._%3B(rel(bn)-%3E.a%3Brel(bw)-%3E.a%3B)%3Brel(br)%3B)%3Bout%20meta%3B&bbox=-71.1631,42.3589,-71.0417,42.4270"
# this is good enough - it doesn't include nodes outside of the bbox that are part of ways/relations inside the bbox, but we don't need them
download:
	curl -o data/raw/map.xml "https://overpass-api.de/api/interpreter?data=%5Bdate%3A%222015-07-05T12%3A00%3A00Z%22%5D%3B(node(42.3589%2C-71.1631%2C42.427%2C-71.0417)%3B%3C%3B)%3Bout%20meta%3B"

download-metro:
	curl -o data/raw/map-metro.xml "https://overpass-api.de/api/interpreter?data=way%5Bhighway%5D%2842.19596877629178%2C-71.52374267578125%2C42.5379038984207%2C-70.83503723144531%29%3B%0A%28._%3B%3E%3B%29%3B%0Aout%3B"

# data/build/map.geojson: data/raw/map.xml
# 	node --max_old_space_size=8192 ./node_modules/.bin/osmtogeojson data/raw/map.xml > data/build/map.geojson

data/build/map.geojson: data/raw/map.xml
	node --max_old_space_size=8192 tools osm-to-geojson data/raw/map.xml > data/build/map.geojson

data/build/map-metro.geojson: data/raw/map-metro.xml
	node --max_old_space_size=8192 tools osm-to-geojson data/raw/map-metro.xml > data/build/map-metro.geojson

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
