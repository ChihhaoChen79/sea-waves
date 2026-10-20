import * as THREE from 'three';
import { createWater, createSky, createRain, waveHeight } from './ocean.js';
import { Soundscape } from './audio.js';
import { Wildlife } from './wildlife.js';
import { observer, plan, julian, sunDir as realSunDir, moonDir as realMoonDir, skyRotation, toWorld } from './astro.js';
import { StarField } from './starfield.js';
import { SkyTraffic } from './skytraffic.js';
import { HorizonClock } from './clock.js';

// ---------- Presets ----------

// Sun and Moon positions come from the real sky (astro.js); these set the colours.
const TIMES = {
	sunrise: { clock: [ 0xfff0dc, 1 ], dark: 0, trail: 0xffd6b8, seaGlow: 0.1, top: 0x3d5f9e, horizon: 0xf2b27a, sun: 0xffb27a, sunSize: 1.6, water: 0x10304a, stars: 0, disk: 1, moon: 0.6 },
	morning: { clock: [ 0xffffff, 1 ], dark: 0, trail: 0xffffff, seaGlow: 0.1, top: 0x3f7fd0, horizon: 0xbcd8ee, sun: 0xfff2dc, sunSize: 1, water: 0x0c3b52, stars: 0, disk: 1, moon: 0.4 },
	noon: { clock: [ 0xffffff, 1 ], dark: 0, trail: 0xffffff, seaGlow: 0.1, top: 0x2a68c9, horizon: 0xa7cdea, sun: 0xffffff, sunSize: 0.8, water: 0x0a4560, stars: 0, disk: 1, moon: 0.35 },
	sunset: { clock: [ 0xffe0bd, 1 ], dark: 0, trail: 0xffb890, seaGlow: 0.1, top: 0x2c3666, horizon: 0xff8a4c, sun: 0xff7b35, sunSize: 1.8, water: 0x1a2438, stars: 0, disk: 1, moon: 0.6 },
	// Nautical twilight: deep blue overhead, a dusky glow where the sun went down
	twilight: { clock: [ 0xece6ff, 1.2 ], dark: 0.75, trail: 0x9c7f95, seaGlow: 0.035, top: 0x0a1a40, horizon: 0x8c7194, sun: 0x9eaad6, sunSize: 1, water: 0x071630, stars: 0.8, disk: 0, moon: 1.15 },
	night: { clock: [ 0xe2ebff, 1.35 ], dark: 1, trail: 0x262c3a, seaGlow: 0.012, top: 0x01030b, horizon: 0x0c1631, sun: 0xaabbe0, sunSize: 1.3, water: 0x020a14, stars: 1, disk: 0, moon: 1.3 }
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
function weathered( hex, gloom, dark ) {

	const c = new THREE.Color( hex );
	const grey = GLOOM_TINT.clone().multiplyScalar( THREE.MathUtils.lerp( 0.55 + 0.45 * c.getHSL( {} ).l, 0.12, dark ) );
	return c.lerp( grey, gloom );

}

function targetState( timeKey, weatherKey, sunAt ) {

	const t = TIMES[ timeKey ], w = WEATHERS[ weatherKey ];
	const dark = t.dark;
	const top = weathered( t.top, w.gloom, dark );
	const horizon = weathered( t.horizon, w.gloom * 0.9, dark );
	const sunCol = new THREE.Color( t.sun );
	const cloudLit = new THREE.Color( 0xffffff ).lerp( sunCol, 0.35 ).lerp( GLOOM_TINT, w.gloom * 0.7 ).lerp( new THREE.Color( 0x1a2236 ), dark );
	const cloudShade = horizon.clone().lerp( new THREE.Color( 0x3a4150 ), 0.4 + w.gloom * 0.4 ).lerp( new THREE.Color( 0x070a12 ), dark );

	return {
		skySun: sunAt.clone(), light: sunAt.clone(), seaGlow: t.seaGlow, sunSize: t.sunSize, disk: t.disk, moonBright: t.moon,
		top, horizon, sun: sunCol, cloudLit, cloudShade,
		water: weathered( t.water, w.gloom * 0.5, dark ),
		trail: new THREE.Color( t.trail ).multiplyScalar( 1 - w.gloom * 0.4 ), dark,
		// Giant clock: [ text colour, brightness ], greyed by the weather
		clockCore: new THREE.Color( t.clock[ 0 ] ).lerp( GLOOM_TINT, w.gloom * 0.45 ).multiplyScalar( t.clock[ 1 ] * ( 1 - w.gloom * 0.2 ) ),
		stars: t.stars,
		cover: w.cover, haze: w.haze, fog: w.fog, waves: w.waves, rain: w.rain,
		foam: w.foam, sunVis: w.sunVis, storm: w.storm,
		exposure: THREE.MathUtils.lerp( 0.85 - w.gloom * 0.15, 0.75, dark ),
		ambient: THREE.MathUtils.lerp( 1.6 - w.gloom * 0.6, 0.35, dark ),
		direct: THREE.MathUtils.lerp( 2.6, 0.5, dark ) * ( 0.25 + 0.75 * w.sunVis )
	};

}

function lerpState( cur, tgt, k ) {

	for ( const key in tgt ) {

		if ( tgt[ key ] instanceof THREE.Color ) cur[ key ].lerp( tgt[ key ], k );
		else if ( tgt[ key ] instanceof THREE.Vector3 ) cur[ key ].lerp( tgt[ key ], k ).normalize();
		else cur[ key ] += ( tgt[ key ] - cur[ key ] ) * k;

	}

}

function cloneState( s ) {

	const o = {};
	for ( const key in s ) o[ key ] = s[ key ].clone ? s[ key ].clone() : s[ key ];
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
const starField = new StarField( scene );
const skyTraffic = new SkyTraffic( scene );
const horizonClock = new HorizonClock( scene );

// The real sky over the viewer's region (guessed from their time zone)
const here = observer();
const sky3 = { plan: null, t0: 0, sun: new THREE.Vector3(), moon: new THREE.Vector3(), rot: new THREE.Matrix4() };
const MOONLIGHT = new THREE.Color( 0xaabbe0 );
const SKYGLOW = new THREE.Vector3( 0.3, 1, 0.2 ).normalize();

// Lighting for the whale, gulls and islands (the sea and sky shade themselves)
const hemi = new THREE.HemisphereLight( 0xffffff, 0x223344, 1 );
const sunLight = new THREE.DirectionalLight( 0xffffff, 1 );
scene.add( hemi, sunLight );
const sprayColor = new THREE.Color();
const WHITE = new THREE.Color( 0xffffff );

if ( new URLSearchParams( location.search ).has( 'debug' ) ) window.sea = { get view() { return view; }, wildlife, water, camera, sky3, here, sound, skyTraffic, horizonClock, get state() { return state; } };

let choice = { time: 'sunset', weather: 'clear', extras: { whales: true, gulls: true, islands: true, planes: true, clock: false }, sound: { music: true, ambient: true }, volume: { music: 0.8, ambient: 0.8 }, camera: { float: true } };
try {

	const saved = JSON.parse( localStorage.getItem( 'sea-waves' ) );
	if ( saved && TIMES[ saved.time ] && WEATHERS[ saved.weather ] ) {

		choice.time = saved.time;
		choice.weather = saved.weather;
		Object.assign( choice.extras, saved.extras );
		Object.assign( choice.sound, saved.sound );
		Object.assign( choice.volume, saved.volume );
		Object.assign( choice.camera, saved.camera );

	}

} catch ( e ) { /* storage unavailable */ }

// Work out when the chosen time of day really happens, and where everything is then.
function planSky( t ) {

	sky3.plan = plan( choice.time, here );
	sky3.t0 = t;
	updateSky( t );

}

function updateSky( t ) {

	const jd = julian( sky3.plan.ms + ( t - sky3.t0 ) * 1000 );
	realSunDir( jd, here, sky3.sun );
	realMoonDir( jd, here, sky3.moon );
	skyRotation( jd, here, sky3.rot );
	sky3.lit = 0.5 - 0.5 * sky3.moon.dot( sky3.sun );

}

// After dark the Moon (if it's up) lights the sea; otherwise only faint skyglow does.
// In twilight the glow left in the sky where the sun set adds its own light.
const isDark = ( timeKey ) => TIMES[ timeKey ].dark > 0;

function nightLight( tgt ) {

	const up = THREE.MathUtils.smoothstep( sky3.moon.y, - 0.02, 0.1 );
	const strength = up * Math.sqrt( sky3.lit );
	const dusk = choice.time === 'twilight' ? 0.35 : 0;
	tgt.skySun.copy( sky3.sun );
	if ( up > 0.01 ) tgt.light.copy( sky3.moon );
	else if ( dusk ) tgt.light.set( sky3.sun.x, 0.4, sky3.sun.z ).normalize();
	else tgt.light.copy( SKYGLOW );
	tgt.sun.copy( MOONLIGHT ).multiplyScalar( Math.min( 1, 0.12 + dusk + 0.88 * strength ) );
	tgt.direct = 0.5 * ( 0.15 + dusk + 0.85 * strength ) * ( 0.25 + 0.75 * WEATHERS[ choice.weather ].sunVis );

}

function sunFor( timeKey ) {

	return isDark( timeKey ) ? sky3.sun : sky3.plan.sun;

}

planSky( 0 );
let target = targetState( choice.time, choice.weather, sunFor( choice.time ) );
if ( isDark( choice.time ) ) nightLight( target );
const state = cloneState( target );

// Zoom divides the field of view: 1× is the natural view, up to 6× for a closer look.
const zoom = { value: 1, target: 1, min: 0.8, max: 6 };
let baseFov = 60;

function resize() {

	const w = window.innerWidth, h = window.innerHeight;
	renderer.setSize( w, h, false );
	camera.aspect = w / h;
	// Keep a natural horizontal field of view in portrait on a phone.
	baseFov = w < h ? 72 : 55;
	camera.fov = baseFov / zoom.value;
	camera.updateProjectionMatrix();

}

window.addEventListener( 'resize', resize );
resize();

// ---------- Looking around (touch / mouse drag) ----------

const look = { yaw: 0, pitch: - 0.04, vYaw: 0, vPitch: 0, dragging: false, x: 0, y: 0 };

// Two fingers pinch to zoom; one finger drags to look.
const touches = new Map();
let pinch = null, lastTap = 0;

const zoomLabel = document.getElementById( 'zoomlevel' );
let zoomLabelTimer = 0;
function setZoom( z ) {

	zoom.target = THREE.MathUtils.clamp( z, zoom.min, zoom.max );
	zoomLabel.textContent = `${zoom.target.toFixed( 1 )}×`;
	zoomLabel.classList.add( 'show' );
	clearTimeout( zoomLabelTimer );
	zoomLabelTimer = setTimeout( () => zoomLabel.classList.remove( 'show' ), 900 );
	hideHint();

}

const pinchDistance = () => {

	const [ a, b ] = [ ...touches.values() ];
	return Math.hypot( a.x - b.x, a.y - b.y );

};

canvas.addEventListener( 'pointerdown', ( e ) => {

	touches.set( e.pointerId, { x: e.clientX, y: e.clientY } );
	try {

		canvas.setPointerCapture( e.pointerId );

	} catch ( err ) { /* pointer already gone */ }
	if ( touches.size === 2 ) {

		look.dragging = false;
		pinch = { start: pinchDistance(), zoom: zoom.target };
		return;

	}

	// Double-tap returns to the normal view
	const now = performance.now();
	if ( e.pointerType === 'touch' && now - lastTap < 300 ) setZoom( 1 );
	lastTap = now;

	look.dragging = true;
	look.x = e.clientX;
	look.y = e.clientY;

} );
canvas.addEventListener( 'pointermove', ( e ) => {

	if ( touches.has( e.pointerId ) ) touches.set( e.pointerId, { x: e.clientX, y: e.clientY } );
	if ( pinch && touches.size === 2 ) {

		setZoom( pinch.zoom * pinchDistance() / pinch.start );
		return;

	}

	if ( ! look.dragging ) return;
	// Turn more finely when zoomed in, so the view tracks the finger.
	const s = 2.2 / window.innerHeight / zoom.value;
	look.vYaw = ( e.clientX - look.x ) * s;
	look.vPitch = ( e.clientY - look.y ) * s;
	look.yaw += look.vYaw;
	look.pitch = THREE.MathUtils.clamp( look.pitch + look.vPitch, - 0.6, 0.7 );
	look.x = e.clientX;
	look.y = e.clientY;
	hideHint();

} );
const endDrag = ( e ) => {

	touches.delete( e.pointerId );
	if ( touches.size < 2 ) pinch = null;
	look.dragging = false;

};

canvas.addEventListener( 'pointerup', endDrag );
canvas.addEventListener( 'pointercancel', endDrag );
// Mouse wheel / trackpad zoom on computers
canvas.addEventListener( 'wheel', ( e ) => {

	e.preventDefault();
	setZoom( zoom.target * Math.exp( - e.deltaY * 0.0015 ) );

}, { passive: false } );
// Stop Safari's own page pinch-zoom from fighting ours.
[ 'gesturestart', 'gesturechange' ].forEach( ( t ) => document.addEventListener( t, ( e ) => e.preventDefault() ) );

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
const euler = new THREE.Euler( 0, 0, 0, 'YXZ' );
// Floating: how much the camera rides the waves (eases between 0 and 1 when switched).
const drift = { yaw: 0, path: 0, float: choice.camera.float ? 1 : 0 };
const view = { yaw: 0, pitch: 0, roll: 0 };
let baseYaw = 0, yawGoal = 0;
let frames = 0, fpsTime = 0, adapted = false;

function frame() {

	const dt = Math.min( clock.getDelta(), 0.1 );
	const t = clock.elapsedTime;

	// The real sky keeps turning; at night the light follows the Moon.
	updateSky( t );
	if ( isDark( choice.time ) ) nightLight( target );
	lerpState( state, target, 1 - Math.exp( - dt * 0.9 ) );
	const sunDir = state.light;

	// Sky
	const su = sky.material.uniforms;
	su.time.value = t;
	su.sunDir.value.copy( state.skySun );
	su.topColor.value.copy( state.top );
	su.horizonColor.value.copy( state.horizon );
	su.sunColor.value.copy( state.sun );
	su.sunSize.value = state.sunSize;
	su.sunVisible.value = state.sunVis * state.disk;
	su.moonDir.value.copy( sky3.moon );
	su.moonSun.value.copy( sky3.sun );
	su.moonBright.value = state.moonBright * ( 1 - state.haze * 0.8 );
	su.haze.value = state.haze;
	su.cloudCover.value = state.cover;
	su.cloudLit.value.copy( state.cloudLit );
	su.cloudShade.value.copy( state.cloudShade );
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
	wu.baseGlow.value = state.seaGlow;
	wu.distortionScale.value = 2.5 + state.waves * 1.5;

	// Rain
	rain.material.uniforms.time.value = t;
	rain.material.uniforms.amount.value = state.rain;
	rain.material.uniforms.wind.value = 0.15 + state.storm * 0.35;
	rain.visible = state.rain > 0.01;

	updateLightning( t, dt );
	renderer.toneMappingExposure = state.exposure + flash * 0.6;

	// Floating camera: rides the swell, slowly drifts and sways (unless switched off).
	drift.float += ( ( choice.camera.float ? 1 : 0 ) - drift.float ) * Math.min( 1, dt * 0.8 );
	const f = drift.float;
	drift.path += dt * f;
	// Drift around a wide, slow circle so we never sail into an island.
	const cx = 250 * Math.sin( drift.path * 0.0024 ), cz = 250 * ( 1 - Math.cos( drift.path * 0.0024 ) );
	const h = waveHeight( cx, cz, t, state.waves );
	const e = 1.2;
	const hx = waveHeight( cx + e, cz, t, state.waves ) - h;
	const hz = waveHeight( cx, cz + e, t, state.waves ) - h;
	// Held steady, sit a little higher so storm crests stay below the camera.
	camera.position.set( cx, 2.6 + THREE.MathUtils.lerp( state.waves * 1.2, h * 0.85, f ), cz );
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
	drift.yaw += ( Math.cos( drift.path * 0.05 ) * 0.0125 + 0.004 ) * dt * f;
	// The camera's heading and the rocking from the waves; the clock rides with these.
	view.yaw = baseYaw + drift.yaw + look.yaw;
	view.pitch = ( hz * 0.25 + Math.sin( t * 0.7 ) * 0.006 ) * f;
	view.roll = ( - hx * 0.3 + Math.sin( t * 0.5 ) * 0.01 ) * f;
	euler.set( look.pitch + view.pitch, view.yaw, view.roll );
	camera.quaternion.setFromEuler( euler );

	// Ease the zoom toward its target
	if ( Math.abs( zoom.target - zoom.value ) > 0.001 ) {

		zoom.value += ( zoom.target - zoom.value ) * ( 1 - Math.exp( - dt * 12 ) );
		camera.fov = baseFov / zoom.value;
		camera.updateProjectionMatrix();

	}

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
	starField.update( camera, sky3.rot, {
		time: t, cloudCover: state.cover, visible: state.stars, haze: state.haze,
		pixelRatio: renderer.getPixelRatio()
	} );
	skyTraffic.update( t, dt, camera, {
		cloudCover: state.cover, haze: state.haze, dark: state.dark, stars: state.stars * ( 1 - state.haze ),
		trailColor: state.trail, pixelRatio: renderer.getPixelRatio(),
		pixelScale: renderer.domElement.height / ( 2 * Math.tan( THREE.MathUtils.degToRad( camera.fov ) / 2 ) )
	} );
	horizonClock.update( t, dt, camera, look.pitch, {
		core: state.clockCore,
		fogColor: scene.fog.color, fogDensity: state.fog, dim: 1 - state.rain * 0.2
	} );

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

// Face the sun when a time of day is chosen; at night face the Moon, or if it has
// set, the part of the sky away from the pole where the zodiac constellations are.
function faceSun( instant ) {

	let d = sunFor( choice.time );
	if ( choice.time === 'night' ) d = sky3.moon.y > 0.05 ? sky3.moon : toWorld( 0.5, here.lat >= 0 ? Math.PI : 0 );
	// In twilight face the afterglow where the sun went down.
	// The camera looks down -Z at yaw 0.
	let goal = Math.atan2( - d.x, - d.z ) - drift.yaw - look.yaw;
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
const toggles = { music: document.getElementById( 'music' ), ambient: document.getElementById( 'ambient' ) };
const beginBtn = document.getElementById( 'begin' );
let started = false;

const skyInfo = document.getElementById( 'skyinfo' );
function showSkyInfo() {

	const when = new Date( sky3.plan.ms );
	const now = Math.abs( sky3.plan.ms - Date.now() ) < 60000;
	const time = when.toLocaleTimeString( [], { hour: '2-digit', minute: '2-digit' } );
	const day = when.toDateString() === new Date().toDateString() ? 'today' : when.toLocaleDateString( [], { weekday: 'short' } );
	skyInfo.textContent = `Real sky over ${here.place} · ${now ? 'right now' : `${day} ${time}`} · Moon ${Math.round( sky3.lit * 100 )}% lit`;

}

function hideHint() {

	hint.classList.add( 'gone' );

}

function syncChips() {

	document.querySelectorAll( '[data-time]' ).forEach( ( b ) => b.setAttribute( 'aria-pressed', b.dataset.time === choice.time ) );
	document.querySelectorAll( '[data-weather]' ).forEach( ( b ) => b.setAttribute( 'aria-pressed', b.dataset.weather === choice.weather ) );
	document.querySelectorAll( '[data-extra]' ).forEach( ( b ) => b.setAttribute( 'aria-pressed', choice.extras[ b.dataset.extra ] ) );

}

function save() {

	try {

		localStorage.setItem( 'sea-waves', JSON.stringify( choice ) );

	} catch ( e ) { /* ignore */ }

}

function apply( turn ) {

	if ( turn ) planSky( clock.elapsedTime );
	target = targetState( choice.time, choice.weather, sunFor( choice.time ) );
	if ( isDark( choice.time ) ) nightLight( target );
	showSkyInfo();
	sound.setScene( choice.time, choice.weather );
	wildlife.setConditions( choice.time, choice.weather );
	wildlife.setEnabled( choice.extras );
	skyTraffic.setPlanes( choice.extras.planes );
	horizonClock.setOn( choice.extras.clock );
	if ( turn ) faceSun();
	save();

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
	idleTimer = setTimeout( () => {

		closeMixer();
		hud.classList.add( 'idle' );

	}, 4000 );

}

[ 'pointerdown', 'pointermove', 'touchstart' ].forEach( ( type ) => window.addEventListener( type, wake, { passive: true } ) );

// Sound: music and the ocean & nature sounds each have an on/off switch and a
// volume. The switches in settings and the dropdown under the corner buttons all
// show the same state.
const soundButtons = { music: document.getElementById( 'musicBtn' ), ambient: document.getElementById( 'ambientBtn' ) };
const mixer = document.getElementById( 'mixer' );
const mix = {};
for ( const row of mixer.querySelectorAll( '[data-mix]' ) ) {

	mix[ row.dataset.mix ] = { row, toggle: row.querySelector( 'input[type=checkbox]' ), slider: row.querySelector( 'input[type=range]' ), out: row.querySelector( 'output' ) };

}

function applySound() {

	sound.setMusic( choice.sound.music, choice.volume.music );
	sound.setAmbient( choice.sound.ambient, choice.volume.ambient );
	for ( const key in toggles ) {

		const on = choice.sound[ key ] && choice.volume[ key ] > 0, pct = Math.round( choice.volume[ key ] * 100 );
		toggles[ key ].checked = on;
		soundButtons[ key ].setAttribute( 'aria-pressed', on );
		mix[ key ].toggle.checked = on;
		mix[ key ].row.classList.toggle( 'off', ! on );
		mix[ key ].slider.value = pct;
		mix[ key ].slider.style.setProperty( '--fill', `${pct}%` );
		mix[ key ].out.textContent = `${pct}%`;

	}

}

function setSound( key, on ) {

	choice.sound[ key ] = on;
	// Switching on a channel whose volume was dragged to zero brings it back to a sensible level.
	if ( on && choice.volume[ key ] === 0 ) choice.volume[ key ] = 0.5;
	if ( on ) sound.start(); // the tap that turned it on is the gesture iOS needs
	applySound();
	save();

}

function setVolume( key, volume ) {

	choice.volume[ key ] = volume;
	choice.sound[ key ] = volume > 0;
	if ( volume > 0 ) sound.start();
	applySound();

}

function openMixer( key ) {

	const open = mixer.hidden || ! mix[ key ].row.classList.contains( 'focus' );
	mixer.hidden = ! open;
	for ( const k in mix ) mix[ k ].row.classList.toggle( 'focus', open && k === key );
	for ( const k in soundButtons ) soundButtons[ k ].setAttribute( 'aria-expanded', open && k === key );

}

function closeMixer() {

	if ( mixer.hidden ) return;
	mixer.hidden = true;
	for ( const k in soundButtons ) soundButtons[ k ].setAttribute( 'aria-expanded', false );

}

const floatToggle = document.getElementById( 'float' );
floatToggle.checked = choice.camera.float;
floatToggle.addEventListener( 'change', () => {

	choice.camera.float = floatToggle.checked;
	save();

} );

for ( const key in toggles ) {

	toggles[ key ].addEventListener( 'change', () => setSound( key, toggles[ key ].checked ) );
	mix[ key ].toggle.addEventListener( 'change', () => setSound( key, mix[ key ].toggle.checked ) );
	mix[ key ].slider.addEventListener( 'input', () => setVolume( key, mix[ key ].slider.value / 100 ) );
	mix[ key ].slider.addEventListener( 'change', save );
	soundButtons[ key ].addEventListener( 'click', () => openMixer( key ) );

}

// Tapping the sea closes the dropdown.
canvas.addEventListener( 'pointerdown', closeMixer );

beginBtn.addEventListener( 'click', () => {

	menu.classList.add( 'hidden' );
	hud.classList.remove( 'hidden' );
	wake();
	if ( choice.sound.music || choice.sound.ambient ) sound.start();
	applySound();
	if ( ! started ) setTimeout( hideHint, 6000 );
	started = true;

} );

document.getElementById( 'settings' ).addEventListener( 'click', () => {

	closeMixer();
	beginBtn.textContent = 'Back to the sea';
	menu.classList.remove( 'hidden' );
	hud.classList.add( 'hidden' );

} );

syncChips();
applySound();
apply( true );
