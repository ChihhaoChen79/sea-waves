import * as THREE from 'three';
import { ZONES } from './starcatalog.js';

// Low-precision positional astronomy (good to a fraction of a degree), enough to
// put the Sun, Moon and stars where they really are for the viewer.

const RAD = Math.PI / 180;
const wrap = ( d ) => ( ( d % 360 ) + 360 ) % 360;

export const julian = ( ms ) => ms / 86400000 + 2440587.5;

// Where the viewer probably is, from their time zone (no permission prompt needed).
export function observer() {

	let zone = '';
	try {

		zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

	} catch ( e ) { /* ignore */ }

	const city = zone.split( '/' ).pop().replace( /_/g, ' ' );
	if ( ZONES[ zone ] ) return { lat: ZONES[ zone ][ 0 ], lon: ZONES[ zone ][ 1 ], place: city };
	const south = /^(Australia|Antarctica)|Auckland|Sao_Paulo|Argentina|Santiago|Montevideo|Asuncion|La_Paz|Lima|Johannesburg|Maputo|Harare|Windhoek|Lusaka|Fiji|Tahiti/.test( zone );
	return { lat: south ? - 30 : 35, lon: - new Date().getTimezoneOffset() / 4, place: city || 'your area' };

}

function sunRaDec( jd ) {

	const n = jd - 2451545;
	const L = 280.46 + 0.9856474 * n, g = ( 357.528 + 0.9856003 * n ) * RAD;
	const lam = ( L + 1.915 * Math.sin( g ) + 0.02 * Math.sin( 2 * g ) ) * RAD;
	const eps = ( 23.439 - 4e-7 * n ) * RAD;
	return {
		ra: Math.atan2( Math.cos( eps ) * Math.sin( lam ), Math.cos( lam ) ),
		dec: Math.asin( Math.sin( eps ) * Math.sin( lam ) )
	};

}

function moonRaDec( jd ) {

	const d = jd - 2451545;
	const L = 218.316 + 13.176396 * d;
	const M = ( 134.963 + 13.064993 * d ) * RAD;
	const F = ( 93.272 + 13.22935 * d ) * RAD;
	const D = ( 297.850 + 12.190749 * d ) * RAD;
	const Ms = ( 357.529 + 0.98560028 * d ) * RAD;
	const lam = ( L + 6.289 * Math.sin( M ) + 1.274 * Math.sin( 2 * D - M ) + 0.658 * Math.sin( 2 * D ) +
		0.214 * Math.sin( 2 * M ) - 0.186 * Math.sin( Ms ) - 0.114 * Math.sin( 2 * F ) ) * RAD;
	const bet = ( 5.128 * Math.sin( F ) + 0.281 * Math.sin( M + F ) + 0.278 * Math.sin( M - F ) + 0.173 * Math.sin( 2 * D - F ) ) * RAD;
	const eps = 23.439 * RAD;
	const x = Math.cos( bet ) * Math.cos( lam );
	const y = Math.cos( eps ) * Math.cos( bet ) * Math.sin( lam ) - Math.sin( eps ) * Math.sin( bet );
	const z = Math.sin( eps ) * Math.cos( bet ) * Math.sin( lam ) + Math.cos( eps ) * Math.sin( bet );
	return { ra: Math.atan2( y, x ), dec: Math.asin( z ) };

}

const lst = ( jd, lon ) => wrap( 280.46061837 + 360.98564736629 * ( jd - 2451545 ) + lon ) * RAD;

// Altitude and azimuth (from north, through east) of an equatorial position.
function altAz( ra, dec, jd, lat, lon ) {

	const H = lst( jd, lon ) - ra, phi = lat * RAD;
	const alt = Math.asin( Math.sin( dec ) * Math.sin( phi ) + Math.cos( dec ) * Math.cos( phi ) * Math.cos( H ) );
	const az = Math.atan2( - Math.sin( H ) * Math.cos( dec ), Math.cos( phi ) * Math.sin( dec ) - Math.sin( phi ) * Math.cos( dec ) * Math.cos( H ) );
	return { alt, az };

}

