// sound.js — tiny WebAudio beeps. No audio files, no Phaser sound
// manager. The context is created lazily on first use (browsers block
// audio before the user interacts with the page), and every beep is
// wrapped in try/catch — sound is cosmetic, it must never crash the game.

let _audioCtx = null;
function beep(freq, durationMs, type, volume) {
  try {
    if (!_audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      _audioCtx = new AC();
    }
    if (_audioCtx.state === "suspended") _audioCtx.resume();
    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    gain.gain.value = volume || 0.08;
    osc.connect(gain);
    gain.connect(_audioCtx.destination);
    osc.start();
    osc.stop(_audioCtx.currentTime + (durationMs || 90) / 1000);
  } catch (e) { /* sound is cosmetic — never let it crash the game */ }
}

export const sfx = {
  eat: function () { beep(620, 70, "sine", 0.07); },
  coin: function () { beep(880, 70, "sine", 0.08); setTimeout(function () { beep(1320, 90, "sine", 0.06); }, 60); },
  buy: function () { beep(440, 90, "triangle", 0.08); setTimeout(function () { beep(660, 110, "triangle", 0.07); }, 80); },
  denied: function () { beep(180, 140, "square", 0.04); },
  death: function () { beep(220, 220, "sawtooth", 0.05); },
  pop: function () { beep(520, 50, "sine", 0.05); },
  // The gulp blip when a Chomper eats a baby fish — a low swallow,
  // two notes down.
  gulp: function () { beep(300, 120, "sine", 0.08); setTimeout(function () { beep(170, 110, "sine", 0.06); }, 90); },
};
