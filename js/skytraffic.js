import * as THREE from 'three';
import { SKY_GLSL } from './starfield.js';

// Airliners at cruising height with spreading contrails, and shooting stars.
// They are far beyond the sky dome, so they're drawn at their true direction on a
// sphere just inside it, sized from their real distance.

const R = 13000;
const rand = ( a, b ) => a + Math.random() * ( b - a );

const PROJECT = /* glsl */`
	uniform float pixelScale;
	vec4 skyPosition( vec3 p, out vec3 dir, out float dist ) {
		vec3 rel = p - cameraPosition;
		dist = length( rel );
		dir = rel / dist;
		return projectionMatrix * viewMatrix * vec4( cameraPosition + dir * ${R.toFixed( 1 )}, 1.0 );
	}`;

const skyUniforms = () => ( {
	time: { value: 0 },
	cloudCover: { value: 0 },
	visible: { value: 1 },
	pixelScale: { value: 800 },
	pixelRatio: { value: 1 }
} );

// ---------- Contrails: puffs of ice left behind the engines that spread and fade ----------

class Contrails {

	constructor( scene, max = 3200 ) {

		this.max = max;
		this.next = 0;
		this.pos = new Float32Array( max * 3 );
		this.birth = new Float32Array( max ).fill( - 1e6 );
		const seed = new Float32Array( max ).map( () => Math.random() );
		const g = new THREE.BufferGeometry();
		this.posAttr = new THREE.BufferAttribute( this.pos, 3 ).setUsage( THREE.DynamicDrawUsage );
		this.birthAttr = new THREE.BufferAttribute( this.birth, 1 ).setUsage( THREE.DynamicDrawUsage );
		g.setAttribute( 'position', this.posAttr );
		g.setAttribute( 'birth', this.birthAttr );
		g.setAttribute( 'seed', new THREE.BufferAttribute( seed, 1 ) );

		this.uniforms = Object.assign( skyUniforms(), {
			color: { value: new THREE.Color( 0xffffff ) },
			life: { value: 150 },
			wind: { value: new THREE.Vector3( 9, 0, 4 ) }
		} );

		const points = new THREE.Points( g, new THREE.ShaderMaterial( {
			uniforms: this.uniforms,
			transparent: true,
			depthWrite: false,
			vertexShader: /* glsl */`
				attribute float birth;
				attribute float seed;
				uniform float life;
				uniform vec3 wind;
				varying float vAlpha;
				${SKY_GLSL}
				${PROJECT}
				void main() {
					float age = time - birth;
					if ( age < 0.0 || age > life ) {
						gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
						gl_PointSize = 0.0;
						vAlpha = 0.0;
						return;
					}
					float k = age / life;
					// Drift with the wind and spread out in lumpy, turbulent puffs
					float spread = 6.0 + 140.0 * sqrt( k );
					vec3 p = position + wind * age + vec3( sin( seed * 91.0 ), 0.5 * cos( seed * 57.0 ), sin( seed * 13.0 + 1.0 ) ) * spread;
					vec3 dir;
					float dist;
					gl_Position = skyPosition( p, dir, dist );
					float width = 55.0 + 340.0 * sqrt( k );
					gl_PointSize = clamp( width / dist * pixelScale, 1.2, 96.0 );
					// Forms a moment behind the engines, then thins as it spreads
					vAlpha = smoothstep( 0.0, 2.5, age ) * pow( 1.0 - k, 1.4 ) * 0.55 * sqrt( 55.0 / width );
					vAlpha *= clearSky( dir ) * visible * smoothstep( 0.03, 0.12, dir.y );
				}`,
			fragmentShader: /* glsl */`
				uniform vec3 color;
				varying float vAlpha;
				void main() {
					vec2 d = gl_PointCoord - 0.5;
					float a = exp( - dot( d, d ) * 14.0 ) * vAlpha;
					if ( a < 0.004 ) discard;
					gl_FragColor = vec4( color, a );
					#include <colorspace_fragment>
				}`
		} ) );
		points.frustumCulled = false;
		scene.add( points );

	}

	emit( p, time ) {

		const i = this.next;
		this.next = ( this.next + 1 ) % this.max;
		this.pos.set( [ p.x, p.y, p.z ], i * 3 );
		this.birth[ i ] = time;
		this.dirty = true;

	}

	update() {

		if ( ! this.dirty ) return;
		this.posAttr.needsUpdate = this.birthAttr.needsUpdate = true;
		this.dirty = false;

	}

}

// ---------- Small lights: aircraft navigation lights, strobes, and meteors ----------

class Sparks {

