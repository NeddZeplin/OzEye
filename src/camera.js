import * as Cesium from 'cesium';

/**
 * Camera presets for notable locations.
 * The application opens over Australia; see flyToAustralia.
 */
export const CAMERA_PRESETS = {
  austin: {
    destination: Cesium.Cartesian3.fromDegrees(-97.7431, 30.2672, 800),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0.0,
    },
  },
  sf: {
    destination: Cesium.Cartesian3.fromDegrees(-122.4194, 37.7749, 1000),
    orientation: {
      heading: Cesium.Math.toRadians(30),
      pitch: Cesium.Math.toRadians(-30),
      roll: 0.0,
    },
  },
  nyc: {
    destination: Cesium.Cartesian3.fromDegrees(-73.9857, 40.7484, 1200),
    orientation: {
      heading: Cesium.Math.toRadians(-20),
      pitch: Cesium.Math.toRadians(-30),
      roll: 0.0,
    },
  },
};

/**
 * Fly the camera to a preset location with a smooth animation.
 */
export function flyToPreset(viewer, presetName, duration = 3.0) {
  const preset = CAMERA_PRESETS[presetName];
  if (!preset) return;

  viewer.camera.flyTo({
    destination: preset.destination,
    orientation: preset.orientation,
    duration,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
  });
}

/**
 * The opening view: the whole of Australia, north up, seen from directly
 * above its geographic centre.
 */
export const AUSTRALIA_VIEW = Object.freeze({
  latitude: -25.61,
  longitude: 134.35,
  heightM: 7_000_000,
  approachHeightM: 14_000_000,
});

/**
 * Set the camera over Australia on load, settling in from a higher altitude.
 * @returns {Function} Cancels the pending or active startup flight.
 */
export function flyToAustralia(viewer) {
  const orientation = {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-90),
    roll: 0.0,
  };
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      AUSTRALIA_VIEW.longitude,
      AUSTRALIA_VIEW.latitude,
      AUSTRALIA_VIEW.approachHeightM,
    ),
    orientation,
  });

  // Settle in after a brief pause
  const timer = setTimeout(() => {
    if (viewer.isDestroyed()) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        AUSTRALIA_VIEW.longitude,
        AUSTRALIA_VIEW.latitude,
        AUSTRALIA_VIEW.heightM,
      ),
      orientation,
      duration: 4.0,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }, 500);
  return () => {
    clearTimeout(timer);
    if (!viewer.isDestroyed()) viewer.camera.cancelFlight();
  };
}
