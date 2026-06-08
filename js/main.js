/* ============================================================================
 * main.js — bootstrap, canvas scaling, and the fixed-timestep game loop.
 * ==========================================================================*/
(function (global) {
  'use strict';

  function boot() {
    const canvas = document.getElementById('screen');
    const loading = document.getElementById('loading');

    global.GFX.init(canvas);
    global.Input.init();

    // Audio needs a user gesture; start it on first input.
    global.Input.onFirstInput = function () {
      global.Sound.resume();
      if (global.Game.mode === 'title') global.Sound.playMusic('title');
    };

    global.Game.init();
    if (loading) loading.style.display = 'none';

    // Fixed-timestep loop (60 updates/sec) with rendering each frame.
    const STEP = 1000 / 60;
    let acc = 0, last = performance.now();

    function frame(now) {
      let dt = now - last; last = now;
      if (dt > 250) dt = 250; // avoid spiral after tab switch
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        global.Input.update();
        global.Game.update();
        acc -= STEP;
        steps++;
      }
      global.Game.render();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
