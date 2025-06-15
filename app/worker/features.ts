import { Feature } from 'geojson';
import { features, featureSummary } from '../worker-messages';
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
}
