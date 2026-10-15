/**
 * Web Audio API synthesizer for experimental chimes and cues.
 * Unlocks audio context on initial user gesture for mobile browser compliance.
 */

const SoundManager = (function() {
    let audioCtx = null;
    let soundEnabled = true;

    function initAudio() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    // Auto-unlock on first touch or click
    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('touchstart', initAudio, { once: true });

    function toggleSound() {
        initAudio();
        soundEnabled = !soundEnabled;
        return soundEnabled;
    }

    function playTone(type = 'cue') {
        if (!soundEnabled) return;
        initAudio();
        if (!audioCtx) return;

        try {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';

            if (type === 'cue') {
                // Neutral trial cue (A5 - 880Hz)
                osc.frequency.setValueAtTime(880.00, now);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.28);
            } else if (type === 'submit') {
                // Soft tactile feedback note (C5 - 523Hz)
                osc.frequency.setValueAtTime(523.25, now);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'hit') {
                // Cheerful upward chime (E5 -> G#5)
                osc.frequency.setValueAtTime(659.25, now);
                osc.frequency.setValueAtTime(830.61, now + 0.12);
                gain.gain.setValueAtTime(0.16, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.45);
            } else if (type === 'miss') {
                // Gentle lower note (G4 - 392Hz)
                osc.frequency.setValueAtTime(392.00, now);
                gain.gain.setValueAtTime(0.10, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.30);
            } else if (type === 'finish') {
                // Completion triple chord (C5 -> E5 -> G5)
                osc.frequency.setValueAtTime(523.25, now);
                osc.frequency.setValueAtTime(659.25, now + 0.15);
                osc.frequency.setValueAtTime(783.99, now + 0.30);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.75);
            }
        } catch (e) {
            console.warn('Audio playback error:', e);
        }
    }

    return {
        initAudio,
        toggleSound,
        playTone
    };
})();
