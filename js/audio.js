// Generative ambient soundscape: soft pads, slow bells, ocean swell, rain and thunder.
// Everything is synthesised with Web Audio, so there are no audio files to load.

const SCALES = {
	sunrise: { root: 62, chords: [ [ 0, 4, 7, 11, 14 ], [ 9, 12, 16, 19 ], [ 5, 9, 12, 16 ], [ 7, 11, 14, 17 ] ], bells: [ 0, 2, 4, 7, 9 ] },
	morning: { root: 65, chords: [ [ 0, 4, 7, 14 ], [ 5, 9, 12, 16 ], [ 9, 12, 16, 19 ], [ 7, 11, 14, 19 ] ], bells: [ 0, 2, 4, 7, 9 ] },
	noon: { root: 60, chords: [ [ 0, 4, 7, 11 ], [ 5, 9, 12, 16 ], [ 2, 5, 9, 12 ], [ 7, 11, 14, 17 ] ], bells: [ 0, 2, 4, 7, 9 ] },
	sunset: { root: 57, chords: [ [ 0, 3, 7, 10, 14 ], [ 8, 12, 15, 19 ], [ 5, 8, 12, 15 ], [ 3, 7, 10, 14 ] ], bells: [ 0, 3, 5, 7, 10 ] },
	night: { root: 55, chords: [ [ 0, 3, 7, 14 ], [ 8, 12, 15, 19 ], [ 3, 7, 10, 14 ], [ 10, 14, 17, 21 ] ], bells: [ 0, 3, 5, 7, 10 ] }
};

// ---------- User music settings ----------

export const NOTE_NAMES = [ 'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B' ];

// scale: semitones from the root. prog: the chord on each scale degree, in order.
// size: notes per chord, stacked in thirds (every other scale note).
// harmony: a fuller scale to build chords from when the melody scale is sparse.
export const MODES = {
	major: { label: 'Major', scale: [ 0, 2, 4, 5, 7, 9, 11 ], prog: [ 0, 5, 3, 4 ], size: 4 },
	minor: { label: 'Minor', scale: [ 0, 2, 3, 5, 7, 8, 10 ], prog: [ 0, 5, 2, 6 ], size: 4 },
	dorian: { label: 'Dorian', scale: [ 0, 2, 3, 5, 7, 9, 10 ], prog: [ 0, 3, 0, 6 ], size: 4 },
	lydian: { label: 'Lydian', scale: [ 0, 2, 4, 6, 7, 9, 11 ], prog: [ 0, 1, 0, 4 ], size: 4 },
	mixolydian: { label: 'Mixolydian', scale: [ 0, 2, 4, 5, 7, 9, 10 ], prog: [ 0, 6, 3, 0 ], size: 4 },
	pentatonic: { label: 'Pentatonic', scale: [ 0, 2, 4, 7, 9 ], harmony: [ 0, 2, 4, 5, 7, 9, 11 ], prog: [ 0, 5, 3, 4 ], size: 3 },
	jazz: { label: 'Jazz', scale: [ 0, 2, 4, 5, 7, 9, 11 ], prog: [ 1, 4, 0, 5 ], size: 5 },
	japanese: { label: 'Japanese', scale: [ 0, 1, 5, 7, 8 ], prog: [ 0, 3, 4, 0 ], size: 4 }
};

export const INSTRUMENTS = { bells: 'Bells', piano: 'Piano', harp: 'Harp', flute: 'Flute', marimba: 'Marimba', kalimba: 'Kalimba' };

// The built-in, time-of-day music above (SCALES) is what "auto" means everywhere.
// reverb: echo amount; tone: 0 warm … 1 bright; melody: 0 chords only … 1 melody to the fore.
export const DEFAULT_COMPOSER = { key: 'auto', mode: 'auto', instrument: 'bells', pace: 1, reverb: 0.55, tone: 0.45, melody: 0.5 };

// A metronome in a Web Worker. A background tab's own timers get throttled hard
// (in Chrome eventually to once a minute), which made the music lag and turn to noise;
// worker timers keep much better time.
function workerClock( tick, ms ) {

	try {

		const url = URL.createObjectURL( new Blob( [ `setInterval( () => postMessage( 0 ), ${ ms } );` ], { type: 'text/javascript' } ) );
		const worker = new Worker( url );
		URL.revokeObjectURL( url );
		worker.onmessage = tick;
		return { stop: () => worker.terminate() };

	} catch ( e ) {

		const id = setInterval( tick, ms );
		return { stop: () => clearInterval( id ) };

	}

}

