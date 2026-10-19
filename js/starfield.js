import * as THREE from 'three';
import { STARS, CONSTELLATIONS } from './starcatalog.js';
import { CLOUD_GLSL } from './ocean.js';

const RADIUS = 14000;

const equatorial = ( raHours, decDeg, v = new THREE.Vector3() ) => {

	const ra = raHours * Math.PI / 12, dec = decDeg * Math.PI / 180;
	return v.set( Math.cos( dec ) * Math.cos( ra ), Math.cos( dec ) * Math.sin( ra ), Math.sin( dec ) );

};

// Galactic → equatorial (J2000), used to crowd the faint background stars into the Milky Way.
const GAL_TO_EQ = new THREE.Matrix3().set(
	- 0.0548755604, 0.4941094279, - 0.8676661490,
	- 0.8734370902, - 0.4448296300, - 0.1980763734,
	- 0.4838350155, 0.7469822445, 0.4559837762
);

function mulberry32( a ) {

	return () => {

		a |= 0;
		a = a + 0x6D2B79F5 | 0;
		let t = Math.imul( a ^ a >>> 15, 1 | a );
		t = t + Math.imul( t ^ t >>> 7, 61 | t ) ^ t;
		return ( ( t ^ t >>> 14 ) >>> 0 ) / 4294967296;

	};

}

const SHARED = /* glsl */`
	uniform float time;
	uniform float cloudCover;
	uniform float visible;
	${CLOUD_GLSL}
	// How much of the sky shows through at this direction: clouds and the thick air near the horizon.
	float clearSky( vec3 dir ) {
		float n = dir.y > 0.0 ? cloudNoise( dir, time ) : 0.0;
		return ( 1.0 - cloudDensity( n, dir.y, cloudCover ) ) * smoothstep( - 0.01, 0.18, dir.y );
	}`;

export class StarField {