	constructor( scene, max = 160 ) {

		this.max = max;
		this.count = 0;
		this.pos = new Float32Array( max * 3 );
		this.col = new Float32Array( max * 3 );
		this.size = new Float32Array( max );
		const g = new THREE.BufferGeometry();
		this.attrs = [
			new THREE.BufferAttribute( this.pos, 3 ).setUsage( THREE.DynamicDrawUsage ),
			new THREE.BufferAttribute( this.col, 3 ).setUsage( THREE.DynamicDrawUsage ),
			new THREE.BufferAttribute( this.size, 1 ).setUsage( THREE.DynamicDrawUsage )
		];
		g.setAttribute( 'position', this.attrs[ 0 ] );
		g.setAttribute( 'color', this.attrs[ 1 ] );
		g.setAttribute( 'size', this.attrs[ 2 ] );
		this.geometry = g;
		this.uniforms = skyUniforms();

		const points = new THREE.Points( g, new THREE.ShaderMaterial( {
			uniforms: this.uniforms,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			vertexShader: /* glsl */`
				attribute vec3 color;
				attribute float size;
				uniform float pixelRatio;
				varying vec3 vColor;
				${SKY_GLSL}
				${PROJECT}
				void main() {
					vec3 dir;
					float dist;
					gl_Position = skyPosition( position, dir, dist );
					gl_PointSize = size * pixelRatio;
					vColor = color * clearSky( dir ) * visible;
				}`,
			fragmentShader: /* glsl */`
				varying vec3 vColor;
				void main() {
					vec2 d = gl_PointCoord - 0.5;
					float r = dot( d, d );
					float a = exp( - r * 40.0 ) + 0.3 * exp( - r * 9.0 );
					gl_FragColor = vec4( vColor * a, 1.0 );
					#include <colorspace_fragment>
				}`
		} ) );
		points.frustumCulled = false;
		scene.add( points );

	}

	begin() {

		this.count = 0;

	}

	add( p, r, g, b, size ) {

		if ( this.count >= this.max ) return;
		const i = this.count ++;
		this.pos.set( [ p.x, p.y, p.z ], i * 3 );
		this.col.set( [ r, g, b ], i * 3 );
		this.size[ i ] = size;

	}

	end() {

		this.geometry.setDrawRange( 0, this.count );
		this.attrs.forEach( ( a ) => a.needsUpdate = true );

	}

}

// ---------- The traffic itself ----------

export class SkyTraffic {

	constructor( scene ) {

		this.trails = new Contrails( scene );
		this.sparks = new Sparks( scene );
		this.planes = [];
		this.meteors = [];
		this.planesOn = true;
		this.nextPlane = rand( 12, 25 );
		this.nextMeteor = rand( 5, 15 );
		this.tmp = new THREE.Vector3();
		this.tmp2 = new THREE.Vector3();
		this.fwd = new THREE.Vector3();

	}

	// An airliner on a straight track at cruising height, passing in front of the viewer.
	spawnPlane( cam ) {

		const bearing = Math.atan2( this.fwd.x, this.fwd.z ) + rand( - 0.6, 0.6 );
		const D = rand( 14000, 36000 ); // closest horizontal distance
		const closest = new THREE.Vector3( cam.x + Math.sin( bearing ) * D, 0, cam.z + Math.cos( bearing ) * D );
		const heading = bearing + ( Math.random() < 0.5 ? 1 : - 1 ) * Math.PI / 2 + rand( - 0.5, 0.5 );
		const dir = new THREE.Vector3( Math.sin( heading ), 0, Math.cos( heading ) );
		const half = Math.sqrt( Math.max( 1, 75000 ** 2 - D * D ) );
		const speed = rand( 230, 260 );
		this.planes.push( {
			start: closest.addScaledVector( dir, - half ).setY( rand( 9800, 11800 ) ),
			dir, speed, age: 0, dur: 2 * half / speed,
			right: new THREE.Vector3( - dir.z, 0, dir.x ),
			contrail: Math.random() < 0.8, emitAt: 0, phase: Math.random() * 3,
			pos: new THREE.Vector3()
		} );

	}

	spawnMeteor() {

		// Start high in the sky, roughly ahead, and streak downward along a great circle.
		const az = Math.atan2( this.fwd.x, this.fwd.z ) + rand( - 1, 1 ), el = rand( 0.45, 1.1 );
		const start = new THREE.Vector3( Math.sin( az ) * Math.cos( el ), Math.sin( el ), Math.cos( az ) * Math.cos( el ) );
		const drift = new THREE.Vector3( rand( - 1, 1 ), - rand( 0.4, 1 ), rand( - 1, 1 ) );
		const axis = new THREE.Vector3().crossVectors( start, drift ).normalize();
		this.meteors.push( {
			start, axis, age: 0, dur: rand( 0.45, 1.1 ),
			span: THREE.MathUtils.degToRad( rand( 10, 22 ) ),
			bright: rand( 0.6, 1.3 ), tint: Math.random() < 0.3 ? [ 0.75, 1, 0.8 ] : [ 1, 0.95, 0.85 ]
		} );

	}

