import * as THREE from 'three';
import { Water } from '../lib/Water.js';

// Gerstner swell: [direction (deg), wavelength (m), amplitude (m), steepness]
// The same list drives the GPU displacement and the CPU camera buoyancy.
export const WAVES = [
	[ 20, 62, 0.55, 0.55 ],
	[ -28, 37, 0.32, 0.5 ],
	[ 105, 47, 0.22, 0.45 ],
	[ 58, 22, 0.16, 0.5 ],
	[ -65, 14, 0.08, 0.45 ],
	[ 8, 9.5, 0.05, 0.4 ]
].map( ( [ deg, L, A, Q ] ) => {

	const a = THREE.MathUtils.degToRad( deg );
	const k = 2 * Math.PI / L;
	return { dx: Math.cos( a ), dz: Math.sin( a ), k, w: Math.sqrt( 9.8 * k ), A, Q };

} );

const f = ( n ) => n.toFixed( 5 );

const gerstnerGLSL = WAVES.map( ( w ) => `
		{
			vec2 d = vec2( ${f( w.dx )}, ${f( w.dz )} );
			float A = ${f( w.A )} * waveScale * fade;
			float k = ${f( w.k )};
			float ph = k * dot( d, p.xz ) - ${f( w.w )} * waveTime;
			float S = sin( ph ), C = cos( ph );
			float Q = ${f( w.Q / WAVES.length )} / ( k * ${f( w.A )} );
			disp += vec3( Q * A * d.x * C, A * S, Q * A * d.y * C );
			nrm += vec3( -d.x * k * A * C, -Q * k * A * S, -d.y * k * A * C );
		}` ).join( '' );

// Height of the swell at (x, z) — used to float the camera.
export function waveHeight( x, z, t, scale ) {

	let y = 0;
	for ( const w of WAVES ) y += w.A * scale * Math.sin( w.k * ( w.dx * x + w.dz * z ) - w.w * t );
	return y;

}

// A grid that is dense near the viewer and stretches out to the horizon.
function oceanGeometry() {

	const seg = 320, near = 320, far = 14000;
	const g = new THREE.PlaneGeometry( 2, 2, seg, seg );
	const pos = g.attributes.position;
	const remap = ( u ) => u * near + Math.sign( u ) * Math.pow( Math.abs( u ), 4 ) * far;
	for ( let i = 0; i < pos.count; i ++ ) {

		pos.setXY( i, remap( pos.getX( i ) ), remap( pos.getY( i ) ) );

	}

	g.computeBoundingSphere();
	return g;

}

