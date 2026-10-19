// Generative ambient soundscape: soft pads, slow bells, ocean swell, rain and thunder.
// Everything is synthesised with Web Audio, so there are no audio files to load.

const SCALES = {
	sunrise: { root: 62, chords: [ [ 0, 4, 7, 11, 14 ], [ 9, 12, 16, 19 ], [ 5, 9, 12, 16 ], [ 7, 11, 14, 17 ] ], bells: [ 0, 2, 4, 7, 9 ] },
	morning: { root: 65, chords: [ [ 0, 4, 7, 14 ], [ 5, 9, 12, 16 ], [ 9, 12, 16, 19 ], [ 7, 11, 14, 19 ] ], bells: [ 0, 2, 4, 7, 9 ] },
	noon: { root: 60, chords: [ [ 0, 4, 7, 11 ], [ 5, 9, 12, 16 ], [ 2, 5, 9, 12 ], [ 7, 11, 14, 17 ] ], bells: [ 0, 2, 4, 7, 9 ] },
	sunset: { root: 57, chords: [ [ 0, 3, 7, 10, 14 ], [ 8, 12, 15, 19 ], [ 5, 8, 12, 15 ], [ 3, 7, 10, 14 ] ], bells: [ 0, 3, 5, 7, 10 ] },
	night: { root: 55, chords: [ [ 0, 3, 7, 14 ], [ 8, 12, 15, 19 ], [ 3, 7, 10, 14 ], [ 10, 14, 17, 21 ] ], bells: [ 0, 3, 5, 7, 10 ] }
};

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

		const ctx = this.ctx = new ( window.AudioContext || window.webkitAudioContext )();

		this.master = ctx.createGain();
		this.master.gain.value = 0;
		const comp = ctx.createDynamicsCompressor();
		this.master.connect( comp ).connect( ctx.destination );
		this.master.gain.linearRampToValueAtTime( 0.9, ctx.currentTime + 3 );

		// Two buses, each with its own echo, so either can be switched off completely:
		// music (pads and bells) and ambient (sea, rain, thunder, whales, gulls).
		const room = this.impulse( 5.5 );
		const bus = ( level ) => {

			const gain = ctx.createGain(), verb = ctx.createConvolver(), wet = ctx.createGain();
			gain.gain.value = 0;
			verb.buffer = room;
			wet.gain.value = 0.55;
			gain.connect( this.master );
			verb.connect( wet ).connect( gain );
			return { gain, verb, level };

		};

		this.musicBus = bus( 0.5 );
		this.music = ctx.createGain();
		this.music.connect( this.musicBus.gain );
		this.music.connect( this.musicBus.verb );
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
		this.timer = setInterval( () => this.schedule(), 250 );

		// iOS sometimes interrupts the context (calls, Siri, background); resume when back.
		document.addEventListener( 'visibilitychange', () => {

			if ( document.hidden ) ctx.suspend();
			else ctx.resume();

		} );

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

		if ( this.ctx ) bus.gain.gain.setTargetAtTime( on ? bus.level * ( volume / 0.8 ) ** 2 : 0, this.ctx.currentTime, 0.15 );

	}

	setScene( time, weather ) {

		this.mood = time;
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

		const ctx = this.ctx, now = ctx.currentTime, ahead = now + 0.6;
		const s = SCALES[ this.mood ] || SCALES.morning;

		// Ocean surges: slow swells of the wash, like waves rolling past.
		if ( this.nextSurge < ahead ) {

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
		if ( this.nextChord < ahead ) {

			const t = this.nextChord;
			const dur = this.mood === 'night' ? 13 : 10;
			const chord = s.chords[ this.chordIndex ++ % s.chords.length ];
			chord.forEach( ( n, i ) => this.pad( midi( s.root + n - 12 ), t + i * 0.12, dur + 3 ) );
			this.pad( midi( s.root + chord[ 0 ] - 24 ), t, dur + 3, 0.05 );
			this.nextChord = t + dur;

		}

		// Sparse bell melody
		if ( this.nextBell < ahead ) {

			const t = this.nextBell;
			const oct = Math.random() < 0.3 ? 24 : 12;
			const n = s.bells[ Math.floor( Math.random() * s.bells.length ) ];
			this.bell( midi( s.root + n + oct ), t );
			if ( Math.random() < 0.35 ) {

				const n2 = s.bells[ Math.floor( Math.random() * s.bells.length ) ];
				this.bell( midi( s.root + n2 + oct ), t + rand( 0.4, 0.9 ), 0.6 );

			}

			this.nextBell = t + rand( 2.5, 6.5 );

		}

	}

	pad( freq, t, dur, level = 0.035 ) {

		const ctx = this.ctx;
		const lp = ctx.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.value = 900;
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

	bell( freq, t, level = 1 ) {

		const ctx = this.ctx;
		const g = ctx.createGain();
		g.gain.setValueAtTime( 0, t );
		g.gain.linearRampToValueAtTime( 0.06 * level, t + 0.02 );
		g.gain.exponentialRampToValueAtTime( 0.0005, t + 4 );
		g.connect( this.music );
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