	// dark: 0 by day, 1 at night; stars: how visible the stars are right now.
	update( t, dt, camera, { cloudCover, haze, dark, stars, trailColor, pixelScale, pixelRatio } ) {

		const cam = camera.position;
		camera.getWorldDirection( this.fwd );
		for ( const u of [ this.trails.uniforms, this.sparks.uniforms ] ) {

			u.time.value = t;
			u.cloudCover.value = cloudCover;
			u.visible.value = 1 - haze;
			u.pixelScale.value = pixelScale;
			u.pixelRatio.value = pixelRatio;

		}

		this.trails.uniforms.color.value.copy( trailColor );
		this.sparks.begin();

		// Planes: one every couple of minutes, at most two in the sky at once
		if ( this.planesOn && t > this.nextPlane && this.planes.length < 2 ) {

			this.spawnPlane( cam );
			this.nextPlane = t + rand( 70, 160 );

		}

		const lights = THREE.MathUtils.lerp( 0.03, 1, dark );
		for ( const p of this.planes ) {

			p.age += dt;
			p.pos.copy( p.start ).addScaledVector( p.dir, p.speed * p.age );
			if ( p.contrail && t >= p.emitAt ) {

				// From the ground the engine trails merge into one line, a little behind the plane
				this.trails.emit( this.tmp.copy( p.pos ).addScaledVector( p.dir, - 40 ), t );
				p.emitAt = t + 0.11;

			}

			// Body: a sunlit silver glint by day
			const body = 0.9 * ( 1 - dark );
			this.sparks.add( p.pos, body, body, body * 1.05, 3 );
			// Navigation lights, shimmering in the air: red on the left wing, green on the right
			const shimmer = ( k ) => 0.75 + 0.25 * Math.sin( t * 21 + k ) * Math.sin( t * 7.3 + k * 2 );
			// Wingtips: spread a little wider than real so red and green stay apart on a phone
			const span = Math.max( 30, p.pos.distanceTo( cam ) * 0.006 );
			const left = this.tmp.copy( p.pos ).addScaledVector( p.right, - span );
			const right = this.tmp2.copy( p.pos ).addScaledVector( p.right, span );
			this.sparks.add( left, 1.4 * lights * shimmer( p.phase ), 0.08 * lights, 0.06 * lights, 3.6 );
			this.sparks.add( right, 0.1 * lights, 1.3 * lights * shimmer( p.phase + 2 ), 0.35 * lights, 3.6 );
			// White wingtip strobes (double flash) and a red beacon
			const c = ( t + p.phase ) % 1.25;
			if ( c < 0.05 || ( c > 0.16 && c < 0.21 ) ) {

				this.sparks.add( left, 2 * lights, 2 * lights, 2 * lights, 5 );
				this.sparks.add( right, 2 * lights, 2 * lights, 2 * lights, 5 );

			}

			if ( ( t + p.phase * 0.7 ) % 1 < 0.12 ) this.sparks.add( p.pos, 1.5 * lights, 0.15 * lights, 0.1 * lights, 4.2 );

		}

		this.planes = this.planes.filter( ( p ) => p.age < p.dur );
		this.trails.update();

		// Shooting stars on a dark, clear-ish sky
		if ( stars * ( 1 - cloudCover ) > 0.3 && t > this.nextMeteor ) {

			this.spawnMeteor();
			this.nextMeteor = t + rand( 8, 30 );

		}

		for ( const m of this.meteors ) {

			m.age += dt;
			const u = m.age / m.dur;
			const fade = Math.sin( Math.PI * Math.min( u, 1 ) ) ** 0.7 * m.bright * stars;
			const head = m.span * u, tail = m.span * 0.45 * Math.min( 1, u * 2 );
			for ( let i = 0; i < 26; i ++ ) {

				const f = i / 25;
				const d = this.tmp.copy( m.start ).applyAxisAngle( m.axis, head - tail * f ).multiplyScalar( 20000 ).add( cam );
				const k = fade * ( 1 - f ) ** 1.5 * 1.8;
				this.sparks.add( d, m.tint[ 0 ] * k, m.tint[ 1 ] * k, m.tint[ 2 ] * k, 4.5 - 3 * f );

			}

		}

		this.meteors = this.meteors.filter( ( m ) => m.age < m.dur );
		this.sparks.end();

	}

	setPlanes( on ) {

		this.planesOn = on;
		if ( ! on ) this.planes = [];

	}

}