const IOS = /iP(hone|ad|od)/.test( navigator.userAgent ) || ( navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 );

// Chord on a scale degree, stacked in thirds, as semitones from the root.
function stack( scale, degree, size ) {

	return Array.from( { length: size }, ( _, i ) => {

		const k = degree + 2 * i;
		return scale[ k % scale.length ] + 12 * Math.floor( k / scale.length );

	} );

}

const midi = ( n ) => 440 * Math.pow( 2, ( n - 69 ) / 12 );
const rand = ( a, b ) => a + Math.random() * ( b - a );

export class Soundscape {

	constructor() {

		this.ctx = null;
		this.musicOn = true;
		this.ambientOn = true;
		this.musicVolume = 0.8;
		this.ambientVolume = 0.8;
		this.mood = 'morning';
		this.composer = { ...DEFAULT_COMPOSER };
		this.rain = 0;
		this.swell = 0.5;
		this.chordIndex = 0;

	}

	// Must be called from a user gesture (tap) for iOS Safari.
	start() {

		if ( this.ctx ) {

			this.ctx.resume();
			return;

		}

		// Let audio play even when the iPhone ring/silent switch is on silent (Safari 17+).
		try {

			if ( navigator.audioSession ) navigator.audioSession.type = 'playback';

		} catch ( e ) { /* not supported */ }

		// 'playback' asks for larger audio buffers: a little more delay (irrelevant for
		// ambient music) in exchange for no dropouts on slower outputs such as CarPlay,
		// where small buffers crackle while the phone is also busy drawing the scene.
		const Ctx = window.AudioContext || window.webkitAudioContext;
		let ctx;
		try {

			ctx = new Ctx( { latencyHint: 'playback' } );

		} catch ( e ) {

			ctx = new Ctx();

		}

		this.ctx = ctx;
		this.stale = false;

		// If the output changes while playing (CarPlay or headphones connecting) or iOS
		// interrupts the audio, rebuild the engine on the next tap so it matches the new
		// output; audio started for one output can sound distorted on another.
		ctx.onstatechange = () => {

			if ( ctx.state === 'interrupted' ) this.stale = true;

		};

		if ( ! this.watchingDevices && navigator.mediaDevices?.addEventListener ) {

			this.watchingDevices = true;
			navigator.mediaDevices.addEventListener( 'devicechange', () => {

				this.stale = true;

			} );

		}

		this.master = ctx.createGain();
		this.master.gain.value = 0;
		// Gentle limiter with headroom so a car amplifier is never driven into distortion
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = - 16;
		comp.knee.value = 12;
		comp.ratio.value = 4;
		this.master.connect( comp ).connect( ctx.destination );
		this.master.gain.linearRampToValueAtTime( 0.75, ctx.currentTime + 3 );

		// Two buses, each with its own echo, so either can be switched off completely:
		// music (pads and bells) and ambient (sea, rain, thunder, whales, gulls).
		const room = this.impulse( 3.5 );
		const bus = ( level ) => {

			const gain = ctx.createGain(), verb = ctx.createConvolver(), wet = ctx.createGain();
			gain.gain.value = 0;
			verb.buffer = room;
			wet.gain.value = 0.55;
			gain.connect( this.master );
			verb.connect( wet ).connect( gain );
			return { gain, verb, wet, level };

		};

		this.musicBus = bus( 0.5 );
		this.music = ctx.createGain();
		this.music.connect( this.musicBus.gain );
		this.musicVerbOn = false;
		// The melody voice has its own level, for the melody/chords balance.
		this.melodyOut = ctx.createGain();
		this.melodyOut.connect( this.music );
		this.applyMix();
		this.ambientBus = bus( 1 );
		this.ambient = this.ambientBus.gain;
		this.reverb = this.ambientBus.verb;
		this.fade( this.musicBus, this.musicOn, this.musicVolume );
		this.fade( this.ambientBus, this.ambientOn, this.ambientVolume );

		this.brown = this.noiseBuffer( 'brown' );
		this.white = this.noiseBuffer( 'white' );

		this.startOcean();
		this.startRain();

		this.nextChord = ctx.currentTime + 0.5;
		this.nextBell = ctx.currentTime + 4;
		this.nextSurge = ctx.currentTime;
		this.lastTick = performance.now();
		this.clock = workerClock( () => this.schedule(), 250 );
		if ( this.listening ) return;
		this.listening = true;

		// Keep playing in a background tab or minimised window, like a music player.
		// When hidden, timers may run only about once a second, so schedule further
		// ahead then. Coming back: if the system interrupted the audio or the clock
		// stalled while away, rebuild it straight away where the browser allows that
		// (desktop browsers, once the page has been used); on iOS, on the next tap.
		document.addEventListener( 'visibilitychange', () => {

			if ( ! this.ctx ) return;
			if ( document.hidden ) return this.schedule();
			if ( this.stale && ! IOS && navigator.userActivation?.hasBeenActive !== false ) this.rebuildIfStale();
			else this.ctx.resume();

		} );

	}