export function createWater( scene ) {

	const normals = new THREE.TextureLoader().load( 'assets/waternormals.jpg', ( t ) => {

		t.wrapS = t.wrapT = THREE.RepeatWrapping;

	} );

	const water = new Water( oceanGeometry(), {
		textureWidth: 512,
		textureHeight: 512,
		waterNormals: normals,
		sunDirection: new THREE.Vector3( 0, 1, 0 ),
		sunColor: 0xffffff,
		waterColor: 0x0b3a4a,
		distortionScale: 3.2,
		fog: true
	} );
	water.rotation.x = - Math.PI / 2;
	water.frustumCulled = false;

	const u = water.material.uniforms;
	u.waveTime = { value: 0 };
	u.waveScale = { value: 1 };
	u.foamAmount = { value: 0 };
	u.baseGlow = { value: 0.1 };
	u.foamColor = { value: new THREE.Color( 0xffffff ) };
	u.size.value = 1.4;

	// Swap in a vertex shader that displaces the flat mirror into rolling swell.
	water.material.vertexShader = /* glsl */`
		uniform mat4 textureMatrix;
		uniform float time;
		uniform float waveTime;
		uniform float waveScale;

		varying vec4 mirrorCoord;
		varying vec4 worldPosition;
		varying vec3 vWaveNormal;
		varying float vCrest;

		#include <common>
		#include <fog_pars_vertex>
		#include <shadowmap_pars_vertex>
		#include <logdepthbuf_pars_vertex>

		void main() {
			vec4 p = modelMatrix * vec4( position, 1.0 );
			float fade = 1.0 - smoothstep( 250.0, 2200.0, length( p.xz - cameraPosition.xz ) );
			vec3 disp = vec3( 0.0 );
			vec3 nrm = vec3( 0.0, 1.0, 0.0 );
			${gerstnerGLSL}
			p.xyz += disp;
			vWaveNormal = normalize( nrm );
			vCrest = disp.y / max( waveScale, 0.001 );

			worldPosition = p;
			mirrorCoord = textureMatrix * p;
			vec4 mvPosition = viewMatrix * p;
			gl_Position = projectionMatrix * mvPosition;

			#include <beginnormal_vertex>
			#include <defaultnormal_vertex>
			#include <logdepthbuf_vertex>
			#include <fog_vertex>
			#include <shadowmap_vertex>
		}`;

	// Blend the swell normal with the fine ripple normal map, and add whitecaps.
	water.material.fragmentShader = water.material.fragmentShader
		.replace( 'varying vec4 worldPosition;', `varying vec4 worldPosition;
				varying vec3 vWaveNormal;
				varying float vCrest;
				uniform float foamAmount;
				uniform float baseGlow;
				uniform vec3 foamColor;` )
		.replace( 'vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );', `
					vec3 rip = noise.xzy * vec3( 1.5, 1.0, 1.5 );
					vec3 surfaceNormal = normalize( vWaveNormal * rip.y + vec3( rip.x, 0.0, rip.z ) * 0.6 );` )
		.replace( 'sunColor * diffuseLight * 0.3', 'waterColor * diffuseLight * 1.5' )
		.replace( 'vec3( 0.1 ) + reflectionSample * 0.9', 'vec3( baseGlow ) + reflectionSample * 0.9' )
		.replace( 'float rf0 = 0.3;', 'float rf0 = 0.08;' )
		.replace( 'vec3 outgoingLight = albedo;', `
					float foam = smoothstep( 0.45, 1.0, vCrest + noise.x * 0.35 ) * foamAmount;
					foam *= 1.0 - smoothstep( 150.0, 900.0, distance );
					albedo = mix( albedo, foamColor, clamp( foam, 0.0, 0.85 ) );
					vec3 outgoingLight = albedo;` );

	scene.add( water );
	return water;

}

// Cloud layer shared by the sky and the star field, so stars hide behind the same clouds.
export const CLOUD_GLSL = /* glsl */`
	float cl_hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
	float cl_noise( vec2 p ) {
		vec2 i = floor( p ), f = fract( p );
		f = f * f * ( 3.0 - 2.0 * f );
		return mix( mix( cl_hash( i ), cl_hash( i + vec2( 1, 0 ) ), f.x ),
		            mix( cl_hash( i + vec2( 0, 1 ) ), cl_hash( i + vec2( 1, 1 ) ), f.x ), f.y );
	}
	float fbm( vec2 p ) {
		float v = 0.0, a = 0.5;
		for ( int i = 0; i < 5; i ++ ) { v += a * cl_noise( p ); p = p * 2.03 + 17.1; a *= 0.5; }
		return v;
	}
	vec2 cloudUV( vec3 dir, float time ) {
		return dir.xz / ( dir.y + 0.08 ) * 0.9 + vec2( time * 0.006, time * 0.002 );
	}
	float cloudNoise( vec3 dir, float time ) { return fbm( cloudUV( dir, time ) ); }
	float cloudDensity( float n, float dirY, float cover ) {
		float c = 1.0 - cover;
		return smoothstep( c - 0.12, c + 0.28, n ) * smoothstep( - 0.02, 0.05, dirY );
	}`;

