/* MIDNIGHT CIRCUIT — audio.
 *
 * Every sound is synthesised: the engine is two oscillators through a lowpass
 * that opens with speed, the wind and tyre slip are filtered noise, and the
 * ambience is a slow detuned pad. Nothing is downloaded.
 */

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let started = false;

  let engineOsc;
  let engineSub;
  let engineFilter;
  let engineGain;
  let windSource;
  let windFilter;
  let windGain;
  let skidSource;
  let skidFilter;
  let skidGain;
  let padOscA;
  let padOscB;
  let padFilter;
  let padGain;

  function noiseBuffer(seconds = 2) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function start() {
    if (started) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    ctx = new AudioContext();
    started = true;

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 6;
    master.connect(limiter).connect(ctx.destination);

    /* Engine. */
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineSub = ctx.createOscillator();
    engineSub.type = 'square';
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineFilter.Q.value = 3.5;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineSub.connect(engineFilter);
    engineFilter.connect(engineGain).connect(master);
    engineOsc.start();
    engineSub.start();

    /* Wind. */
    windSource = ctx.createBufferSource();
    windSource.buffer = noiseBuffer(2);
    windSource.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 900;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSource.connect(windFilter).connect(windGain).connect(master);
    windSource.start();

    /* Tyre slip. */
    skidSource = ctx.createBufferSource();
    skidSource.buffer = noiseBuffer(1.5);
    skidSource.loop = true;
    skidFilter = ctx.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.value = 1500;
    skidFilter.Q.value = 1.2;
    skidGain = ctx.createGain();
    skidGain.gain.value = 0;
    skidSource.connect(skidFilter).connect(skidGain).connect(master);
    skidSource.start();

    /* Ambience pad: two detuned saws a fifth apart. */
    padOscA = ctx.createOscillator();
    padOscA.type = 'sawtooth';
    padOscA.frequency.value = 110;
    padOscB = ctx.createOscillator();
    padOscB.type = 'sawtooth';
    padOscB.frequency.value = 164.8;
    padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 620;
    padGain = ctx.createGain();
    padGain.gain.value = 0.05;
    padOscA.connect(padFilter);
    padOscB.connect(padFilter);
    padFilter.connect(padGain).connect(master);
    padOscA.start();
    padOscB.start();
  }

  function resume() {
    start();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function update(dt, info) {
    if (!started || !ctx) return;
    const { speed = 0, throttle = 0, slip = 0, boosting = false } = info;
    const now = ctx.currentTime;
    const smooth = Math.min(1, dt * 9);

    const rpm = 46 + Math.abs(speed) * 3.1 + (boosting ? 40 : 0);
    engineOsc.frequency.setTargetAtTime(rpm, now, 0.05);
    engineSub.frequency.setTargetAtTime(rpm * 0.5, now, 0.05);
    engineFilter.frequency.setTargetAtTime(
      320 + Math.abs(speed) * 26 + throttle * 700 + (boosting ? 900 : 0), now, 0.08
    );

    const engineLevel = 0.05 + Math.min(0.16, Math.abs(speed) * 0.0022) + throttle * 0.05;
    engineGain.gain.setTargetAtTime(engineLevel, now, 0.09);

    windGain.gain.setTargetAtTime(Math.min(0.09, Math.abs(speed) * 0.0015), now, 0.15);
    windFilter.frequency.setTargetAtTime(500 + Math.abs(speed) * 40, now, 0.2);

    skidGain.gain.setTargetAtTime(Math.min(0.16, Math.abs(slip) * 0.09), now, 0.06);

    // The pad breathes.
    padGain.gain.setTargetAtTime(0.035 + Math.sin(now * 0.22) * 0.014, now, 0.4);

    // Keep the smoothing term used so a zero-dt frame does not stall the ramps.
    void smooth;
  }

  function blip(frequency = 660) {
    if (!started || !ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  function setMuted(next) {
    muted = next;
    if (master) master.gain.setTargetAtTime(next ? 0 : 0.85, ctx.currentTime, 0.05);
  }

  return {
    resume,
    update,
    blip,
    setMuted,
    get muted() { return muted; },
    get ready() { return started; },
  };
}