	// Throw the audio engine away and build a fresh one for the current output. Must run
	// inside a tap (iOS only starts audio from a user gesture). Settings are kept.
	rebuildIfStale() {

		if ( ! this.ctx || ! this.stale ) return;
		this.clock.stop();
		const old = this.ctx;
		this.ctx = null;
		old.close().catch( () => {} );
		this.start();

	}

	// Volume 0..1 per channel; 0.8 is the original mix, and the curve is squared so
	// the slider feels even to the ear.
	setMusic( on, volume = 0.8 ) {

		this.musicOn = on && volume > 0;
		this.musicVolume = volume;
		this.fade( this.musicBus, this.musicOn, volume );

	}

	setAmbient( on, volume = 0.8 ) {

		this.ambientOn = on && volume > 0;
		this.ambientVolume = volume;
		this.fade( this.ambientBus, this.ambientOn, volume );

	}

	fade( bus, on, volume ) {

		// The music echo only runs while music is on (convolution is the costliest part).
		if ( bus === this.musicBus && this.music && on !== this.musicVerbOn ) {

			if ( on ) this.music.connect( bus.verb );
			else this.music.disconnect( bus.verb );
			this.musicVerbOn = on;

		}

		if ( this.ctx ) bus.gain.gain.setTargetAtTime( on ? bus.level * ( volume / 0.8 ) ** 2 : 0, this.ctx.currentTime, 0.15 );

	}

	// What to play now: the time-of-day default (SCALES), with the user's key and
	// scale applied on top when they've chosen them.
	song() {

		const base = SCALES[ this.mood ] || SCALES.morning;
		const c = this.composer;
		// Keep a chosen key in the same gentle register as the defaults (G3 to F♯4)
		const root = c.key === 'auto' ? base.root : 55 + ( ( c.key - 7 + 12 ) % 12 );
		const m = MODES[ c.mode ];
		if ( ! m ) return { root, chords: base.chords, bells: base.bells };
		const harmony = m.harmony || m.scale;
		return { root, chords: m.prog.map( ( d ) => stack( harmony, d, m.size ) ), bells: m.scale };

	}

	setComposer( c ) {

		const changed = JSON.stringify( c ) !== JSON.stringify( this.composer );
		this.composer = { ...DEFAULT_COMPOSER, ...c };
		this.applyMix();
		if ( ! changed || ! this.ctx || ! this.musicOn ) return;
		// Mixing changes alone are heard as they are; no need to restart the chords.
		if ( [ 'key', 'mode', 'instrument', 'pace' ].every( ( k ) => c[ k ] === this.heard?.[ k ] ) ) return;
		this.heard = { ...this.composer };
		// Let the change be heard straight away: a new chord and a melody note shortly.
		const now = this.ctx.currentTime;
		this.chordIndex = 0;
		this.nextChord = Math.min( this.nextChord, now + 0.25 );
		this.nextBell = Math.min( this.nextBell, now + 0.4 );

	}

	// Reverb, tone and melody level take effect immediately, smoothly.
	applyMix() {

		if ( ! this.ctx || ! this.melodyOut ) return;
		const c = this.composer, t = this.ctx.currentTime;
		this.musicBus.wet.gain.setTargetAtTime( c.reverb, t, 0.2 );
		// melody 0.5 is the original balance; 0 silences it, 1 doubles it
		this.melodyOut.gain.setTargetAtTime( Math.min( 2, ( c.melody * 2 ) ** 1.5 ), t, 0.2 );
		// Tone: the chords' soft filter, from 350 Hz (warm) to 3.2 kHz (bright); 0.45 ≈ the original 900 Hz
		this.padCutoff = 350 * Math.pow( 3200 / 350, c.tone );

	}

