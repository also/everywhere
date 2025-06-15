import { Feature } from 'geojson';
import { features, featureSummary, getFeature } from '../worker-messages';
import { WorkerLocal } from '../WorkerChannel';

export function createFeatureHandlers(channel: WorkerLocal, feats: Feature[]) {
  channel.handle(featureSummary, () =>
    feats.map((f) => ({
      id: f.id,
      properties: f.properties,
      geometry: { type: f.geometry.type },
    }))
  );

  channel.handle(features, () => feats);

  channel.handle(getFeature, ({ index }) =>
    feats.find((f) => f.properties?.everywhereFeatureIndex === index)
  );
}
