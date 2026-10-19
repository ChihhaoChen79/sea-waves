import * as THREE from 'three';
import { createWater, createSky, createRain, waveHeight } from './ocean.js';
import { Soundscape } from './audio.js';
import { Wildlife } from './wildlife.js';

// ---------- Presets ----------

const TIMES = {
	sunrise: { glow: 1, elev: 3, azim: 80, top: 0x3d5f9e, horizon: 0xf2b27a, sun: 0xffb27a, sunSize: 1.6, water: 0x10304a, stars: 0 },
	morning: { glow: 1, elev: 22, azim: 110, top: 0x3f7fd0, horizon: 0xbcd8ee, sun: 0xfff2dc, sunSize: 1, water: 0x0c3b52, stars: 0 },
	noon: { glow: 1, elev: 62, azim: 160, top: 0x2a68c9, horizon: 0xa7cdea, sun: 0xffffff, sunSize: 0.8, water: 0x0a4560, stars: 0 },
	sunset: { glow: 1, elev: 2.5, azim: -80, top: 0x2c3666, horizon: 0xff8a4c, sun: 0xff7b35, sunSize: 1.8, water: 0x1a2438, stars: 0 },
	night: { glow: 0.3, elev: 28, azim: -40, top: 0x01030b, horizon: 0x0c1631, sun: 0xaabbe0, sunSize: 1.3, water: 0x020a14, stars: 1 }
};

const WEATHERS = {
	clear: { haze: 0, cover: 0.12, gloom: 0, fog: 0.00016, waves: 0.75, rain: 0, foam: 0.05, sunVis: 1, storm: 0 },
	cloudy: { haze: 0.05, cover: 0.62, gloom: 0.3, fog: 0.00028, waves: 1.05, rain: 0, foam: 0.15, sunVis: 0.6, storm: 0 },
	rain: { haze: 0.3, cover: 0.95, gloom: 0.6, fog: 0.0007, waves: 1.35, rain: 0.55, foam: 0.35, sunVis: 0.1, storm: 0 },
	storm: { haze: 0.4, cover: 1.0, gloom: 0.82, fog: 0.0011, waves: 2.3, rain: 1, foam: 0.9, sunVis: 0, storm: 1 },
	fog: { haze: 0.9, cover: 0.45, gloom: 0.35, fog: 0.008, waves: 0.5, rain: 0, foam: 0, sunVis: 0.35, storm: 0 }
};

const GLOOM_TINT = new THREE.Color( 0x6b7480 );

// Mix a preset colour toward a flat grey as the weather gets worse.
function weathered( hex, gloom, night ) {

	const c = new THREE.Color( hex );
	const grey = GLOOM_TINT.clone().multiplyScalar( night ? 0.12 : 0.55 + 0.45 * c.getHSL( {} ).l );
	return c.lerp( grey, gloom );

}

function targetState( timeKey, weatherKey ) {

	const t = TIMES[ timeKey ], w = WEATHERS[ weatherKey ];
	const night = timeKey === 'night';
	const top = weathered( t.top, w.gloom, night );
	const horizon = weathered( t.horizon, w.gloom * 0.9, night );
	const sunCol = new THREE.Color( t.sun );
	const cloudLit = night ? new THREE.Color( 0x1a2236 ) : new THREE.Color( 0xffffff ).lerp( sunCol, 0.35 ).lerp( GLOOM_TINT, w.gloom * 0.7 );
	const cloudShade = night ? new THREE.Color( 0x070a12 ) : horizon.clone().lerp( new THREE.Color( 0x3a4150 ), 0.4 + w.gloom * 0.4 );

	return {
		elev: t.elev, azim: t.azim, glow: t.glow, sunSize: t.sunSize,
		top, horizon, sun: sunCol, cloudLit, cloudShade,
		water: weathered( t.water, w.gloom * 0.5, night ),
		stars: t.stars * ( 1 - w.cover ),
		cover: w.cover, haze: w.haze, fog: w.fog, waves: w.waves, rain: w.rain,
		foam: w.foam, sunVis: w.sunVis, storm: w.storm,
		exposure: night ? 0.75 : 0.85 - w.gloom * 0.15,
		ambient: night ? 0.35 : 1.6 - w.gloom * 0.6,
		direct: ( night ? 0.5 : 2.6 ) * ( 0.25 + 0.75 * w.sunVis )
	};

}

function lerpState( cur, tgt, k ) {

	for ( const key in tgt ) {

		if ( tgt[ key ] instanceof THREE.Color ) cur[ key ].lerp( tgt[ key ], k );
		else cur[ key ] += ( tgt[ key ] - cur[ key ] ) * k;

	}

}