export function createSky( scene ) {

	const material = new THREE.ShaderMaterial( {
		side: THREE.BackSide,
		depthWrite: false,
		fog: false,
		uniforms: {
			time: { value: 0 },
			sunDir: { value: new THREE.Vector3( 0, 1, 0 ) },
			topColor: { value: new THREE.Color() },
			horizonColor: { value: new THREE.Color() },
			sunColor: { value: new THREE.Color() },
			sunSize: { value: 1 },
			sunVisible: { value: 1 },
			glow: { value: 1 },
			haze: { value: 0 },
			cloudCover: { value: 0.2 },
			cloudLit: { value: new THREE.Color() },
			cloudShade: { value: new THREE.Color() },
			moonDir: { value: new THREE.Vector3( 0, - 1, 0 ) },
			moonSun: { value: new THREE.Vector3( 0, - 1, 0 ) },
			moonBright: { value: 0 },
			moonColor: { value: new THREE.Color( 0xf4efe4 ) },
			flash: { value: 0 }
		},
		vertexShader: /* glsl */`
			varying vec3 vDir;
			void main() {
				vDir = normalize( position );
				vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				gl_Position = p.xyww;
			}`,
		fragmentShader: /* glsl */`
			uniform float time;
			uniform vec3 sunDir;
			uniform vec3 topColor;
			uniform vec3 horizonColor;
			uniform vec3 sunColor;
			uniform float sunSize;
			uniform float sunVisible;
			uniform float glow;
			uniform float haze;
			uniform float cloudCover;
			uniform vec3 cloudLit;
			uniform vec3 cloudShade;
			uniform vec3 moonDir;
			uniform vec3 moonSun;
			uniform float moonBright;
			uniform vec3 moonColor;
			uniform float flash;
			varying vec3 vDir;
			${CLOUD_GLSL}

			// The Moon with its real phase: light the visible half-sphere from the Sun's direction.
			vec3 moon( vec3 dir, out float glowAmt ) {
				const float R = 0.0105;
				float md = dot( dir, moonDir );
				vec3 off = dir - moonDir * md;
				float r = length( off ) / R;
				float phase = 0.5 - 0.5 * dot( moonDir, moonSun );
				glowAmt = ( pow( max( md, 0.0 ), 3000.0 ) * 0.5 + pow( max( md, 0.0 ), 300.0 ) * 0.08 ) * phase;
				if ( md < 0.0 || r > 1.0 ) return vec3( 0.0 );
				vec3 nrm = off / R - moonDir * sqrt( max( 0.0, 1.0 - r * r ) );
				float lit = smoothstep( - 0.04, 0.06, dot( nrm, moonSun ) );
				vec3 ax = normalize( cross( moonDir, vec3( 0.0, 1.0, 0.0 ) ) ), ay = cross( ax, moonDir );
				vec2 q = vec2( dot( off, ax ), dot( off, ay ) ) / R;
				float maria = smoothstep( 0.42, 0.62, fbm( q * 2.2 + 4.0 ) );
				float edge = 1.0 - smoothstep( 0.9, 1.0, r );
				return moonColor * ( 1.0 - 0.35 * maria ) * ( lit + 0.025 ) * edge;
			}

			void main() {
				vec3 dir = normalize( vDir );
				float h = max( dir.y, 0.0 );

				// Horizon glow is strongest on the side of the sky facing the sun.
				float sunward = 0.5 + 0.5 * dot( normalize( dir.xz + 1e-4 ), normalize( sunDir.xz + 1e-4 ) );
				vec3 horizon = mix( mix( horizonColor, topColor, 0.35 * ( 1.0 - sunDir.y ) ), horizonColor, sunward );
				vec3 col = mix( horizon, topColor, 1.0 - exp( - h * 5.0 ) );

				// Sun / moon
				float sd = max( dot( dir, sunDir ), 0.0 );
				float cosR = 1.0 - 0.00007 * sunSize * sunSize;
				float disk = smoothstep( cosR - 0.00003, cosR, sd );
				float halo = ( pow( sd, 600.0 ) * 1.2 + pow( sd, 40.0 ) * 0.35 + pow( sd, 6.0 ) * 0.18 ) * glow;
				vec3 sunLight = sunColor * ( halo + disk * 18.0 ) * sunVisible;

				float moonGlow;
				vec3 moonLight = ( moon( dir, moonGlow ) * 1.6 + moonColor * moonGlow ) * moonBright;

				// Clouds: fbm projected on a plane high above the sea
				float density = 0.0;
				if ( dir.y > 0.0 ) {
					vec2 uv = cloudUV( dir, time );
					float n = fbm( uv );
					density = cloudDensity( n, dir.y, cloudCover );
					float lit = clamp( 0.5 + ( n - fbm( uv + sunDir.xz * 0.06 ) ) * 4.0, 0.0, 1.0 );
					vec3 cloud = mix( cloudShade, cloudLit, lit );
					cloud += sunColor * pow( sd, 8.0 ) * 0.6 * sunVisible;
					// Moonlight silvers the clouds around the Moon
					cloud += moonColor * pow( max( dot( dir, moonDir ), 0.0 ), 30.0 ) * 0.25 * moonBright * ( 0.5 - 0.5 * dot( moonDir, moonSun ) );
					col = mix( col + sunLight + moonLight, cloud, density );
				} else {
					col += sunLight * 0.3 + moonLight * 0.3;
				}

				// Fade to the fog colour at the horizon so the sea's edge disappears
				col = mix( horizonColor, col, smoothstep( -0.02, 0.06, dir.y ) );
				col = mix( col, horizonColor, haze * ( 1.0 - 0.5 * smoothstep( 0.0, 0.7, dir.y ) ) );
				col += flash * vec3( 0.8, 0.85, 1.0 ) * ( 0.4 + density );

				gl_FragColor = vec4( col, 1.0 );
				#include <tonemapping_fragment>
				#include <colorspace_fragment>
			}`
	} );

	const sky = new THREE.Mesh( new THREE.SphereGeometry( 15000, 48, 24 ), material );
	sky.frustumCulled = false;
	sky.renderOrder = - 1;
	scene.add( sky );
	return sky;

}

