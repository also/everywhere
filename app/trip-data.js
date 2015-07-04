const tripContext = require.context('compact-json!../app-data/trips', false, /\.geojson$/);
export default tripContext.keys().map(name => tripContext(name));