	// e.g. "D major · Bells · 1.0×" for the settings page.
	describe() {

		const s = this.song(), c = this.composer;
		const key = NOTE_NAMES[ s.root % 12 ];
		const mode = MODES[ c.mode ]?.label.toLowerCase() || ( s.bells.includes( 3 ) ? 'minor' : 'major' );
		return `${ c.key === 'auto' && c.mode === 'auto' ? 'Auto: ' : '' }${ key } ${ mode } · ${ INSTRUMENTS[ c.instrument ] } · ${ c.pace.toFixed( 1 ) }×`;

	}

	setScene( time, weather ) {

		this.mood = time === 'twilight' ? 'night' : time;
		this.rain = { rain: 0.7, storm: 1 }[ weather ] || 0;
		this.swell = { clear: 0.45, cloudy: 0.55, rain: 0.65, storm: 1, fog: 0.35 }[ weather ] ?? 0.5;
		this.storm = weather === 'storm';
		if ( ! this.ctx ) return;
		const t = this.ctx.currentTime;
		this.rainGain.gain.setTargetAtTime( this.rain * 0.22, t, 1.5 );
		this.oceanFilter.frequency.setTargetAtTime( 380 + this.swell * 500, t, 2 );

	}

	impulse( seconds ) {

		const ctx = this.ctx, len = ctx.sampleRate * seconds;
		const buf = ctx.createBuffer( 2, len, ctx.sampleRate );
		for ( let c = 0; c < 2; c ++ ) {

			const d = buf.getChannelData( c );
			for ( let i = 0; i < len; i ++ ) d[ i ] = ( Math.random() * 2 - 1 ) * Math.pow( 1 - i / len, 3 );

		}

		return buf;

	}

	noiseBuffer( type ) {

		const ctx = this.ctx, len = ctx.sampleRate * 4;
		const buf = ctx.createBuffer( 1, len, ctx.sampleRate );
		const d = buf.getChannelData( 0 );
		let last = 0;
		for ( let i = 0; i < len; i ++ ) {

			const w = Math.random() * 2 - 1;
			if ( type === 'brown' ) {

				last = ( last + 0.02 * w ) / 1.02;
				d[ i ] = last * 3.5;

			} else d[ i ] = w;

		}

		return buf;

	}

	loop( buffer ) {

		const src = this.ctx.createBufferSource();
		src.buffer = buffer;
		src.loop = true;
		src.start( 0, Math.random() * 3 );
		return src;

	}

	startOcean() {

		const ctx = this.ctx;
		this.oceanFilter = ctx.createBiquadFilter();
		this.oceanFilter.type = 'lowpass';
		this.oceanFilter.frequency.value = 600;
		this.oceanGain = ctx.createGain();
		this.oceanGain.gain.value = 0.2;
		this.loop( this.brown ).connect( this.oceanFilter ).connect( this.oceanGain ).connect( this.ambient );

	}

	startRain() {

		const ctx = this.ctx;
		const hp = ctx.createBiquadFilter();
		hp.type = 'highpass';
		hp.frequency.value = 1400;
		const lp = ctx.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.value = 7000;
		this.rainGain = ctx.createGain();
		this.rainGain.gain.value = this.rain * 0.22;
		this.loop( this.white ).connect( hp ).connect( lp ).connect( this.rainGain ).connect( this.ambient );

	}

	thunder( delay = rand( 0.4, 2.5 ) ) {

		if ( ! this.ctx ) return;
		const ctx = this.ctx, t = ctx.currentTime + delay;
		const src = ctx.createBufferSource();
		src.buffer = this.brown;
		const lp = ctx.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.setValueAtTime( 900, t );
		lp.frequency.exponentialRampToValueAtTime( 120, t + 3 );
		const g = ctx.createGain();
		g.gain.setValueAtTime( 0, t );
		g.gain.linearRampToValueAtTime( 0.9, t + 0.08 );
		g.gain.exponentialRampToValueAtTime( 0.001, t + rand( 3, 5.5 ) );
		src.connect( lp ).connect( g ).connect( this.ambient );
		g.connect( this.reverb );
		src.start( t, Math.random() * 2 );
		src.stop( t + 6 );

	}