	constructor( scene, labelLayer ) {

		this.group = new THREE.Group();
		this.group.matrixAutoUpdate = false;
		this.group.frustumCulled = false;
		this.rotation = new THREE.Matrix4();

		const uniforms = {
			time: { value: 0 },
			cloudCover: { value: 0 },
			visible: { value: 0 },
			pixelRatio: { value: 1 },
			lines: { value: 0 }
		};
		this.uniforms = uniforms;

		// Catalogue stars plus a seeded scatter of faint ones (decoration, not catalogued).
		const pos = [], mag = [], col = [];
		const c = new THREE.Color();
		for ( const key in STARS ) {

			const [ ra, dec, m, hex ] = STARS[ key ];
			pos.push( ...equatorial( ra, dec ).toArray() );
			mag.push( m );
			c.set( hex );
			col.push( c.r, c.g, c.b );

		}

		const rnd = mulberry32( 7 ), v = new THREE.Vector3();
		for ( let i = 0; i < 1800; i ++ ) {

			if ( rnd() < 0.45 ) {

				// Near the galactic plane
				const l = rnd() * Math.PI * 2, b = ( rnd() + rnd() + rnd() - 1.5 ) * 0.22;
				v.set( Math.cos( b ) * Math.cos( l ), Math.cos( b ) * Math.sin( l ), Math.sin( b ) ).applyMatrix3( GAL_TO_EQ );

			} else {

				const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt( 1 - z * z );
				v.set( r * Math.cos( a ), r * Math.sin( a ), z );

			}

			pos.push( v.x, v.y, v.z );
			mag.push( 4.2 + Math.pow( rnd(), 0.6 ) * 2 );
			c.setHSL( 0.08 + rnd() * 0.55, 0.3, 0.85 );
			col.push( c.r, c.g, c.b );

		}

		const g = new THREE.BufferGeometry();
		g.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
		g.setAttribute( 'mag', new THREE.Float32BufferAttribute( mag, 1 ) );
		g.setAttribute( 'color', new THREE.Float32BufferAttribute( col, 3 ) );

		const points = new THREE.Points( g, new THREE.ShaderMaterial( {
			uniforms,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			vertexShader: /* glsl */`
				attribute float mag;
				attribute vec3 color;
				uniform float pixelRatio;
				varying vec3 vColor;
				${SHARED}
				void main() {
					vec3 dir = normalize( mat3( modelMatrix ) * position );
					float bright = pow( 2.512, 1.0 - mag );
					float twinkle = 1.0 + ( 0.15 + 0.35 * ( 1.0 - dir.y ) ) * sin( time * ( 2.0 + fract( position.x * 937.0 ) * 6.0 ) + position.z * 311.0 );
					vColor = color * clamp( bright, 0.06, 2.2 ) * twinkle * clearSky( dir ) * visible;
					gl_PointSize = clamp( 1.6 + 1.3 * sqrt( bright ), 1.4, 4.5 ) * pixelRatio;
					gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4( position, 1.0 );
				}`,
			fragmentShader: /* glsl */`
				varying vec3 vColor;
				void main() {
					float d = length( gl_PointCoord - 0.5 );
					float a = smoothstep( 0.5, 0.0, d );
					gl_FragColor = vec4( vColor * a * a, 1.0 );
					#include <colorspace_fragment>
				}`
		} ) );
		points.frustumCulled = false;
		this.group.add( points );

		// Constellation figures
		const lp = [];
		for ( const con of CONSTELLATIONS ) {

			for ( const [ a, b ] of con.lines ) {

				const A = equatorial( STARS[ a ][ 0 ], STARS[ a ][ 1 ] ), B = equatorial( STARS[ b ][ 0 ], STARS[ b ][ 1 ] );
				// Stop the line just short of each star so the stars stay crisp.
				lp.push( ...A.clone().lerp( B, 0.08 ).toArray(), ...A.lerp( B, 0.92 ).toArray() );

			}

		}

		const lg = new THREE.BufferGeometry();
		lg.setAttribute( 'position', new THREE.Float32BufferAttribute( lp, 3 ) );
		const lines = new THREE.LineSegments( lg, new THREE.ShaderMaterial( {
			uniforms,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			vertexShader: /* glsl */`
				varying float vAlpha;
				uniform float lines;
				${SHARED}
				void main() {
					vec3 dir = normalize( mat3( modelMatrix ) * position );
					vAlpha = 0.22 * lines * clearSky( dir ) * visible;
					gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4( position, 1.0 );
				}`,
			fragmentShader: /* glsl */`
				varying float vAlpha;
				void main() {
					gl_FragColor = vec4( vec3( 0.65, 0.78, 1.0 ) * vAlpha, 1.0 );
					#include <colorspace_fragment>
				}`
		} ) );
		lines.frustumCulled = false;
		this.group.add( lines );
		scene.add( this.group );

		// Name labels, placed over each figure's centre
		this.labels = CONSTELLATIONS.map( ( con ) => {

			const keys = con.anchor ? [ con.anchor ] : [ ...new Set( con.lines.flat() ) ];
			const centre = new THREE.Vector3();
			keys.forEach( ( k ) => centre.add( equatorial( STARS[ k ][ 0 ], STARS[ k ][ 1 ] ) ) );
			centre.normalize();
			const el = document.createElement( 'span' );
			el.textContent = con.name;
			labelLayer.appendChild( el );
			return { el, centre, shown: false };

		} );
		this.layer = labelLayer;
		this.tmp = new THREE.Vector3();

	}

	update( camera, rotation, { time, cloudCover, visible, lines, pixelRatio, haze } ) {

		const u = this.uniforms;
		u.time.value = time;
		u.cloudCover.value = cloudCover;
		u.visible.value = visible * ( 1 - haze );
		u.lines.value = lines;
		u.pixelRatio.value = pixelRatio;
		this.group.visible = u.visible.value > 0.01;

		this.rotation.copy( rotation );
		this.group.matrix.copy( rotation ).scale( this.tmp.setScalar( RADIUS ) ).setPosition( camera.position );
		this.group.matrixWorld.copy( this.group.matrix );
		this.group.matrixWorldNeedsUpdate = false;

		// Labels fade in only on a clear, dark sky.
		const show = this.group.visible && lines > 0.5 && u.visible.value * ( 1 - cloudCover ) > 0.25;
		this.layer.style.opacity = show ? 0.75 : 0;
		if ( ! show ) return;
		const w = window.innerWidth, h = window.innerHeight;
		for ( const l of this.labels ) {

			const d = this.tmp.copy( l.centre ).applyMatrix4( this.rotation );
			let on = d.y > 0.06;
			if ( on ) {

				d.multiplyScalar( RADIUS ).add( camera.position ).project( camera );
				on = d.z < 1 && Math.abs( d.x ) < 1.1 && Math.abs( d.y ) < 1.1;
				if ( on ) l.el.style.transform = `translate(${ ( d.x + 1 ) / 2 * w }px, ${ ( 1 - d.y ) / 2 * h }px) translate(-50%, -50%)`;

			}

			if ( on !== l.shown ) {

				l.el.style.opacity = on ? 1 : 0;
				l.shown = on;

			}

		}

	}

}
