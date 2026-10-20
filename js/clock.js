import * as THREE from 'three';

// A giant clock standing on the horizon, like a screen saver. It's a real object in
// the scene, so the sea reflects it. It is held in front of the camera and moves
// with it, so it stays perfectly still on screen while the sea rocks around it.

const DIST = 3000, HEIGHT = 530, LIFT = 30; // metres
const W = 1024, H = 420; // texture size

const FONT = '-apple-system, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif';

export class HorizonClock {

	constructor( scene ) {

		// Channels: red = text, blue = the colon (so it can pulse on its own).
		this.canvas = document.createElement( 'canvas' );
		this.canvas.width = W;
		this.canvas.height = H;
		this.texture = new THREE.CanvasTexture( this.canvas );
		this.texture.colorSpace = THREE.NoColorSpace;
		this.texture.anisotropy = 4;

		this.uniforms = {
			map: { value: this.texture },
			core: { value: new THREE.Color() },
			colon: { value: 1 },
			opacity: { value: 0 },
			fogColor: { value: new THREE.Color() },
			fogAmount: { value: 0 }
		};

		this.mesh = new THREE.Mesh( new THREE.PlaneGeometry( HEIGHT * W / H, HEIGHT ), new THREE.ShaderMaterial( {
			uniforms: this.uniforms,
			transparent: true,
			fog: false,
			vertexShader: /* glsl */`
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
			fragmentShader: /* glsl */`
				uniform sampler2D map;
				uniform vec3 core;
				uniform float colon;
				uniform float opacity;
				uniform vec3 fogColor;
				uniform float fogAmount;
				varying vec2 vUv;
				void main() {
					vec4 t = texture2D( map, vUv );
					float a = max( t.r, t.b * colon ) * opacity;
					if ( a < 0.01 ) discard; // keep empty parts from hiding stars behind
					gl_FragColor = vec4( mix( core, fogColor, fogAmount ), a );
					#include <tonemapping_fragment>
					#include <colorspace_fragment>
				}`
		} ) );
		this.mesh.visible = false;
		this.mesh.frustumCulled = false;
		scene.add( this.mesh );

		this.on = false;
		this.fade = 0;
		this.drawn = '';
		this.hour12 = /h1[12]/.test( new Intl.DateTimeFormat( [], { hour: 'numeric' } ).resolvedOptions().hourCycle || '' );
		this.untilt = new THREE.Quaternion();
		this.xAxis = new THREE.Vector3( 1, 0, 0 );
		this.offset = new THREE.Vector3();

	}

	draw( now ) {

		let h = now.getHours();
		const m = String( now.getMinutes() ).padStart( 2, '0' );
		let suffix = '';
		if ( this.hour12 ) {

			suffix = h < 12 ? 'AM' : 'PM';
			h = h % 12 || 12;

		}

		const hh = this.hour12 ? String( h ) : String( h ).padStart( 2, '0' );
		const date = now.toLocaleDateString( [], { weekday: 'short', month: 'short', day: 'numeric' } );
		const key = hh + m + suffix + date;
		if ( key === this.drawn ) return;
		this.drawn = key;

		const c = this.canvas.getContext( '2d' );
		c.clearRect( 0, 0, W, H );
		c.textBaseline = 'alphabetic';
		const timeFont = `200 290px ${ FONT }`;
		c.font = timeFont;
		const wh = c.measureText( hh ).width, wc = c.measureText( ':' ).width, wm = c.measureText( m ).width;
		c.font = `300 64px ${ FONT }`;
		const ws = suffix ? c.measureText( suffix ).width + 18 : 0;
		const x0 = ( W - ( wh + wc + wm + ws ) ) / 2, base = 300;

		const layout = ( fill, colonFill ) => {

			c.save();
			c.fillStyle = fill;
			c.font = timeFont;
			c.fillText( hh, x0, base );
			c.fillStyle = colonFill;
			c.fillText( ':', x0 + wh, base - 18 );
			c.fillStyle = fill;
			c.fillText( m, x0 + wh + wc, base );
			c.font = `300 64px ${ FONT }`;
			if ( suffix ) c.fillText( suffix, x0 + wh + wc + wm + 18, base - 180 );
			c.font = `400 50px ${ FONT }`;
			if ( 'letterSpacing' in c ) c.letterSpacing = '6px';
			c.textAlign = 'center';
			c.fillText( date.toUpperCase(), W / 2, base + 82 );
			c.restore();

		};

		layout( 'rgb(255,0,0)', 'rgb(0,0,255)' );
		this.texture.needsUpdate = true;

	}

	setOn( on ) {

		this.on = on;

	}

	// lookPitch: how far the user has tilted the view up or down. The clock takes the
	// camera's exact rotation minus that tilt, so it never moves on screen as the sea
	// rocks the camera, yet still stands on the horizon when you look up or down.
	update( t, dt, camera, lookPitch, { core, fogColor, fogDensity, dim } ) {

		this.fade += ( ( this.on ? 1 : 0 ) - this.fade ) * Math.min( 1, dt * 1.5 );
		this.mesh.visible = this.fade > 0.01;
		if ( ! this.mesh.visible ) return;

		this.draw( new Date() );

		this.untilt.setFromAxisAngle( this.xAxis, - lookPitch );
		this.mesh.quaternion.copy( camera.quaternion ).multiply( this.untilt );
		this.offset.set( 0, LIFT + HEIGHT / 2 - camera.position.y, - DIST ).applyQuaternion( this.mesh.quaternion );
		this.mesh.position.copy( camera.position ).add( this.offset );

		const u = this.uniforms;
		u.core.value.copy( core );
		u.colon.value = 0.7 + 0.3 * Math.cos( t * Math.PI ); // a slow, soft pulse
		u.fogColor.value.copy( fogColor );
		// Same haze as everything else this far out, but never so much it can't be read
		u.fogAmount.value = Math.min( 0.45, 1 - Math.exp( - ( ( DIST * fogDensity ) ** 2 ) ) );
		u.opacity.value = this.fade * dim;

	}

}