	// Route a one-shot sound through an optional stereo pan.
	out( pan ) {

		if ( ! this.ctx.createStereoPanner ) return this.ambient;
		const p = this.ctx.createStereoPanner();
		p.pan.value = pan;
		p.connect( this.ambient );
		return p;

	}

	splash( level, delay = 0, pan = 0 ) {

		if ( ! this.ctx || level < 0.02 ) return;
		const ctx = this.ctx, t = ctx.currentTime + delay, len = 1.2 + level * 2.5;
		const src = ctx.createBufferSource();
		src.buffer = this.white;
		const lp = ctx.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.setValueAtTime( 2500, t );
		lp.frequency.exponentialRampToValueAtTime( 300, t + len );
		const g = ctx.createGain();
		g.gain.setValueAtTime( 0, t );
		g.gain.linearRampToValueAtTime( 0.5 * level, t + 0.04 );
		g.gain.exponentialRampToValueAtTime( 0.001, t + len );
		const out = this.out( pan );
		src.connect( lp ).connect( g ).connect( out );
		g.connect( this.reverb );
		src.start( t, Math.random() * 2 );
		src.stop( t + len + 0.1 );

		// The deep "whump" of a body hitting the water
		const thud = ctx.createOscillator();
		thud.frequency.setValueAtTime( 90, t );
		thud.frequency.exponentialRampToValueAtTime( 35, t + 0.6 );
		const tg = ctx.createGain();
		tg.gain.setValueAtTime( 0.6 * level, t );
		tg.gain.exponentialRampToValueAtTime( 0.001, t + 0.8 );
		thud.connect( tg ).connect( out );
		thud.start( t );
		thud.stop( t + 0.9 );

	}

	spout( level, delay = 0, pan = 0 ) {

		if ( ! this.ctx ) return;
		const ctx = this.ctx, t = ctx.currentTime + delay;
		const src = ctx.createBufferSource();
		src.buffer = this.white;
		const bp = ctx.createBiquadFilter();
		bp.type = 'bandpass';
		bp.frequency.setValueAtTime( 700, t );
		bp.frequency.linearRampToValueAtTime( 1100, t + 1.2 );
		bp.Q.value = 0.7;
		const g = ctx.createGain();
		g.gain.setValueAtTime( 0, t );
		g.gain.linearRampToValueAtTime( 0.35 * level, t + 0.15 );
		g.gain.exponentialRampToValueAtTime( 0.001, t + 1.8 );
		src.connect( bp ).connect( g ).connect( this.out( pan ) );
		g.connect( this.reverb );
		src.start( t, Math.random() * 2 );
		src.stop( t + 2 );

	}

	// A short "kee-ow" call, sometimes repeated.
	gull( level, delay = 0, pan = 0 ) {

		if ( ! this.ctx || level < 0.03 ) return;
		const ctx = this.ctx, out = this.out( pan );
		const calls = 1 + Math.floor( Math.random() * 3 ), base = rand( 1500, 1900 );
		for ( let i = 0; i < calls; i ++ ) {

			const t = ctx.currentTime + delay + i * rand( 0.28, 0.4 ), len = rand( 0.22, 0.35 );
			const o = ctx.createOscillator();
			o.type = 'sawtooth';
			o.frequency.setValueAtTime( base * 0.8, t );
			o.frequency.linearRampToValueAtTime( base * 1.1, t + len * 0.25 );
			o.frequency.exponentialRampToValueAtTime( base * 0.6, t + len );
			const bp = ctx.createBiquadFilter();
			bp.type = 'bandpass';
			bp.frequency.value = base * 1.3;
			bp.Q.value = 3;
			const g = ctx.createGain();
			g.gain.setValueAtTime( 0, t );
			g.gain.linearRampToValueAtTime( 0.07 * level, t + 0.03 );
			g.gain.exponentialRampToValueAtTime( 0.001, t + len );
			o.connect( bp ).connect( g ).connect( out );
			g.connect( this.reverb );
			o.start( t );
			o.stop( t + len + 0.05 );

		}

	}