function cloneState( s ) {

	const o = {};
	for ( const key in s ) o[ key ] = s[ key ] instanceof THREE.Color ? s[ key ].clone() : s[ key ];
	return o;

}

// ---------- Renderer & scene ----------

const canvas = document.getElementById( 'scene' );
let renderer;
try {

	renderer = new THREE.WebGLRenderer( { canvas, antialias: true, powerPreference: 'high-performance' } );

} catch ( e ) {

	document.getElementById( 'nogl' ).hidden = false;
	throw e;

}

let pixelRatio = Math.min( window.devicePixelRatio, 2 );
renderer.setPixelRatio( pixelRatio );
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2( 0x000000, 0.0002 );

const camera = new THREE.PerspectiveCamera( 60, 1, 0.5, 30000 );

const water = createWater( scene );
const sky = createSky( scene );
const rain = createRain( scene );
const sound = new Soundscape();
const wildlife = new Wildlife( scene, sound );

// Lighting for the whale, gulls and islands (the sea and sky shade themselves)
const hemi = new THREE.HemisphereLight( 0xffffff, 0x223344, 1 );
const sunLight = new THREE.DirectionalLight( 0xffffff, 1 );
scene.add( hemi, sunLight );
const sprayColor = new THREE.Color();
const WHITE = new THREE.Color( 0xffffff );

if ( new URLSearchParams( location.search ).has( 'debug' ) ) window.sea = { wildlife, water, camera };

let choice = { time: 'sunset', weather: 'clear', extras: { whales: true, gulls: true, islands: true } };
try {

	const saved = JSON.parse( localStorage.getItem( 'sea-waves' ) );
	if ( saved && TIMES[ saved.time ] && WEATHERS[ saved.weather ] ) {

		choice.time = saved.time;
		choice.weather = saved.weather;
		Object.assign( choice.extras, saved.extras );

	}

} catch ( e ) { /* storage unavailable */ }

let target = targetState( choice.time, choice.weather );
const state = cloneState( target );

function resize() {

	const w = window.innerWidth, h = window.innerHeight;
	renderer.setSize( w, h, false );
	camera.aspect = w / h;
	// Keep a natural horizontal field of view in portrait on a phone.
	camera.fov = w < h ? 72 : 55;
	camera.updateProjectionMatrix();

}

window.addEventListener( 'resize', resize );
resize();

// ---------- Looking around (touch / mouse drag) ----------

const look = { yaw: 0, pitch: - 0.04, vYaw: 0, vPitch: 0, dragging: false, x: 0, y: 0 };

canvas.addEventListener( 'pointerdown', ( e ) => {

	look.dragging = true;
	look.x = e.clientX;
	look.y = e.clientY;
	canvas.setPointerCapture( e.pointerId );

} );
canvas.addEventListener( 'pointermove', ( e ) => {

	if ( ! look.dragging ) return;
	const s = 2.2 / window.innerHeight;
	look.vYaw = ( e.clientX - look.x ) * s;
	look.vPitch = ( e.clientY - look.y ) * s;
	look.yaw += look.vYaw;
	look.pitch = THREE.MathUtils.clamp( look.pitch + look.vPitch, - 0.6, 0.7 );
	look.x = e.clientX;
	look.y = e.clientY;
	hideHint();

} );
const endDrag = () => {

	look.dragging = false;

};

canvas.addEventListener( 'pointerup', endDrag );
canvas.addEventListener( 'pointercancel', endDrag );

// ---------- Lightning ----------

let flash = 0, nextStrike = 4;

function updateLightning( t, dt ) {

	flash = Math.max( 0, flash - dt * 3.5 );
	if ( state.storm < 0.5 ) return;
	if ( t > nextStrike ) {

		flash = 1 + Math.random() * 0.6;
		// A quick second flicker
		setTimeout( () => {

			flash = Math.max( flash, 0.7 );

		}, 120 + Math.random() * 120 );
		sound.thunder();
		nextStrike = t + 5 + Math.random() * 12;

	}

}

// ---------- Main loop ----------

const clock = new THREE.Clock();
const sunDir = new THREE.Vector3();
const euler = new THREE.Euler( 0, 0, 0, 'YXZ' );
const drift = { yaw: 0 };
let baseYaw = 0, yawGoal = 0;
let frames = 0, fpsTime = 0, adapted = false;

