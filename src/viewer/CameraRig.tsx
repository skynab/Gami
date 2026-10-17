import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Sphere } from 'three';
import { useViewer } from '../state/viewer';
import { anglesFrom, nearestAngle, sameAngles, VIEW_ANGLES, type Angles } from './views';

const { ACTION } = CameraControlsImpl;
const ROTATING = ACTION.ROTATE | ACTION.TOUCH_ROTATE | ACTION.TOUCH_DOLLY_ROTATE | ACTION.TOUCH_ZOOM_ROTATE;
/** Room around the model when fitting it to the screen. */
const PADDING = 1.25;

/**
 * Orbit, zoom and pan, plus the view presets, lock and reset from the viewer store. Whenever `fit` changes
 * (a new step), the camera glides to frame it, keeping the angle you're looking from.
 * Mouse: left drag rotates, right drag pans, wheel zooms. Touch: one finger rotates, two pinch and pan.
 * When locked, left drag and one finger pan instead, so the view can't be turned by accident.
 */
export function CameraRig({ fit }: { fit: Sphere }) {
  const ref = useRef<CameraControlsImpl>(null);
  const command = useViewer((s) => s.command);
  const locked = useViewer((s) => s.locked);
  const first = useRef(true);
  const invalidate = useThree((s) => s.invalidate);
  // Read inside the command effect without making it re-run when the step changes.
  const fitRef = useRef(fit);
  fitRef.current = fit;
  /** The sphere the camera last framed, so a reset and a new step don't frame the same thing twice. */
  const framed = useRef<Sphere | null>(null);
  const animated = () => !first.current && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frame = (c: CameraControlsImpl, sphere: Sphere, animate: boolean) =>
    c.fitToSphere(sphere.clone().set(sphere.center, sphere.radius * PADDING), animate);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    // The first view of a model appears in place; later moves animate unless the user prefers less motion.
    const animate = animated();
    first.current = false;
    const turnTo = (a: Angles) => c.rotateTo(nearestAngle(c.azimuthAngle, a.azimuth), a.polar, animate);
    const { x, y, z } = fitRef.current.center;

    if (command.kind === 'reset') {
      void turnTo(VIEW_ANGLES.free);
      void frame(c, fitRef.current, animate);
      framed.current = fitRef.current;
    } else {
      void turnTo(command.kind === 'view' ? VIEW_ANGLES[command.view] : anglesFrom(command.dir));
      void c.moveTo(x, y, z, animate);
    }
    // The canvas only draws on demand: ask for a frame so the move shows (and its animation starts).
    invalidate();
  }, [command, invalidate]);

  // A new step: frame it from wherever the camera is looking.
  useEffect(() => {
    const c = ref.current;
    if (!c || first.current || framed.current === fit) return;
    void frame(c, fit, animated());
    framed.current = fit;
    invalidate();
  }, [fit, invalidate]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.mouseButtons.left = locked ? ACTION.TRUCK : ACTION.ROTATE;
    c.touches.one = locked ? ACTION.TOUCH_TRUCK : ACTION.TOUCH_ROTATE;
  }, [locked]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    // Rotating by hand leaves the preset. Zooming and panning don't, since the view angle is unchanged.
    const onControl = () => {
      if (!(c.currentAction & ROTATING)) return;
      const { view, leftPreset } = useViewer.getState();
      if (view !== 'free' && !sameAngles({ azimuth: c.azimuthAngle, polar: c.polarAngle }, VIEW_ANGLES[view])) leftPreset();
    };
    c.addEventListener('control', onControl);
    return () => c.removeEventListener('control', onControl);
  }, []);

  return <CameraControls ref={ref} makeDefault minDistance={0.3} maxDistance={8} />;
}
