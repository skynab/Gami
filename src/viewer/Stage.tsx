import { ContactShadows, Grid } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { Sphere, Vector3 } from 'three';
import { useThemeColors } from '../app/useThemeColors';
import { stepBound } from '../fold/animate';
import type { OrigamiModel } from '../fold/types';
import { usePlayback } from '../state/playback';
import { useViewer } from '../state/viewer';
import { CameraRig } from './CameraRig';
import { FoldedPaper } from './FoldedPaper';
import { FoldGuides } from './FoldGuides';
import { CubeCorner } from './ViewCube';

/**
 * The 3D viewport: the paper on a table, lit softly, with a view cube in the corner. Loaded on demand.
 * `onTap`: a click or tap in the view that isn't on the view cube, and isn't the end of a drag turning the camera.
 */
export default function Stage({ model, onTap }: { model: OrigamiModel; onTap?: () => void }) {
  const colors = useThemeColors();
  const table = useViewer((s) => s.table);
  // The camera frames whichever step is showing, worked out when the step is reached, so the camera only
  // moves when the step changes.
  const step = usePlayback((s) => s.step);
  const total = usePlayback((s) => s.total);
  const k = Math.min(model.steps.length, total ? step : 0);
  const fit = useMemo(() => {
    const { center, radius } = stepBound(model, k);
    return new Sphere(new Vector3(...center), radius);
  }, [model, k]);

  return (
    <Canvas
      className="viewer"
      // Draw only when something changes, so an idle model costs no battery.
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 35, near: 0.01, far: 100, position: [0, 2, 2] }}
      fallback={<NoWebGL />}
      // A "miss" is a click that hit nothing clickable (only the view cube is) and moved under 2px since going down.
      // With the view cube grown, a click elsewhere only shrinks it back.
      onPointerMissed={(e) => {
        if (e.type !== 'click') return;
        const viewer = useViewer.getState();
        if (viewer.cubeZoomed) viewer.setCubeZoomed(false);
        else onTap?.();
      }}
    >
      <hemisphereLight args={['#ffffff', '#dcd8e6', 2.2]} />
      <directionalLight position={[2, 4, 3]} intensity={1.8} />
      {/* From below too, so the back of the sheet reads as white paper when you look underneath. */}
      <directionalLight position={[-2, -3, -1]} intensity={1.2} />

      <FoldedPaper model={model} edgeColor={colors.muted} />
      <FoldGuides model={model} color={colors.accent} />
      {/* A little below the table top, so the paper (pushed back in depth to keep its crease lines visible) always wins. */}
      <ContactShadows position-y={-0.01} scale={3} blur={2.4} far={1} opacity={0.35} />
      {/* A faint grid on the table, so how near the camera is shows at a glance: a cell is a tenth of a standard
          sheet, a heavier line every half sheet. It fades out around the paper, and is seen only from above. Under
          the shadow, which is drawn after it. */}
      {table && (
        <Grid
          position-y={-0.012}
          renderOrder={-1}
          infiniteGrid
          cellSize={0.1}
          sectionSize={0.5}
          cellThickness={0.6}
          sectionThickness={1}
          cellColor={colors.line}
          sectionColor={colors.line}
          fadeDistance={3.5}
          fadeStrength={1.5}
          fadeFrom={0}
        />
      )}

      <CameraRig fit={fit} />

      <CubeCorner colors={colors} />
    </Canvas>
  );
}

function NoWebGL() {
  return (
    <div className="stage-empty">
      <h1>3D isn’t available</h1>
      <p className="muted">Your browser or device couldn’t start WebGL, which Gami needs to show the model.</p>
    </div>
  );
}