	schedule() {

		const ctx = this.ctx, now = ctx.currentTime, ahead = now + ( document.hidden ? 5 : 0.6 );
		// A long gap between ticks means the page was frozen or starved; the audio
		// engine may come back in a bad state, so rebuild it at the next chance.
		const wall = performance.now();
		if ( wall - this.lastTick > 4000 ) this.stale = true;
		this.lastTick = wall;
		const s = this.song(), pace = this.composer.pace;
		// After a long stall, skip what was missed rather than playing it all at once.
		this.nextSurge = Math.max( this.nextSurge, now );
		this.nextChord = Math.max( this.nextChord, now );
		this.nextBell = Math.max( this.nextBell, now );

		// Ocean surges: slow swells of the wash, like waves rolling past.
		while ( this.nextSurge < ahead ) {

			const t = this.nextSurge, len = rand( 5, 9 ) - this.swell * 2;
			const g = this.oceanGain.gain;
			const peak = 0.18 + this.swell * 0.35;
			g.setTargetAtTime( peak * rand( 0.7, 1 ), t, len * 0.25 );
			g.setTargetAtTime( 0.07 + this.swell * 0.08, t + len * 0.5, len * 0.22 );
			this.nextSurge = t + len;

		}

		// Music is skipped entirely while switched off (the clock still advances).
		if ( ! this.musicOn ) {

			this.nextChord = Math.max( this.nextChord, ahead );
			this.nextBell = Math.max( this.nextBell, ahead );
			return;

		}

		// Pad chords, slower at night
		while ( this.nextChord < ahead ) {

			const t = this.nextChord;
			const dur = ( this.mood === 'night' ? 13 : 10 ) / pace;
			const chord = s.chords[ this.chordIndex ++ % s.chords.length ];
			chord.forEach( ( n, i ) => this.pad( midi( s.root + n - 12 ), t + i * 0.12, dur + 3 ) );
			this.pad( midi( s.root + chord[ 0 ] - 24 ), t, dur + 3, 0.05 );
			this.nextChord = t + dur;

		}

		// Sparse melody on the chosen instrument
		while ( this.nextBell < ahead ) {

			const t = this.nextBell;
			const oct = Math.random() < 0.3 ? 24 : 12;
			const n = s.bells[ Math.floor( Math.random() * s.bells.length ) ];
			this.melody( midi( s.root + n + oct ), t );
			if ( Math.random() < 0.35 ) {

				const n2 = s.bells[ Math.floor( Math.random() * s.bells.length ) ];
				this.melody( midi( s.root + n2 + oct ), t + rand( 0.4, 0.9 ) / pace, 0.6 );

			}

			this.nextBell = t + rand( 2.5, 6.5 ) / pace;

		}

	}

	pad( freq, t, dur, level = 0.035 ) {

		const ctx = this.ctx;
		const lp = ctx.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.value = this.padCutoff || 900;
		lp.Q.value = 0.3;
		const g = ctx.createGain();
		g.gain.setValueAtTime( 0, t );
		g.gain.linearRampToValueAtTime( level, t + dur * 0.35 );
		g.gain.setValueAtTime( level, t + dur * 0.55 );
		g.gain.linearRampToValueAtTime( 0, t + dur );
		lp.connect( g ).connect( this.music );

		for ( const [ type, detune ] of [ [ 'sine', - 6 ], [ 'triangle', 7 ] ] ) {

			const o = ctx.createOscillator();
			o.type = type;
			o.frequency.value = freq;
			o.detune.value = detune;
			o.connect( lp );
			o.start( t );
			o.stop( t + dur + 0.1 );

		}

	}

	melody( freq, t, level = 1 ) {

		const play = { piano: this.piano, harp: this.harp, flute: this.flute, marimba: this.marimba, kalimba: this.kalimba }[ this.composer.instrument ] || this.bell;
		play.call( this, freq, t, level );

	}

	// One note: sine partials [ frequency ratio, level, decay seconds ] into the music bus.
	partials( freq, t, level, list, attack = 0.005 ) {

		const ctx = this.ctx;
		for ( const [ mul, amp, decay, type = 'sine' ] of list ) {

			const o = ctx.createOscillator(), g = ctx.createGain();
			o.type = type;
			o.frequency.value = freq * mul;
			g.gain.setValueAtTime( 0, t );
			g.gain.linearRampToValueAtTime( amp * level, t + attack );
			g.gain.exponentialRampToValueAtTime( 0.0001, t + decay );
			o.connect( g ).connect( this.melodyOut );
			o.start( t );
			o.stop( t + decay + 0.05 );

		}

	}

