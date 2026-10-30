import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PerspectiveCamera, Sphere } from 'three';
import { useViewer } from '../state/viewer';
import { anglesFrom, nearestAngle, sameAngles, VIEW_ANGLES, type Angles } from './views';

const { ACTION } = CameraControlsImpl;
const ROTATING = ACTION.ROTATE | ACTION.TOUCH_ROTATE | ACTION.TOUCH_DOLLY_ROTATE | ACTION.TOUCH_ZOOM_ROTATE;
/** Room around the model when fitting it to the screen. */
const PADDING = 1.25;

/**
 * Orbit, zoom and pan, plus the view presets, lock and reset from the viewer store. The camera stays where it is
 * from step to step, so a close look at one part carries on into the next fold; following, whenever `fit` changes
 * (a new step), it glides to frame it instead, keeping the angle you're looking from.
 * Mouse: left drag rotates, right drag pans, wheel zooms. Touch: one finger rotates, two pinch and pan.
 * When locked, left drag and one finger pan instead, so the view can't be turned by accident.
 */
export function CameraRig({ fit }: { fit: Sphere }) {
  const ref = useRef<CameraControlsImpl>(null);
  const command = useViewer((s) => s.command);
  const locked = useViewer((s) => s.locked);
  const follow = useViewer((s) => s.follow);
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

  // Where the step card lies across the whole view (on a phone), the camera frames what's left above it: its
  // picture is that part of the view, carrying on down under the card, so the model is fitted to and centred in
  // the part you can see.
  const covered = useCovered();
  const camera = useThree((s) => s.camera) as PerspectiveCamera & { manual?: boolean };
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    const { width, height } = size;
    if (!width || !height) return;
    const seen = Math.max(height * 0.4, height - covered);
    camera.manual = true;
    camera.aspect = width / seen;
    if (seen < height) camera.setViewOffset(width, seen, 0, 0, width, height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size, covered, invalidate]);
  // The card growing or shrinking (each step's text is its own length) changes what can be seen: frame it again.
  useEffect(() => {
    const c = ref.current;
    if (!c || first.current || !useViewer.getState().follow || !framed.current) return;
    void frame(c, framed.current, animated());
    invalidate();
  }, [covered, invalidate]);

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

  // Following, a new step: frame it from wherever the camera is looking. Starting to follow frames the step shown.
  useEffect(() => {
    const c = ref.current;
    if (!c || !follow || first.current || framed.current === fit) return;
    void frame(c, fit, animated());
    framed.current = fit;
    invalidate();
  }, [fit, follow, invalidate]);

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

/**
 * How much of the bottom of the view the step card covers, when it lies across the whole width of it (as on a
 * phone); 0 when it sits to one side or is hidden. Kept up to date as the card changes.
 */
function useCovered(): number {
  const canvas = useThree((s) => s.gl.domElement);
  const [covered, setCovered] = useState(0);
  useEffect(() => {
    const stage = canvas.closest('.stage');
    if (!stage) return;
    const measure = () => {
      const card = stage.querySelector('.step-card');
      const view = canvas.getBoundingClientRect();
      const box = card?.getBoundingClientRect();
      setCovered(box && box.width > 0.8 * view.width ? Math.round(Math.max(0, view.bottom - box.top)) : 0);
    };
    const sizes = new ResizeObserver(measure);
    const watch = () => {
      sizes.disconnect();
      sizes.observe(canvas);
      const card = stage.querySelector('.step-card');
      if (card) sizes.observe(card);
      measure();
    };
    // The card comes and goes (hidden, or between steps), so watch for it.
    const changes = new MutationObserver(watch);
    changes.observe(stage, { childList: true });
    watch();
    return () => {
      sizes.disconnect();
      changes.disconnect();
    };
  }, [canvas]);
  return covered;
}
