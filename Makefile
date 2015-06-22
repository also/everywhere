.PHONY: download all-strava-trips

download:
	curl -o data/raw/map.xml http://overpass-api.de/api/map?bbox=-71.1631,42.3589,-71.0417,42.4270	
	
data/build/map.geojson: data/raw/map.xml
	node --max_old_space_size=8192 ./node_modules/.bin/osmtogeojson data/raw/map.xml > data/build/map.geojson

data/build/highways.geojson: data/build/map.geojson
	jq '{type, features: (.features | map(select((.properties | objects | (has("highway") and .highway != "steps" and .highway != "service" and .highway != "proposed" and .highway != "motorway" and .highway != "motorway_link" and .highway != "footway" and .highway != "pedestrian" and .type != "multipolygon")) and .geometry.type != "Point")))}' data/build/map.geojson > data/build/highways.geojson

# intersections.geojson: data/build/map.geojson
# 	jq '{type, features: (.features | map(select(.geometry.type == "Point" and .refCount > 0) | {type, geometry: {type: "Point", coordinates: [(.geometry.coordinates[0] | tonumber), (.geometry.coordinates[1] | tonumber)]}, properties: {refs: .refs}}))}' data/build/map.geojson > intersections.geojson

data/build/somerville.geojson: data/build/map.geojson
	jq '{type, features: (.features | map(select(.properties | (.name == "Somerville" and .type == "boundary"))))}' data/build/map.geojson > data/build/somerville.geojson

data/build/highways-clipped.geojson: data/build/highways.geojson data/build/somerville.geojson
	rm -f data/build/highways-clipped.geojson && ogr2ogr -f GeoJSON -clipsrc data/build/somerville.geojson data/build/highways-clipped.geojson data/build/highways.geojson

# intersections-clipped.geojson: intersections.geojson data/build/somerville.geojson
# 	rm -f intersections-clipped.geojson && ogr2ogr -f GeoJSON -clipsrc data/build/somerville.geojson intersections-clipped.geojson intersections.geojson

app-data/highways-clipped-topo.geojson: data/build/highways-clipped.geojson
	./node_modules/.bin/topojson data/build/highways-clipped.geojson -p highway,name,oneway,user,id -o app-data/highways-clipped-topo.geojson

app-data/somerville-topo.geojson: data/build/somerville.geojson
	./node_modules/.bin/topojson data/build/somerville.geojson -o app-data/somerville-topo.geojson

data/build/elevation-4326.tiff: data/raw/elevation_2005_FP/img_elev2005_fp.img data/build/somerville.geojson
	gdalwarp -t_srs EPSG:4326 -r bilinear -crop_to_cutline -cutline data/build/somerville.geojson data/raw/elevation_2005_FP/img_elev2005_fp.img data/build/elevation-4326.tiff

app-data/contour.geojson: data/build/elevation-4326.tiff
	rm -rf app-data/contour.geojson && gdal_contour -a height -f geojson data/build/elevation-4326.tiff app-data/contour.geojson -i 5

bundle.js: app-data/somerville-topo.geojson app-data/highways-clipped-topo.geojson app-data/trips/* app/* webpack.config.js
	webpack

STRAVA_RAW_TRIPS = $(wildcard data/raw/strava/*.gpx)
STRAVA_GEOJSON_TRIPS = $(patsubst data/raw/strava/%.gpx,app-data/trips/strava-%.geojson,$(STRAVA_RAW_TRIPS))

data/raw/strava/%.geojson: data/raw/strava/%.gpx
	./node_modules/.bin/togeojson $< > $@

app-data/trips/strava-%.geojson: data/raw/strava/%.geojson
	./node_modules/.bin/topojson $< -o $@

all-strava-trips: $(STRAVA_GEOJSON_TRIPS)

app-data/video-metadata/%.json: video/%.MP4
	avprobe -show_streams -of json $< | jq '.streams[0] | {duration, "start": .tags.creation_time}' > $@

ALL_VIDEOS = $(wildcard video/*.MP4)
ALL_VIDEO_METADATA = $(patsubst video/%.MP4,app-data/video-metadata/%.json,$(ALL_VIDEOS))

all-video-metadata: $(ALL_VIDEO_METADATA)

clean:
	rm -f *.geojson

all: bundle.js
