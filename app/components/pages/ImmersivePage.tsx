import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { ExtrudePolygon } from '@babylonjs/core/Meshes/Builders/polygonBuilder';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';

// Side-effects only imports allowing the standard material to be used as default.
// import '@babylonjs/core/Materials/standardMaterial';
// Side-effects only imports allowing Mesh to create default shapes (to enhance tree shaking, the construction methods on mesh are not available if the meshbuilder has not been imported).
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
// import '@babylonjs/core/Meshes/Builders/groundBuilder';

import { WebXRSessionManager } from '@babylonjs/core/XR/webXRSessionManager';
import { WebXRDefaultExperience } from '@babylonjs/core/XR/webXRDefaultExperience';
// required or else "sceneToRenderTo.beginAnimation is not a function"
import '@babylonjs/core/Animations/animatable';

import { Animation } from '@babylonjs/core/Animations/animation';

import earcut from 'earcut';

import FullScreenPage from '../FullScreenPage';
import { useContext, useEffect, useRef } from 'react';
import DataContext from '../DataContext';
import { compute } from '../Map';
import { coordses } from '../../geo';
import DataSetContext from '../DataSetContext';

// color 00dcc2
const color = Color4.FromHexString('#00dcc2');
const grey = Color3.FromHexString('#444444');
const animFrames = 400;

export default function ImmersivePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { boundary, ways } = useContext(DataContext);
  const { trips } = useContext(DataSetContext);

  useEffect(() => {
    (async () => {
      if (canvasRef.current && trips.length > 0) {
        const { projection } = compute({ width: 3, height: 3, boundary });
        const canXr = await WebXRSessionManager.IsSessionSupportedAsync(
          'immersive-vr'
        );
        const engine = new Engine(canvasRef.current, true);
        const scene = new Scene(engine);
        const camera = new FreeCamera('camera', new Vector3(0, 7, -5), scene);
        camera.setTarget(Vector3.Zero());
        camera.attachControl(canvasRef.current, true);

        if (canXr) {
          const xr = await WebXRDefaultExperience.CreateAsync(scene, {
            // TODO how to get retina support in safari?
            // outputCanvasOptions: {
            //   canvasOptions: {
            //     framebufferScaleFactor: 2,
            //   },
            // },
          });
        }

        const light = new HemisphericLight(
          'light',
          new Vector3(0, 1, 0),
          scene
        );

        const points = boundary.geometry.coordinates[0].map((p) => {
          const [x, y] = projection(p);
          return new Vector3(x, 0, -y);
        });

        points.reverse();

        const mesh = ExtrudePolygon(
          'mesh',
          { shape: points, depth: 0.1, faceColors: [color, color, color] },
          scene,
          earcut
        );

        function reposition(p: Vector3) {
          p.x = -1;
        }

        // // translate the lines so they're in front of the camera at eye level
        reposition(mesh.position);

        const pointses: Vector3[][] = [];

        ways.features.forEach((way, i) => {
          coordses(way.geometry).forEach((coords) => {
            pointses.push(
              coords.map((p) => {
                const [x, y] = projection(p);
                return new Vector3(x, 0.01, -y);
              })
            );
          });
        });

        const wayLineSystem = CreateLineSystem(
          'lines',
          { lines: pointses },
          scene
        );
        wayLineSystem.color = grey;
        reposition(wayLineSystem.position);

        const tripsPointses: Vector3[][] = [];
        trips.forEach((trip) => {
          coordses(trip.geometry).forEach((coords) => {
            tripsPointses.push(
              coords.map((p) => {
                const [x, y] = projection(p);
                return new Vector3(x, 0.1, -y);
              })
            );
          });
        });

        const tripsLineSystem = CreateLineSystem(
          'trips',
          { lines: tripsPointses },
          scene
        );
        reposition(tripsLineSystem.position);

        // const animation = new Animation(
        //   'animation',
        //   'rotation.y',
        //   60,
        //   Animation.ANIMATIONTYPE_FLOAT,
        //   Animation.ANIMATIONLOOPMODE_CYCLE
        // );

        // const keys = [
        //   { frame: 0, value: 0 },
        //   { frame: animFrames, value: 2 * Math.PI },
        // ];

        // animation.setKeys(keys);

        // mesh.animations.push(animation);

        // scene.beginAnimation(mesh, 0, animFrames, true);

        // wayLineSystem.animations.push(animation);

        // scene.beginAnimation(wayLineSystem, 0, animFrames, true);

        engine.runRenderLoop(() => {
          scene.render();
        });
      }
    })();
  }, [trips]);

  return (
    <FullScreenPage>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </FullScreenPage>
  );
}
