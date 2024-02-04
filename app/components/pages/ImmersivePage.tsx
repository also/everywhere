import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Mesh } from '@babylonjs/core/Meshes/mesh';

// Side-effects only imports allowing the standard material to be used as default.
import '@babylonjs/core/Materials/standardMaterial';
// Side-effects only imports allowing Mesh to create default shapes (to enhance tree shaking, the construction methods on mesh are not available if the meshbuilder has not been imported).
import '@babylonjs/core/Meshes/Builders/sphereBuilder';
import '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import '@babylonjs/core/Meshes/Builders/groundBuilder';

import FullScreenPage from '../FullScreenPage';
import { useContext, useEffect, useMemo, useRef } from 'react';
import DataContext from '../DataContext';
import { compute } from '../Map';

export default function ImmersivePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { boundary } = useContext(DataContext);

  const { projection } = useMemo(
    () => compute({ width: 3, height: 3, boundary }),
    []
  );

  useEffect(() => {
    if (canvasRef.current) {
      const engine = new Engine(canvasRef.current, true);
      const scene = new Scene(engine);

      const camera = new FreeCamera('camera', new Vector3(0, 5, -10), scene);
      camera.setTarget(Vector3.Zero());
      camera.attachControl(canvasRef.current, true);

      const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);

      const sphere = Mesh.CreateSphere('sphere1', 16, 2, scene);
      sphere.position.y = 1;

      const points = boundary.geometry.coordinates[0].map((p) => {
        const [x, y] = projection(p);
        return new Vector3(x, y, 0);
      });

      const lines = CreateLines('lines', { points }, scene);

      engine.runRenderLoop(() => {
        scene.render();
      });
    }
  }, []);

  return (
    <FullScreenPage>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </FullScreenPage>
  );
}