// The scene's compass: north is +Z, east is -X, up is +Y.
export function toWorld( alt, az, v = new THREE.Vector3() ) {

	return v.set( - Math.sin( az ) * Math.cos( alt ), Math.sin( alt ), Math.cos( az ) * Math.cos( alt ) );

}

export function sunDir( jd, o, v ) {

	const s = sunRaDec( jd ), h = altAz( s.ra, s.dec, jd, o.lat, o.lon );
	return toWorld( h.alt, h.az, v );

}

export function moonDir( jd, o, v ) {

	const m = moonRaDec( jd ), h = altAz( m.ra, m.dec, jd, o.lat, o.lon );
	// The Moon is close enough to sit about a degree lower than seen from Earth's centre.
	return toWorld( h.alt - 0.95 * RAD * Math.cos( h.alt ), h.az, v );

}

// Rotation taking equatorial unit vectors (x: RA 0h, y: RA 6h, z: north pole) into the scene.
export function skyRotation( jd, o, m ) {

	const b = ( ra, dec ) => {

		const h = altAz( ra, dec, jd, o.lat, o.lon );
		return toWorld( h.alt, h.az );

	};

	return m.makeBasis( b( 0, 0 ), b( Math.PI / 2, 0 ), b( 0, Math.PI / 2 ) );

}

const STEP = 5 * 60000;

// The real moment each time of day happens today (or tonight) for this viewer, and
// the sun's height to draw. Day scenes keep that sun still; night follows the clock.
export function plan( timeKey, o, now = Date.now() ) {

	const v = new THREE.Vector3();
	const altAt = ( ms ) => Math.asin( sunDir( julian( ms ), o, v ).y ) / RAD;

	if ( timeKey === 'night' ) {

		let ms = now;
		if ( altAt( now ) > - 12 ) {

			// Not dark yet: jump ahead to when it is properly dark tonight.
			let best = now, low = 90;
			for ( let t = now; t < now + 86400000; t += STEP ) {

				const a = altAt( t );
				if ( a < low ) {

					low = a;
					best = t;

				}

				if ( a < - 15 ) {

					best = t + 3600000;
					break;

				}

			}

			ms = best;

		}

		return { ms, live: true };

	}

	const day = new Date( now );
	day.setHours( 0, 0, 0, 0 );
	const t0 = day.getTime(), samples = [];
	for ( let t = t0; t <= t0 + 86400000; t += STEP ) samples.push( [ t, altAt( t ) ] );
	const peak = samples.reduce( ( a, b ) => ( b[ 1 ] > a[ 1 ] ? b : a ) );
	const iPeak = samples.indexOf( peak );

	const crossing = ( elev, rising ) => {

		const range = rising ? samples.slice( 0, iPeak + 1 ) : samples.slice( iPeak );
		for ( let i = 1; i < range.length; i ++ ) {

			const [ ta, a ] = range[ i - 1 ], [ tb, b ] = range[ i ];
			if ( rising ? a < elev && b >= elev : a >= elev && b < elev ) return ta + ( tb - ta ) * ( elev - a ) / ( b - a );

		}

		return null;

	};

	const target = { sunrise: [ 3, true ], morning: [ Math.min( 22, peak[ 1 ] * 0.6 ), true ], sunset: [ 2.5, false ] }[ timeKey ];
	let ms = target ? crossing( target[ 0 ], target[ 1 ] ) : peak[ 0 ];
	let elev = target ? target[ 0 ] : THREE.MathUtils.clamp( peak[ 1 ], 20, 75 );
	if ( ms === null ) ms = peak[ 0 ]; // midnight sun or polar night: fall back to midday
	if ( peak[ 1 ] < 3 ) elev = target ? target[ 0 ] : 20;
	const s = sunDir( julian( ms ), o, new THREE.Vector3() );
	const az = Math.atan2( - s.x, s.z );
	return { ms, live: false, sun: toWorld( elev * RAD, az ) };

}
