const tripContext = require.context('json!../app-data/trips', false, /\.geojson$/);
export default tripContext.keys().map(name => tripContext(name));