	piano( freq, t, level ) {

		// Soft felt piano: a warm fundamental, a quick bright edge, slightly detuned strings
		this.partials( freq, t, level, [ [ 1, 0.05, 3.2 ], [ 1.003, 0.03, 2.6, 'triangle' ], [ 2, 0.012, 1.2 ], [ 3, 0.005, 0.5 ] ] );

	}

	harp( freq, t, level ) {

		// Plucked string: bright at the pluck, mellowing as it rings
		const ctx = this.ctx;
		const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
		o.type = 'sawtooth';
		o.frequency.value = freq;
		lp.type = 'lowpass';
		lp.frequency.setValueAtTime( freq * 6, t );
		lp.frequency.exponentialRampToValueAtTime( freq * 1.2, t + 0.8 );
		g.gain.setValueAtTime( 0, t );
		g.gain.linearRampToValueAtTime( 0.035 * level, t + 0.004 );
		g.gain.exponentialRampToValueAtTime( 0.0001, t + 2.6 );
		o.connect( lp ).connect( g ).connect( this.melodyOut );
		o.start( t );
		o.stop( t + 2.7 );

	}

	flute( freq, t, level ) {

		// Breathy, slow to speak, with a gentle vibrato
		const ctx = this.ctx, len = 1.6;
		const o = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), depth = ctx.createGain();
		o.frequency.value = freq;
		vib.frequency.value = 5;
		depth.gain.value = freq * 0.004;
		vib.connect( depth ).connect( o.frequency );
		g.gain.setValueAtTime( 0, t );
		g.gain.linearRampToValueAtTime( 0.045 * level, t + 0.18 );
		g.gain.setValueAtTime( 0.045 * level, t + len - 0.5 );
		g.gain.linearRampToValueAtTime( 0, t + len );
		o.connect( g ).connect( this.melodyOut );
		const breath = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), bg = ctx.createGain();
		breath.buffer = this.white;
		bp.type = 'bandpass';
		bp.frequency.value = freq * 2;
		bp.Q.value = 2;
		bg.gain.setValueAtTime( 0, t );
		bg.gain.linearRampToValueAtTime( 0.012 * level, t + 0.06 );
		bg.gain.linearRampToValueAtTime( 0.003 * level, t + 0.4 );
		bg.gain.linearRampToValueAtTime( 0, t + len );
		breath.connect( bp ).connect( bg ).connect( this.melodyOut );
		for ( const n of [ o, vib ] ) {

			n.start( t );
			n.stop( t + len + 0.05 );

		}

		breath.start( t, Math.random() * 3 );
		breath.stop( t + len + 0.05 );

	}

	marimba( freq, t, level ) {

		// Wooden bar: short, round fundamental and a bright, very short overtone
		this.partials( freq, t, level, [ [ 1, 0.07, 1.1 ], [ 3.93, 0.025, 0.18 ], [ 9.2, 0.006, 0.05 ] ], 0.003 );

	}

	kalimba( freq, t, level ) {

		// Thumb piano: a clear tine with its characteristic high, inharmonic ring
		this.partials( freq, t, level, [ [ 1, 0.06, 2.2 ], [ 5.4, 0.018, 0.35 ], [ 2.01, 0.008, 0.9 ] ], 0.003 );

	}

	bell( freq, t, level = 1 ) {

		const ctx = this.ctx;
		const g = ctx.createGain();
		g.gain.setValueAtTime( 0, t );
		g.gain.linearRampToValueAtTime( 0.06 * level, t + 0.02 );
		g.gain.exponentialRampToValueAtTime( 0.0005, t + 4 );
		g.connect( this.melodyOut );
		for ( const [ mul, amp ] of [ [ 1, 1 ], [ 2.01, 0.25 ], [ 3.0, 0.08 ] ] ) {

			const o = ctx.createOscillator();
			const og = ctx.createGain();
			o.type = 'sine';
			o.frequency.value = freq * mul;
			og.gain.value = amp;
			o.connect( og ).connect( g );
			o.start( t );
			o.stop( t + 4.2 );

		}

	}

}