export function createRain( scene ) {

	const count = 2600, box = 70, height = 40;
	const pos = new Float32Array( count * 2 * 3 );
	const seed = new Float32Array( count * 2 * 2 );
	const end = new Float32Array( count * 2 );
	for ( let i = 0; i < count; i ++ ) {

		const x = ( Math.random() - 0.5 ) * box, z = ( Math.random() - 0.5 ) * box;
		const r = Math.random();
		for ( let j = 0; j < 2; j ++ ) {

			const v = i * 2 + j;
			pos.set( [ x, 0, z ], v * 3 );
			seed.set( [ r, Math.random() ], v * 2 );
			end[ v ] = j;

		}

	}

	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.BufferAttribute( pos, 3 ) );
	g.setAttribute( 'seed', new THREE.BufferAttribute( seed, 2 ) );
	g.setAttribute( 'tip', new THREE.BufferAttribute( end, 1 ) );

	const material = new THREE.ShaderMaterial( {
		transparent: true,
		depthWrite: false,
		uniforms: {
			time: { value: 0 },
			amount: { value: 0 },
			color: { value: new THREE.Color( 0xcfd8e6 ) },
			wind: { value: 0.25 }
		},
		vertexShader: /* glsl */`
			attribute vec2 seed;
			attribute float tip;
			uniform float time;
			uniform float amount;
			uniform float wind;
			varying float vAlpha;
			void main() {
				float speed = 22.0 + seed.y * 8.0;
				float y = ${height.toFixed( 1 )} - mod( time * speed + seed.x * ${height.toFixed( 1 )}, ${height.toFixed( 1 )} ) - 4.0;
				float len = 0.9 + seed.y * 0.6;
				vec3 p = position + vec3( wind * y, y + tip * len, wind * 0.3 * y );
				p.x += tip * wind * len;
				vAlpha = step( seed.y, amount ) * ( 0.12 + 0.2 * tip );
				gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
			}`,
		fragmentShader: /* glsl */`
			uniform vec3 color;
			varying float vAlpha;
			void main() {
				if ( vAlpha <= 0.0 ) discard;
				gl_FragColor = vec4( color, vAlpha );
			}`
	} );

	const rain = new THREE.LineSegments( g, material );
	rain.frustumCulled = false;
	scene.add( rain );
	return rain;

}