function frame() {

	const dt = Math.min( clock.getDelta(), 0.1 );
	const t = clock.elapsedTime;

	lerpState( state, target, 1 - Math.exp( - dt * 0.9 ) );

	// Sun / moon
	const phi = THREE.MathUtils.degToRad( 90 - state.elev );
	const theta = THREE.MathUtils.degToRad( state.azim );
	sunDir.setFromSphericalCoords( 1, phi, theta );

	// Sky
	const su = sky.material.uniforms;
	su.time.value = t;
	su.sunDir.value.copy( sunDir );
	su.topColor.value.copy( state.top );
	su.horizonColor.value.copy( state.horizon );
	su.sunColor.value.copy( state.sun );
	su.sunSize.value = state.sunSize;
	su.sunVisible.value = state.sunVis;
	su.glow.value = state.glow;
	su.haze.value = state.haze;
	su.cloudCover.value = state.cover;
	su.cloudLit.value.copy( state.cloudLit );
	su.cloudShade.value.copy( state.cloudShade );
	su.stars.value = state.stars;
	su.flash.value = flash;

	scene.fog.color.copy( state.horizon ).addScalar( flash * 0.25 );
	scene.fog.density = state.fog;

	// Water
	const wu = water.material.uniforms;
	wu.time.value = t * 0.6;
	wu.waveTime.value = t;
	wu.waveScale.value = state.waves;
	wu.foamAmount.value = state.foam;
	wu.foamColor.value.copy( state.horizon ).lerp( WHITE, 0.5 ).multiplyScalar( 0.9 );
	wu.sunDirection.value.copy( sunDir );
	wu.sunColor.value.copy( state.sun ).multiplyScalar( 0.4 + state.sunVis * 0.6 );
	wu.waterColor.value.copy( state.water );
	wu.distortionScale.value = 2.5 + state.waves * 1.5;

	// Rain
	rain.material.uniforms.time.value = t;
	rain.material.uniforms.amount.value = state.rain;
	rain.material.uniforms.wind.value = 0.15 + state.storm * 0.35;
	rain.visible = state.rain > 0.01;

	updateLightning( t, dt );
	renderer.toneMappingExposure = state.exposure + flash * 0.6;

	// Floating camera: rides the swell, slowly drifts and sways.
	// Drift around a wide, slow circle so we never sail into an island.
	const cx = 250 * Math.sin( t * 0.0024 ), cz = 250 * ( 1 - Math.cos( t * 0.0024 ) );
	const h = waveHeight( cx, cz, t, state.waves );
	const e = 1.2;
	const hx = waveHeight( cx + e, cz, t, state.waves ) - h;
	const hz = waveHeight( cx, cz + e, t, state.waves ) - h;
	camera.position.set( cx, 2.6 + h * 0.85, cz );
	sky.position.copy( camera.position );
	// Keep the detailed middle of the ocean mesh under the camera (snapped to the grid spacing).
	water.position.set( Math.round( cx / 2 ) * 2, 0, Math.round( cz / 2 ) * 2 );
	rain.position.set( cx, camera.position.y - 2, cz );

	if ( ! look.dragging ) {

		look.vYaw *= 0.93;
		look.vPitch *= 0.93;
		look.yaw += look.vYaw;
		look.pitch = THREE.MathUtils.clamp( look.pitch + look.vPitch, - 0.6, 0.7 );
		// Ease the gaze back toward the horizon
		look.pitch += ( - 0.04 - look.pitch ) * dt * 0.3;

	}

	// Turn gently toward the sun/moon after a new time of day is chosen.
	baseYaw += ( yawGoal - baseYaw ) * ( 1 - Math.exp( - dt * 0.8 ) );
	drift.yaw = Math.sin( t * 0.05 ) * 0.25 + t * 0.004;
	euler.set(
		look.pitch + hz * 0.25 + Math.sin( t * 0.7 ) * 0.006,
		baseYaw + drift.yaw + look.yaw,
		- hx * 0.3 + Math.sin( t * 0.5 ) * 0.01
	);
	camera.quaternion.setFromEuler( euler );

	// Light the whale, gulls and islands to match the sky
	hemi.color.copy( state.top ).lerp( state.horizon, 0.6 );
	hemi.groundColor.copy( state.water );
	hemi.intensity = state.ambient + flash * 2;
	sunLight.position.copy( sunDir );
	sunLight.color.copy( state.sun );
	sunLight.intensity = state.direct;
	sprayColor.copy( wu.foamColor.value ).multiplyScalar( state.ambient > 1 ? 1 : 0.35 + 0.65 * state.ambient ).addScalar( flash * 0.3 );
	wildlife.update( t, dt, camera, state.waves, sprayColor,
		renderer.domElement.height / ( 2 * Math.tan( THREE.MathUtils.degToRad( camera.fov ) / 2 ) ) );

	renderer.render( scene, camera );

	// Drop resolution once if the phone can't keep up.
	frames ++;
	fpsTime += dt;
	if ( ! adapted && fpsTime > 3 ) {

		const fps = frames / fpsTime;
		if ( fps < 40 && pixelRatio > 1.2 ) {

			pixelRatio = Math.max( 1, pixelRatio * 0.65 );
			renderer.setPixelRatio( pixelRatio );
			resize();

		}

		adapted = true;

	}

	requestAnimationFrame( frame );

}

