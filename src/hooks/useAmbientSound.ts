import { useRef, useState, useCallback } from "react";

export type AmbientSoundType = "white-noise" | "rain" | "lo-fi" | null;

export function useAmbientSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);
  const gainRef = useRef<GainNode | null>(null);
  const [active, setActive] = useState<AmbientSoundType>(null);
  const [volume, setVolumeState] = useState(0.3);

  const cleanup = useCallback(() => {
    nodesRef.current.forEach((n) => {
      try {
        if (n instanceof AudioBufferSourceNode || n instanceof OscillatorNode) n.stop();
        n.disconnect();
      } catch {}
    });
    nodesRef.current = [];
    gainRef.current = null;
  }, []);

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const createWhiteNoise = useCallback((ctx: AudioContext, gain: GainNode) => {
    const bufferSize = ctx.sampleRate * 4; // 4 seconds looped
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
    nodesRef.current.push(source);
  }, []);

  const createRain = useCallback((ctx: AudioContext, gain: GainNode) => {
    // Brown noise (filtered) + gentle modulation = rain-like
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Brown noise filter
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Bandpass to simulate rain patter
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 800;
    bp.Q.value = 0.5;

    // Add some high-frequency crackle layer
    const crackleBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const crackleData = crackleBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      crackleData[i] = Math.random() > 0.97 ? (Math.random() * 2 - 1) * 0.3 : 0;
    }
    const crackle = ctx.createBufferSource();
    crackle.buffer = crackleBuffer;
    crackle.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 4000;

    source.connect(bp);
    bp.connect(gain);
    crackle.connect(hp);
    hp.connect(gain);

    source.start();
    crackle.start();
    nodesRef.current.push(source, bp, crackle, hp);
  }, []);

  const createLoFi = useCallback((ctx: AudioContext, gain: GainNode) => {
    // Warm pad chords with slight detuning + vinyl crackle
    const frequencies = [261.63, 329.63, 392.0, 493.88]; // C4, E4, G4, B4
    
    for (const freq of frequencies) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      // Slight random detune for warmth
      osc.detune.value = (Math.random() - 0.5) * 15;

      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.08;

      // Low-pass for warmth
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 600;
      lp.Q.value = 1;

      osc.connect(lp);
      lp.connect(oscGain);
      oscGain.connect(gain);
      osc.start();
      nodesRef.current.push(osc, lp, oscGain);
    }

    // Vinyl crackle layer
    const bufferSize = ctx.sampleRate * 3;
    const crackleBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const crackleData = crackleBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      crackleData[i] = Math.random() > 0.993 ? (Math.random() * 2 - 1) * 0.15 : (Math.random() * 2 - 1) * 0.005;
    }
    const crackle = ctx.createBufferSource();
    crackle.buffer = crackleBuffer;
    crackle.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2000;

    crackle.connect(hp);
    hp.connect(gain);
    crackle.start();
    nodesRef.current.push(crackle, hp);
  }, []);

  const play = useCallback((type: AmbientSoundType) => {
    cleanup();
    if (!type) {
      setActive(null);
      return;
    }

    const ctx = getCtx();
    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.connect(ctx.destination);
    gainRef.current = gain;
    nodesRef.current.push(gain);

    switch (type) {
      case "white-noise":
        createWhiteNoise(ctx, gain);
        break;
      case "rain":
        createRain(ctx, gain);
        break;
      case "lo-fi":
        createLoFi(ctx, gain);
        break;
    }

    setActive(type);
  }, [volume, cleanup, getCtx, createWhiteNoise, createRain, createLoFi]);

  const stop = useCallback(() => {
    cleanup();
    setActive(null);
  }, [cleanup]);

  const toggle = useCallback((type: AmbientSoundType) => {
    if (active === type) {
      stop();
    } else {
      play(type);
    }
  }, [active, play, stop]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (gainRef.current) {
      gainRef.current.gain.value = v;
    }
  }, []);

  return { active, volume, toggle, stop, setVolume };
}
