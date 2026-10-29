/**
 * Extra synth versions of some sounds, beyond each sound's own synth, as "sound.version".
 * Just the names, so settings can check them without loading the audio engine.
 * The sounds themselves are built in beepbox.ts.
 */
export const SYNTH_VERSIONS = ['chip.beepbox', 'lead.beepbox', 'pad.beepbox', 'bass.beepbox'] as const;
