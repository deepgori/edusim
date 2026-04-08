/**
 * helpers.js — Shared utility functions for EduSim
 */
const EduUtils = (() => {
  /**
   * Linearly interpolate between two values
   */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Clamp a value between min and max
   */
  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  /**
   * Map a value from one range to another
   */
  function mapRange(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  }

  /**
   * Generate a random number between min and max
   */
  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  /**
   * Generate a random integer between min and max (inclusive)
   */
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Convert degrees to radians
   */
  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  /**
   * Convert radians to degrees
   */
  function radToDeg(rad) {
    return (rad * 180) / Math.PI;
  }

  /**
   * Debounce a function call
   */
  function debounce(fn, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /**
   * Create an HSL color string
   */
  function hsl(h, s, l, a = 1) {
    if (a < 1) return `hsla(${h}, ${s}%, ${l}%, ${a})`;
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  /**
   * Ease-out cubic
   */
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Ease-in-out sine
   */
  function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  /**
   * Format a number with commas
   */
  function formatNumber(num) {
    return num.toLocaleString();
  }

  /**
   * Create a Three.js color from hex
   */
  function threeColor(hex) {
    return new THREE.Color(hex);
  }

  /**
   * Simple UUID generator
   */
  function uuid() {
    return 'xxxx-xxxx'.replace(/x/g, () =>
      ((Math.random() * 16) | 0).toString(16)
    );
  }

  return {
    lerp, clamp, mapRange, random, randomInt,
    degToRad, radToDeg, debounce, hsl,
    easeOutCubic, easeInOutSine, formatNumber,
    threeColor, uuid
  };
})();