// Face the sun (or moon) when a time of day is chosen. The camera looks down -Z at
// yaw 0 and the sun's azimuth is measured from +Z, hence the half turn.
function faceSun( instant ) {

	const az = THREE.MathUtils.degToRad( TIMES[ choice.time ].azim ) + Math.PI;
	let goal = az - drift.yaw - look.yaw;
	// Take the short way round
	goal = baseYaw + Math.atan2( Math.sin( goal - baseYaw ), Math.cos( goal - baseYaw ) );
	yawGoal = goal;
	if ( instant ) baseYaw = goal;

}

faceSun( true );
requestAnimationFrame( frame );

// ---------- UI ----------

const menu = document.getElementById( 'menu' );
const hud = document.getElementById( 'hud' );
const hint = document.getElementById( 'hint' );
const soundBtn = document.getElementById( 'sound' );
const musicToggle = document.getElementById( 'music' );
const beginBtn = document.getElementById( 'begin' );
let started = false;

function hideHint() {

	hint.classList.add( 'gone' );

}

function syncChips() {

	document.querySelectorAll( '[data-time]' ).forEach( ( b ) => b.setAttribute( 'aria-pressed', b.dataset.time === choice.time ) );
	document.querySelectorAll( '[data-weather]' ).forEach( ( b ) => b.setAttribute( 'aria-pressed', b.dataset.weather === choice.weather ) );
	document.querySelectorAll( '[data-extra]' ).forEach( ( b ) => b.setAttribute( 'aria-pressed', choice.extras[ b.dataset.extra ] ) );

}

function apply( turn ) {

	target = targetState( choice.time, choice.weather );
	sound.setScene( choice.time, choice.weather );
	wildlife.setConditions( choice.time, choice.weather );
	wildlife.setEnabled( choice.extras );
	if ( turn ) faceSun();
	try {

		localStorage.setItem( 'sea-waves', JSON.stringify( choice ) );

	} catch ( e ) { /* ignore */ }

}

document.querySelectorAll( '[data-time]' ).forEach( ( b ) => b.addEventListener( 'click', () => {

	choice.time = b.dataset.time;
	syncChips();
	apply( true );

} ) );
document.querySelectorAll( '[data-weather]' ).forEach( ( b ) => b.addEventListener( 'click', () => {

	choice.weather = b.dataset.weather;
	syncChips();
	apply( false );

} ) );

document.querySelectorAll( '[data-extra]' ).forEach( ( b ) => b.addEventListener( 'click', () => {

	choice.extras[ b.dataset.extra ] = ! choice.extras[ b.dataset.extra ];
	syncChips();
	apply( false );

} ) );

// Fade the corner buttons away when the screen hasn't been touched for a while.
let idleTimer = 0;
function wake() {

	hud.classList.remove( 'idle' );
	clearTimeout( idleTimer );
	idleTimer = setTimeout( () => hud.classList.add( 'idle' ), 4000 );

}

[ 'pointerdown', 'pointermove', 'touchstart' ].forEach( ( type ) => window.addEventListener( type, wake, { passive: true } ) );

beginBtn.addEventListener( 'click', () => {

	menu.classList.add( 'hidden' );
	hud.classList.remove( 'hidden' );
	wake();
	if ( musicToggle.checked ) {

		sound.setMuted( false );
		sound.start();

	} else if ( sound.ctx ) sound.setMuted( true );

	soundBtn.setAttribute( 'aria-pressed', musicToggle.checked );
	if ( ! started ) setTimeout( hideHint, 6000 );
	started = true;

} );

document.getElementById( 'settings' ).addEventListener( 'click', () => {

	beginBtn.textContent = 'Back to the sea';
	musicToggle.checked = soundBtn.getAttribute( 'aria-pressed' ) === 'true';
	menu.classList.remove( 'hidden' );
	hud.classList.add( 'hidden' );

} );

soundBtn.addEventListener( 'click', () => {

	const on = soundBtn.getAttribute( 'aria-pressed' ) !== 'true';
	soundBtn.setAttribute( 'aria-pressed', on );
	sound.setMuted( ! on );
	if ( on ) sound.start();

} );

syncChips();
apply( true );
