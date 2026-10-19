import * as THREE from 'three';
import { waveHeight } from './ocean.js';

// Whales, seagulls and distant islands. Everything is modelled in code.

const rand = ( a, b ) => a + Math.random() * ( b - a );
const ss = ( x, a, b ) => THREE.MathUtils.smoothstep( x, a, b );

// ---------- Geometry helpers ----------

function paint( g, fn ) {

	const p = g.attributes.position, c = new Float32Array( p.count * 3 ), col = new THREE.Color();
	for ( let i = 0; i < p.count; i ++ ) {

		fn( p.getX( i ), p.getY( i ), p.getZ( i ), col );
		c.set( [ col.r, col.g, col.b ], i * 3 );

	}

	g.setAttribute( 'color', new THREE.BufferAttribute( c, 3 ) );
	return g;

}

function solid( g, hex ) {

	const c = new THREE.Color( hex );
	return paint( g, ( x, y, z, col ) => col.copy( c ) );

}

function merge( geoms ) {

	const parts = geoms.map( ( g ) => g.index ? g.toNonIndexed() : g );
	const out = new THREE.BufferGeometry();
	for ( const name of [ 'position', 'normal', 'color' ] ) {

		const arr = new Float32Array( parts.reduce( ( n, g ) => n + g.attributes[ name ].array.length, 0 ) );
		let o = 0;
		for ( const g of parts ) {

			arr.set( g.attributes[ name ].array, o );
			o += g.attributes[ name ].array.length;

		}

		out.setAttribute( name, new THREE.BufferAttribute( arr, 3 ) );

	}

	return out;

}

function hashNoise( seed ) {

	const h = ( x, y ) => {

		const s = Math.sin( x * 127.1 + y * 311.7 + seed * 74.7 ) * 43758.5453;
		return s - Math.floor( s );

	};

	const vnoise = ( x, y ) => {

		const xi = Math.floor( x ), yi = Math.floor( y );
		let u = x - xi, v = y - yi;
		u = u * u * ( 3 - 2 * u );
		v = v * v * ( 3 - 2 * v );
		const a = h( xi, yi ) + ( h( xi + 1, yi ) - h( xi, yi ) ) * u;
		const b = h( xi, yi + 1 ) + ( h( xi + 1, yi + 1 ) - h( xi, yi + 1 ) ) * u;
		return a + ( b - a ) * v;

	};

	return ( x, y ) => {

		let s = 0, a = 0.5;
		for ( let i = 0; i < 5; i ++ ) {

			s += a * vnoise( x, y );
			x *= 2.1;
			y *= 2.1;
			a *= 0.5;

		}

		return s;

	};

}

// ---------- Whale (humpback, ~14 m, head toward +z) ----------

function whaleModel() {

	const mat = new THREE.MeshStandardMaterial( { vertexColors: true, roughness: 0.4, metalness: 0 } );
	const dark = new THREE.Color( 0x343d45 ), light = new THREE.Color( 0xcfd4d6 );
	const mottle = hashNoise( 3 );
	const whale = new THREE.Group();
	whale.rotation.order = 'YXZ';

	// Body: a lathe along the spine, slightly flattened
	const profile = [ [ 0, 0.14 ], [ 0.08, 0.3 ], [ 0.22, 0.7 ], [ 0.42, 1.28 ], [ 0.6, 1.58 ], [ 0.76, 1.5 ], [ 0.88, 1.18 ], [ 0.95, 0.8 ], [ 0.99, 0.34 ], [ 1, 0 ] ];
	const pts = new THREE.SplineCurve( profile.map( ( [ s, r ] ) => new THREE.Vector2( r, s * 14 - 7 ) ) ).getPoints( 48 );
	pts.forEach( ( p ) => p.x = Math.max( p.x, 0 ) );
	const body = new THREE.LatheGeometry( pts, 28 );
	body.rotateX( Math.PI / 2 );
	body.scale( 1, 0.82, 1 );
	paint( body, ( x, y, z, col ) => {

		col.copy( dark ).lerp( light, 1 - ss( y, - 0.9, - 0.25 ) );
		col.multiplyScalar( 0.85 + 0.3 * mottle( x * 0.8, z * 0.8 ) );

	} );
	whale.add( new THREE.Mesh( body, mat ) );

	// Small dorsal fin
	const dorsal = new THREE.ConeGeometry( 0.32, 0.7, 8 );
	dorsal.scale( 0.35, 1, 1.5 );
	dorsal.rotateX( - 0.6 );
	dorsal.translate( 0, 0.8, - 3.1 );
	whale.add( new THREE.Mesh( solid( dorsal, 0x22292e ), mat ) );

	// Long pectoral fins (white underneath), on pivots so they can flap
	const fins = [];
	for ( const side of [ 1, - 1 ] ) {

		const g = new THREE.SphereGeometry( 1, 16, 8 );
		g.scale( 2.2, 0.09, 0.42 );
		g.translate( 2.1 * side, 0, 0 );
		paint( g, ( x, y, z, col ) => col.copy( dark ).lerp( light, 0.35 + 0.65 * ( 1 - ss( y, - 0.05, 0.06 ) ) ) );
		const pivot = new THREE.Group();
		pivot.position.set( 1.1 * side, - 0.55, 2.6 );
		pivot.rotation.order = 'YXZ';
		pivot.rotation.y = 0.6 * side;
		pivot.add( new THREE.Mesh( g, mat ) );
		whale.add( pivot );
		fins.push( { pivot, side } );

	}

	// Tail flukes
	const sh = new THREE.Shape();
	sh.moveTo( 0, 0.25 );
	sh.quadraticCurveTo( 1.0, 0.1, 2.3, - 0.95 );
	sh.quadraticCurveTo( 1.4, - 0.72, 0.25, - 0.95 );
	sh.lineTo( 0, - 0.75 );
	sh.lineTo( - 0.25, - 0.95 );
	sh.quadraticCurveTo( - 1.4, - 0.72, - 2.3, - 0.95 );
	sh.quadraticCurveTo( - 1.0, 0.1, 0, 0.25 );
	const fg = new THREE.ExtrudeGeometry( sh, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 10 } );
	fg.translate( 0, 0, - 0.05 );
	fg.rotateX( Math.PI / 2 );
	paint( fg, ( x, y, z, col ) => col.copy( dark ).lerp( light, y < 0 ? 0.6 : 0 ) );
	const flukes = new THREE.Group();
	flukes.position.set( 0, 0, - 6.9 );
	flukes.add( new THREE.Mesh( fg, mat ) );
	whale.add( flukes );

	whale.userData = { fins, flukes };
	whale.visible = false;
	return whale;

}

// ---------- Seagull (~1.4 m wingspan, facing +z) ----------

function wingGeometry( outer ) {

	const v = outer ?
		[ 0, 0, 0.09, 0, 0, - 0.08, 0.3, 0, 0.03, 0.3, 0, 0.03, 0, 0, - 0.08, 0.3, 0, - 0.09, 0.3, 0, 0.03, 0.3, 0, - 0.09, 0.45, 0, - 0.1 ] :
		[ 0, 0, 0.11, 0, 0, - 0.1, 0.36, 0, 0.09, 0.36, 0, 0.09, 0, 0, - 0.1, 0.36, 0, - 0.08 ];
	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( v, 3 ) );
	g.computeVertexNormals();
	const grey = new THREE.Color( 0xaab2ba ), tip = new THREE.Color( 0x1c1f22 );
	return paint( g, ( x, y, z, col ) => col.copy( grey ).lerp( tip, outer ? ss( x, 0.22, 0.32 ) : 0 ) );

}

function gullModel( mat, wings ) {

	const gull = new THREE.Group();
	gull.rotation.order = 'YXZ';

	const body = new THREE.SphereGeometry( 1, 10, 8 );
	body.scale( 0.075, 0.075, 0.26 );
	const head = new THREE.SphereGeometry( 0.06, 8, 6 );
	head.translate( 0, 0.03, 0.24 );
	const beak = new THREE.ConeGeometry( 0.014, 0.07, 6 );
	beak.rotateX( Math.PI / 2 );
	beak.translate( 0, 0.02, 0.32 );
	const tail = new THREE.BufferGeometry();
	tail.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, - 0.18, - 0.07, 0, - 0.34, 0.07, 0, - 0.34 ], 3 ) );
	tail.computeVertexNormals();
	gull.add( new THREE.Mesh( merge( [ solid( body, 0xf4f4f1 ), solid( head, 0xf8f8f6 ), solid( beak, 0xe8b830 ), solid( tail, 0xeeeeea ) ] ), mat ) );

	const parts = [];
	for ( const side of [ 1, - 1 ] ) {

		const inner = new THREE.Group();
		inner.position.set( 0.05 * side, 0.03, 0.03 );
		inner.scale.x = side;
		inner.add( new THREE.Mesh( wings.inner, mat ) );
		const outer = new THREE.Group();
		outer.position.x = 0.36;
		outer.add( new THREE.Mesh( wings.outer, mat ) );
		inner.add( outer );
		gull.add( inner );
		parts.push( { inner, outer, side } );

	}

	gull.userData.wings = parts;
	gull.scale.setScalar( 1.15 );
	gull.visible = false;
	return gull;

}

// ---------- Islands ----------

const ISLAND_COLORS = {
	forest: new THREE.Color( 0x34502e ),
	scrub: new THREE.Color( 0x5d6a3e ),
	rock: new THREE.Color( 0x6e665a ),
	limestone: new THREE.Color( 0xa8a293 ),
	sand: new THREE.Color( 0xc2b08a )
};

// Height (0..1) of each kind of island for a point with coast distance m (0 at the
// shore, rising inland) and local coordinates x, z in [-1, 1].
const ISLAND_SHAPES = {

	// Rolling green hills with an uneven ridgeline
	hills: ( m, x, z, n ) => Math.pow( ss( m, 0, 0.75 ), 1.2 ) * ( 0.35 + 0.8 * n( x * 2.2 + 3, z * 2.2 ) ) +
		0.15 * ss( m, 0.15, 0.6 ) * n( x * 7, z * 7 ),

	// Sheer cliffs straight out of the sea with a gently undulating top
	mesa: ( m, x, z, n ) => ss( m, 0, 0.07 ) * ( 0.55 + 0.25 * ss( m, 0.05, 0.6 ) + 0.25 * n( x * 4, z * 4 ) ),

	// Low islet: a sandy rim, then a canopy of trees
	cay: ( m, x, z, n ) => 0.15 * ss( m, 0, 0.08 ) + 0.85 * ss( m, 0.1, 0.25 ) * ( 0.55 + 0.45 * n( x * 14, z * 14 ) ),

	// Limestone pillars with rounded, bushy tops
	stack: ( m, x, z, n ) => ss( m, 0, 0.12 ) * ( 0.7 + 0.3 * n( x * 5, z * 5 ) ) * ( 0.55 + 0.45 * Math.sqrt( ss( m, 0.05, 0.8 ) ) ),

	// A long, far coastline of overlapping ridges
	coast: ( m, x, z, n ) => Math.pow( ss( m, 0, 0.6 ), 1.1 ) * ( 0.25 + 0.9 * n( x * 7 + 1, z * 1.5 ) )

};

function islandGeometry( type, W, D, H ) {

	const n = hashNoise( Math.random() * 1000 );
	const segX = type === 'coast' ? 200 : 96, segZ = type === 'coast' ? 40 : 96;
	const g = new THREE.PlaneGeometry( 2, 2, segX, segZ );
	g.rotateX( - Math.PI / 2 );
	const shape = ISLAND_SHAPES[ type ];
	const p = g.attributes.position;
	const heights = new Float32Array( p.count );

	for ( let i = 0; i < p.count; i ++ ) {

		const x = p.getX( i ), z = p.getZ( i );
		// Irregular coastline: the outline radius wobbles with angle, and bays bite in.
		const a = Math.atan2( z, x );
		const outline = 0.6 + 0.32 * n( Math.cos( a ) * 1.3 + 7, Math.sin( a ) * 1.3 + 7 );
		const r = Math.hypot( x, z ) / outline + 0.35 * ( n( x * 3 + 20, z * 3 ) - 0.5 );
		const m = THREE.MathUtils.clamp( 1 - r, 0, 1 );
		const h = shape( m, x, z, n ) * ( 1 - ss( Math.hypot( x, z ), 0.85, 0.98 ) );
		heights[ i ] = h;
		p.setXYZ( i, x * W / 2, h * H - Math.max( 3, H * 0.06 ), z * D / 2 );

	}

	g.computeVertexNormals();

	// Paint by slope and height: rock on steep faces, green on gentle ground, a pale
	// band where the land meets the water.
	const nrm = g.attributes.normal, c = ISLAND_COLORS, col = new THREE.Color();
	const shore = type === 'cay' || type === 'hills' ? c.sand : type === 'stack' ? c.limestone : c.rock;
	const cliff = type === 'stack' || type === 'mesa' ? c.limestone : c.rock;
	const colors = new Float32Array( p.count * 3 );
	for ( let i = 0; i < p.count; i ++ ) {

		const steep = 1 - ss( nrm.getY( i ), 0.55, 0.8 );
		col.copy( c.forest ).lerp( c.scrub, n( p.getX( i ) * 0.01, p.getZ( i ) * 0.01 ) * 0.8 );
		col.lerp( cliff, steep );
		col.lerp( shore, 1 - ss( heights[ i ] * H, 2, Math.max( 6, H * 0.08 ) ) );
		col.multiplyScalar( 0.85 + 0.3 * n( p.getX( i ) * 0.05 + 50, p.getZ( i ) * 0.05 ) );
		colors.set( [ col.r, col.g, col.b ], i * 3 );

	}

	g.setAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );
	return g;

}

// ---------- Spray particles ----------

class Spray {

	constructor( scene, max = 1500 ) {

		this.max = max;
		this.next = 0;
		this.alive = 0;
		this.pos = new Float32Array( max * 3 );
		this.vel = new Float32Array( max * 3 );
		this.life = new Float32Array( max );
		this.total = new Float32Array( max );
		this.base = new Float32Array( max );
		this.grow = new Float32Array( max );
		this.grav = new Float32Array( max );
		this.drag = new Float32Array( max );
		this.alpha = new Float32Array( max );
		this.size = new Float32Array( max );

		const g = new THREE.BufferGeometry();
		this.posAttr = new THREE.BufferAttribute( this.pos, 3 ).setUsage( THREE.DynamicDrawUsage );
		this.alphaAttr = new THREE.BufferAttribute( this.alpha, 1 ).setUsage( THREE.DynamicDrawUsage );
		this.sizeAttr = new THREE.BufferAttribute( this.size, 1 ).setUsage( THREE.DynamicDrawUsage );
		g.setAttribute( 'position', this.posAttr );
		g.setAttribute( 'aAlpha', this.alphaAttr );
		g.setAttribute( 'aSize', this.sizeAttr );

		this.material = new THREE.ShaderMaterial( {
			transparent: true,
			depthWrite: false,
			fog: true,
			uniforms: THREE.UniformsUtils.merge( [ THREE.UniformsLib.fog, {
				color: { value: new THREE.Color( 0xffffff ) },
				scale: { value: 800 }
			} ] ),
			vertexShader: /* glsl */`
				attribute float aAlpha;
				attribute float aSize;
				uniform float scale;
				varying float vAlpha;
				#include <fog_pars_vertex>
				void main() {
					vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
					gl_PointSize = aSize * scale / max( - mvPosition.z, 0.1 );
					gl_Position = projectionMatrix * mvPosition;
					vAlpha = aAlpha;
					#include <fog_vertex>
				}`,
			fragmentShader: /* glsl */`
				uniform vec3 color;
				varying float vAlpha;
				#include <fog_pars_fragment>
				void main() {
					float d = length( gl_PointCoord - 0.5 );
					float a = smoothstep( 0.5, 0.1, d ) * vAlpha;
					if ( a < 0.01 ) discard;
					gl_FragColor = vec4( color, a );
					#include <tonemapping_fragment>
					#include <colorspace_fragment>
					#include <fog_fragment>
				}`
		} );

		this.points = new THREE.Points( g, this.material );
		this.points.frustumCulled = false;
		scene.add( this.points );

	}

	emit( p, v, { size = 0.5, life = 2, grow = 0, grav = 9.8, drag = 0.2 } = {} ) {

		const i = this.next;
		this.next = ( this.next + 1 ) % this.max;
		this.pos.set( [ p.x, p.y, p.z ], i * 3 );
		this.vel.set( [ v.x, v.y, v.z ], i * 3 );
		this.life[ i ] = this.total[ i ] = life;
		this.base[ i ] = size;
		this.grow[ i ] = grow;
		this.grav[ i ] = grav;
		this.drag[ i ] = drag;
		this.alive = this.max;

	}

	update( dt ) {

		if ( ! this.alive ) return;
		let alive = 0;
		for ( let i = 0; i < this.max; i ++ ) {

			if ( this.life[ i ] <= 0 ) {

				this.alpha[ i ] = 0;
				continue;

			}

			alive ++;
			this.life[ i ] -= dt;
			const k = Math.exp( - this.drag[ i ] * dt ), j = i * 3;
			this.vel[ j ] *= k;
			this.vel[ j + 2 ] *= k;
			this.vel[ j + 1 ] = this.vel[ j + 1 ] * k - this.grav[ i ] * dt;
			this.pos[ j ] += this.vel[ j ] * dt;
			this.pos[ j + 1 ] += this.vel[ j + 1 ] * dt;
			this.pos[ j + 2 ] += this.vel[ j + 2 ] * dt;
			const age = 1 - this.life[ i ] / this.total[ i ];
			this.alpha[ i ] = Math.min( 1, age * 10 ) * ( 1 - age ) * 0.8;
			this.size[ i ] = this.base[ i ] * ( 1 + this.grow[ i ] * age );
			if ( this.pos[ j + 1 ] < - 1.5 ) this.life[ i ] = 0;

		}

		this.alive = alive;
		this.posAttr.needsUpdate = this.alphaAttr.needsUpdate = this.sizeAttr.needsUpdate = true;

	}

}

// ---------- Foam patches left on the water ----------

function foamTexture() {

	const c = document.createElement( 'canvas' );
	c.width = c.height = 256;
	const x = c.getContext( '2d' );
	for ( let i = 0; i < 1600; i ++ ) {

		const a = Math.random() * Math.PI * 2, r = Math.pow( Math.random(), 0.6 ) * 118;
		const px = 128 + Math.cos( a ) * r, py = 128 + Math.sin( a ) * r, s = rand( 2, 9 );
		const gr = x.createRadialGradient( px, py, 0, px, py, s );
		gr.addColorStop( 0, 'rgba(255,255,255,0.35)' );
		gr.addColorStop( 1, 'rgba(255,255,255,0)' );
		x.fillStyle = gr;
		x.fillRect( px - s, py - s, s * 2, s * 2 );

	}

	x.globalCompositeOperation = 'destination-in';
	const edge = x.createRadialGradient( 128, 128, 0, 128, 128, 128 );
	edge.addColorStop( 0, 'rgba(0,0,0,0.6)' );
	edge.addColorStop( 0.55, 'rgba(0,0,0,1)' );
	edge.addColorStop( 1, 'rgba(0,0,0,0)' );
	x.fillStyle = edge;
	x.fillRect( 0, 0, 256, 256 );
	const t = new THREE.CanvasTexture( c );
	t.colorSpace = THREE.SRGBColorSpace;
	return t;

}

class Foam {

	constructor( scene, count = 5 ) {

		const map = foamTexture();
		this.patches = Array.from( { length: count }, () => {

			const g = new THREE.PlaneGeometry( 2, 2, 12, 12 );
			g.rotateX( - Math.PI / 2 );
			const base = g.attributes.position.array.slice();
			const mesh = new THREE.Mesh( g, new THREE.MeshBasicMaterial( { map, transparent: true, depthWrite: false } ) );
			mesh.frustumCulled = false;
			mesh.visible = false;
			scene.add( mesh );
			return { mesh, base, age: 0, life: 0 };

		} );

	}

	spawn( x, z, r0, r1, life, opacity ) {

		const p = this.patches.reduce( ( a, b ) => ( b.life - b.age < a.life - a.age ? b : a ) );
		Object.assign( p, { x, z, r0, r1, life, opacity, age: 0 } );
		p.mesh.visible = true;

	}

	update( t, dt, waveScale, color ) {

		for ( const p of this.patches ) {

			if ( ! p.mesh.visible ) continue;
			p.age += dt;
			const k = p.age / p.life;
			if ( k >= 1 ) {

				p.mesh.visible = false;
				continue;

			}

			const r = p.r0 + ( p.r1 - p.r0 ) * ( 1 - ( 1 - k ) ** 2 );
			const pos = p.mesh.geometry.attributes.position;
			for ( let i = 0; i < pos.count; i ++ ) {

				const wx = p.x + p.base[ i * 3 ] * r, wz = p.z + p.base[ i * 3 + 2 ] * r;
				pos.setXYZ( i, wx, waveHeight( wx, wz, t, waveScale ) + 0.18, wz );

			}

			pos.needsUpdate = true;
			p.mesh.material.opacity = p.opacity * Math.min( 1, k * 8 ) * ( 1 - k ) ** 1.5;
			p.mesh.material.color.copy( color );

		}

	}

}

// ---------- The whole cast ----------

export class Wildlife {

	constructor( scene, sound ) {

		this.sound = sound;
		this.enabled = { whales: true, gulls: true, islands: true };
		this.gullsAllowed = true;
		this.gullChance = 1;

		this.spray = new Spray( scene );
		this.foam = new Foam( scene );

		this.whale = whaleModel();
		scene.add( this.whale );
		this.event = null;
		this.nextWhale = rand( 25, 45 );

		const gullMat = new THREE.MeshStandardMaterial( { vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 } );
		const wings = { inner: wingGeometry( false ), outer: wingGeometry( true ) };
		this.gulls = Array.from( { length: 6 }, () => {

			const g = gullModel( gullMat, wings );
			scene.add( g );
			return g;

		} );
		this.flock = null;
		this.nextFlock = rand( 8, 15 );

		this.islands = new THREE.Group();
		this.buildIslands();
		scene.add( this.islands );

		this.tmp = new THREE.Vector3();
		this.tmp2 = new THREE.Vector3();
		this.camPos = new THREE.Vector3();
		this.camFwd = new THREE.Vector3();
		this.camRight = new THREE.Vector3();

	}

	buildIslands( pick, b0 = Math.random() * Math.PI * 2 ) {

		const mat = new THREE.MeshStandardMaterial( { vertexColors: true, roughness: 1 } );
		const add = ( type, bearing, dist, W, D, H ) => {

			const mesh = new THREE.Mesh( islandGeometry( type, W, D, H ), mat );
			mesh.position.set( Math.sin( bearing ) * dist, 0, Math.cos( bearing ) * dist );
			// Long side roughly facing us
			mesh.rotation.y = bearing + Math.PI / 2 + rand( - 0.3, 0.3 );
			this.islands.add( mesh );

		};

		const scenes = {

			// A big hilly island with smaller islets and rocks around it
			archipelago: ( b ) => {

				const d = rand( 4500, 6500 ), W = rand( 2500, 4000 );
				add( 'hills', b, d, W, W * rand( 0.4, 0.6 ), rand( 180, 380 ) );
				for ( let i = 0, k = 2 + Math.floor( Math.random() * 3 ); i < k; i ++ ) {

					const type = [ 'hills', 'mesa', 'stack', 'hills' ][ i % 4 ];
					const w = type === 'stack' ? rand( 150, 350 ) : rand( 400, 1200 );
					add( type, b + rand( 0.08, 0.35 ) * ( i % 2 ? 1 : - 1 ), d + rand( - 1800, 800 ), w, w * rand( 0.5, 0.9 ), type === 'stack' ? rand( 50, 110 ) : rand( 40, 150 ) );

				}

			},

			// Mainland on the horizon with an island in front of it
			coast: ( b ) => {

				add( 'coast', b, rand( 7000, 8500 ), rand( 8000, 12000 ), rand( 2000, 3000 ), rand( 300, 550 ) );
				const w = rand( 1200, 2500 );
				add( Math.random() < 0.5 ? 'hills' : 'mesa', b + rand( - 0.25, 0.25 ), rand( 3500, 5000 ), w, w * 0.5, rand( 100, 250 ) );

			},

			// A bay of limestone pillars and cliffy islets
			karst: ( b ) => {

				for ( let i = 0, k = 4 + Math.floor( Math.random() * 4 ); i < k; i ++ ) {

					const type = Math.random() < 0.7 ? 'stack' : 'mesa';
					const w = type === 'stack' ? rand( 150, 450 ) : rand( 400, 900 );
					add( type, b + rand( - 0.4, 0.4 ), rand( 1300, 3200 ), w, w * rand( 0.6, 1 ), type === 'stack' ? rand( 50, 150 ) : rand( 60, 120 ) );

				}

			},

			// A low tree-covered islet with green hills behind
			tropical: ( b ) => {

				const w = rand( 800, 1800 );
				add( 'cay', b, rand( 1500, 2200 ), w, w * rand( 0.3, 0.5 ), rand( 28, 42 ) );
				const W = rand( 2500, 4500 );
				add( 'hills', b + rand( - 0.12, 0.12 ), rand( 5500, 7500 ), W, W * 0.5, rand( 200, 400 ) );

			}

		};

		// Two of the four layouts, in different parts of the horizon
		this.islands.clear();
		const names = pick || Object.keys( scenes ).sort( () => Math.random() - 0.5 );
		scenes[ names[ 0 ] ]( b0 );
		scenes[ names[ 1 ] ]( b0 + rand( 2, 4.3 ) );

	}

	setEnabled( enabled ) {

		Object.assign( this.enabled, enabled );
		this.islands.visible = this.enabled.islands;
		if ( ! this.enabled.whales && this.event ) this.endWhale();
		if ( ! this.enabled.gulls && this.flock ) this.endFlock();

	}

	setConditions( time, weather ) {

		this.gullsAllowed = time !== 'night' && weather !== 'storm';
		this.gullChance = weather === 'rain' ? 0.4 : 1;
		if ( ! this.gullsAllowed && this.flock ) this.flock.leaving = true;

	}

	// Where a sound at p sits for the listener: stereo pan, loudness and travel time.
	hear( p, near = 60 ) {

		const rel = this.tmp2.subVectors( p, this.camPos );
		const d = rel.length();
		return { pan: THREE.MathUtils.clamp( rel.dot( this.camRight ) / d, - 1, 1 ) * 0.8, gain: Math.min( 1, near / d ), delay: d / 343 };

	}

	update( t, dt, camera, waveScale, light, pointScale ) {

		this.t = t;
		this.waveScale = waveScale;
		this.camPos.copy( camera.position );
		camera.getWorldDirection( this.camFwd );
		this.camFwd.y = 0;
		this.camFwd.normalize();
		this.camRight.set( - this.camFwd.z, 0, this.camFwd.x );

		if ( this.enabled.whales && ! this.event && t > this.nextWhale ) this.startWhale();
		if ( this.event ) this.updateWhale( dt );

		if ( this.enabled.gulls && this.gullsAllowed && ! this.flock && t > this.nextFlock ) {

			if ( Math.random() < this.gullChance ) this.startFlock();
			else this.nextFlock = t + rand( 20, 40 );

		}

		if ( this.flock ) this.updateFlock( dt );

		this.spray.material.uniforms.color.value.copy( light );
		this.spray.material.uniforms.scale.value = pointScale;
		this.spray.update( dt );
		this.foam.update( t, dt, waveScale, light );

	}

	// ----- Whale -----

	startWhale( type ) {

		type = type || ( Math.random() < 0.5 ? 'breach' : Math.random() < 0.6 ? 'blow' : 'fluke' );
		// Usually somewhere in view, occasionally off to the side.
		const off = Math.random() < 0.75 ? rand( - 0.35, 0.35 ) : rand( - Math.PI, Math.PI );
		const dir = this.camFwd.clone().applyAxisAngle( new THREE.Vector3( 0, 1, 0 ), off );
		const dist = rand( 70, 150 );
		const origin = this.camPos.clone().addScaledVector( dir, dist );
		const bearing = Math.atan2( dir.x, dir.z );
		// Breaches and blows show the whale side-on; a fluke dive swims away from us.
		const yaw = type === 'fluke' ? bearing + rand( - 0.4, 0.4 ) : bearing + ( Math.random() < 0.5 ? 1 : - 1 ) * Math.PI / 2 + rand( - 0.5, 0.5 );
		origin.y = 0;
		this.event = { type, origin, yaw, t: 0, dur: { breach: 5.8, blow: 8, fluke: 7.5 }[ type ], prev: null, flags: {} };
		this.whale.visible = true;
		this.whale.rotation.y = yaw;
		this.poseWhale( 0 );

	}

	endWhale() {

		this.event = null;
		this.whale.visible = false;
		this.nextWhale = this.t + rand( 60, 120 );

	}

	poseWhale( dt ) {

		const e = this.event, w = this.whale, tt = e.t, u = tt / e.dur;
		let y, fwd, pitch, roll = 0, fin = 0, fluke = 0;

		if ( e.type === 'breach' ) {

			y = - 10 + 13.2 * tt - 3 * tt * tt;
			fwd = 2.5 * tt;
			const k = tt / 4.4;
			pitch = 1.3 - 1.5 * ss( k, 0.25, 0.95 );
			roll = 2.2 * ss( k, 0.2, 0.85 );
			fin = 0.6 * ss( k, 0.15, 0.4 ) - 0.4 * ss( k, 0.7, 0.9 );
			fluke = 0.3 * Math.sin( tt * 3 );

		} else if ( e.type === 'blow' ) {

			y = - 2.6 + 2.2 * Math.sin( Math.PI * u );
			fwd = 3 * tt;
			pitch = 0.3 * Math.cos( Math.PI * u );
			fluke = 0.25 * Math.sin( tt * 1.5 );
			fin = 0.1 * Math.sin( tt );

		} else {

			y = - 1 - 7 * u;
			fwd = 2 * tt;
			pitch = - 0.2 - 1.2 * ss( u, 0, 0.55 );
			fluke = - 0.35 * ss( u, 0.2, 0.5 );

		}

		const dx = Math.sin( e.yaw ), dz = Math.cos( e.yaw );
		w.position.set( e.origin.x + dx * fwd, y, e.origin.z + dz * fwd );
		w.rotation.x = - pitch;
		w.rotation.z = roll;
		for ( const f of w.userData.fins ) f.pivot.rotation.z = ( - 0.35 + fin ) * f.side;
		w.userData.flukes.rotation.x = fluke;

		w.updateMatrixWorld();
		this.vel = this.vel || new THREE.Vector3();
		if ( e.prev && dt > 0 ) this.vel.subVectors( w.position, e.prev ).divideScalar( dt );
		e.prev = ( e.prev || new THREE.Vector3() ).copy( w.position );

	}

	point( z, y = 0 ) {

		return this.tmp.set( 0, y, z ).applyMatrix4( this.whale.matrixWorld );

	}

	updateWhale( dt ) {

		const e = this.event, w = this.whale;
		const prevHead = this.point( 6.5 ).y, prevTail = this.point( - 7.5 ).y, prevY = w.position.y;
		e.t += dt;
		if ( e.t >= e.dur ) {

			this.endWhale();
			return;

		}

		this.poseWhale( dt );
		const sea = waveHeight( w.position.x, w.position.z, this.t, this.waveScale );

		if ( e.type === 'breach' ) {

			const head = this.point( 6.5 );
			if ( prevHead < sea && head.y >= sea ) this.splash( head.clone(), 0.4, 0.35 );
			if ( prevY >= sea && w.position.y < sea && e.t > 1.5 ) {

				this.splash( w.position.clone(), 1, 1 );
				this.foam.spawn( w.position.x, w.position.z, 4, 17, 14, 0.9 );

			}

		}

		if ( e.type === 'blow' ) {

			if ( ! e.flags.foam && e.t > 1.5 ) {

				e.flags.foam = true;
				this.foam.spawn( w.position.x, w.position.z, 3, 9, 10, 0.35 );

			}

			if ( e.t > 2.4 && e.t < 3.2 ) this.blow( dt );
			if ( ! e.flags.blowSound && e.t > 2.4 ) {

				e.flags.blowSound = true;
				const h = this.hear( this.point( 3.8, 1 ) );
				this.sound.spout( h.gain, h.delay, h.pan );

			}

		}

		if ( e.type === 'fluke' ) {

			const tail = this.point( - 7.5 ).clone();
			if ( prevTail >= sea && tail.y < sea && e.t > 2 ) {

				this.splash( tail, 0.35, 0.4 );
				this.foam.spawn( tail.x, tail.z, 2, 8, 9, 0.5 );

			}

		}

		// Water streaming off whatever is above the surface
		const n = e.type === 'blow' ? 1 : 5;
		for ( let i = 0; i < n; i ++ ) {

			const z = e.type === 'fluke' && Math.random() < 0.6 ? rand( - 9, - 7 ) : rand( - 7, 6 );
			const p = this.tmp.set( rand( - 1, 1 ) * ( z < - 7 ? 2.2 : 0.8 ), rand( - 0.5, 1 ), z ).applyMatrix4( w.matrixWorld );
			if ( p.y > waveHeight( p.x, p.z, this.t, this.waveScale ) + 0.3 ) {

				this.spray.emit( p, this.tmp2.copy( this.vel ).multiplyScalar( 0.6 ).add( new THREE.Vector3( rand( - 1, 1 ), rand( - 1, 0.5 ), rand( - 1, 1 ) ) ),
					{ size: rand( 0.25, 0.55 ), life: rand( 1, 1.8 ), drag: 0.4 } );

			}

		}

	}

	splash( p, size, loud ) {

		const v = new THREE.Vector3();
		const n = Math.round( 320 * size );
		for ( let i = 0; i < n; i ++ ) {

			const a = Math.random() * Math.PI * 2, r = rand( 1, 7 ) * size + 1;
			v.set( Math.cos( a ) * r, rand( 4, 15 ) * ( 0.5 + 0.5 * size ), Math.sin( a ) * r );
			const q = this.tmp.set( p.x + Math.cos( a ) * rand( 0, 3 ) * size, p.y, p.z + Math.sin( a ) * rand( 0, 3 ) * size );
			this.spray.emit( q, v, { size: rand( 0.4, 1.1 ), life: rand( 1.6, 2.8 ), drag: 0.3 } );

		}

		for ( let i = 0; i < 60 * size; i ++ ) {

			v.set( rand( - 2, 2 ), rand( 1, 4 ), rand( - 2, 2 ) );
			this.spray.emit( this.tmp.set( p.x + rand( - 3, 3 ), p.y + rand( 0, 3 ), p.z + rand( - 3, 3 ) ), v,
				{ size: rand( 2, 4 ), life: rand( 2.5, 4 ), grow: 1.5, grav: 0.4, drag: 1 } );

		}

		const h = this.hear( p );
		this.sound.splash( loud * h.gain, h.delay, h.pan );

	}

	blow( dt ) {

		const hole = this.point( 3.8, 1.05 ).clone();
		const v = new THREE.Vector3();
		for ( let i = 0; i < 500 * dt; i ++ ) {

			v.set( rand( - 1, 1 ), rand( 9, 14 ), rand( - 1, 1 ) );
			this.spray.emit( hole, v, { size: rand( 0.4, 0.9 ), life: rand( 2, 3.2 ), grow: 3, grav: 2, drag: 1.4 } );

		}

	}

	// ----- Seagulls -----

	startFlock() {

		const C = this.camPos.clone(), F = this.camFwd.clone(), R = this.camRight.clone();
		const n = 2 + Math.floor( Math.random() * 5 );
		const speed = rand( 8, 11 );
		let path, dur;

		if ( Math.random() < 0.55 ) {

			// Fly in over our heads from behind and on out toward the horizon
			const h = rand( 5, 10 ), turn = ( Math.random() < 0.5 ? 1 : - 1 ) * rand( 0.03, 0.25 );
			const dir = F.clone().applyAxisAngle( new THREE.Vector3( 0, 1, 0 ), turn );
			const start = C.clone().addScaledVector( dir, - 35 ).addScaledVector( R, rand( - 8, 8 ) );
			const L = rand( 200, 280 );
			path = ( s, out ) => out.copy( start ).addScaledVector( dir, speed * s )
				.addScaledVector( R, 5 * Math.sin( s * 0.2 ) )
				.setY( C.y + h + s * 0.25 + 1.5 * Math.sin( s * 0.4 ) );
			dur = L / speed;

		} else {

			// Glide in, circle for a while, then leave
			const centre = C.clone().addScaledVector( F, rand( 35, 55 ) );
			const r = rand( 10, 16 ), h = rand( 8, 15 ), spin = Math.random() < 0.5 ? 1 : - 1, side = Math.random() < 0.5 ? 1 : - 1;
			const w = spin * speed / r, Ta = 9, Tc = rand( 15, 30 );
			const a0 = Math.atan2( - spin * side * R.x, spin * side * R.z );
			const ring = ( a, out ) => out.set( centre.x + r * Math.cos( a ), 0, centre.z + r * Math.sin( a ) );
			const tangent = ( a ) => new THREE.Vector3( - Math.sin( a ) * spin, 0, Math.cos( a ) * spin );
			const t0 = tangent( a0 ), a1 = a0 + w * Tc, t1 = tangent( a1 );
			const entry = ring( a0, new THREE.Vector3() ), exit = ring( a1, new THREE.Vector3() );
			path = ( s, out ) => {

				if ( s < Ta ) out.copy( entry ).addScaledVector( t0, speed * ( s - Ta ) );
				else if ( s < Ta + Tc ) ring( a0 + w * ( s - Ta ), out );
				else out.copy( exit ).addScaledVector( t1, speed * ( s - Ta - Tc ) );
				return out.setY( C.y + h + 2 * Math.sin( s * 0.3 ) );

			};

			dur = Ta + Tc + 12;

		}

		const members = this.gulls.slice( 0, n ).map( ( model, i ) => ( {
			model,
			lag: i === 0 ? 0 : i * rand( 0.25, 0.5 ),
			offset: new THREE.Vector3( i === 0 ? 0 : ( i % 2 ? 1 : - 1 ) * rand( 1.5, 4 ), rand( - 1, 1 ), 0 ),
			phase: Math.random() * 6,
			flap: Math.random() < 0.5,
			switchAt: rand( 0.5, 3 ),
			amp: 0,
			yaw: null,
			nextCall: rand( 1, 6 )
		} ) );
		members.forEach( ( m ) => m.model.visible = true );
		this.flock = { path, dur: dur + 3, t: 0, members };

	}

	endFlock() {

		this.flock.members.forEach( ( m ) => m.model.visible = false );
		this.flock = null;
		this.nextFlock = this.t + rand( 25, 60 );

	}

	updateFlock( dt ) {

		const f = this.flock;
		f.t += dt;
		if ( f.t > f.dur || ( f.leaving && f.t > 5 ) ) {

			this.endFlock();
			return;

		}

		const a = new THREE.Vector3(), b = new THREE.Vector3(), v = new THREE.Vector3(), side = new THREE.Vector3();
		for ( const m of f.members ) {

			const s = f.t - m.lag;
			f.path( s - 0.05, a );
			f.path( s + 0.05, b );
			v.subVectors( b, a ).divideScalar( 0.1 );
			const g = m.model;
			const yaw = Math.atan2( v.x, v.z );
			const turn = m.yaw === null ? 0 : Math.atan2( Math.sin( yaw - m.yaw ), Math.cos( yaw - m.yaw ) ) / dt;
			m.yaw = yaw;
			side.set( Math.cos( yaw ), 0, - Math.sin( yaw ) );
			g.position.addVectors( a, b ).multiplyScalar( 0.5 ).addScaledVector( side, m.offset.x );
			g.position.y += m.offset.y + 0.3 * Math.sin( f.t * 0.9 + m.phase );
			g.rotation.y = yaw;
			g.rotation.x = - Math.atan2( v.y, Math.hypot( v.x, v.z ) );
			g.rotation.z += ( THREE.MathUtils.clamp( - turn * 0.8, - 0.7, 0.7 ) - g.rotation.z ) * Math.min( 1, dt * 3 );

			// Alternate flapping and gliding
			m.switchAt -= dt;
			if ( m.switchAt < 0 ) {

				m.flap = ! m.flap;
				m.switchAt = m.flap ? rand( 0.8, 2 ) : rand( 1.5, 4 );

			}

			m.amp += ( ( m.flap ? 0.6 : 0.04 ) - m.amp ) * Math.min( 1, dt * 4 );
			m.phase += dt * ( m.flap ? 19 : 4 );
			for ( const w of g.userData.wings ) {

				w.inner.rotation.z = w.side * ( 0.12 + m.amp * Math.sin( m.phase ) );
				w.outer.rotation.z = 0.08 + m.amp * 0.9 * Math.sin( m.phase - 0.7 );

			}

			m.nextCall -= dt;
			if ( m.nextCall < 0 ) {

				m.nextCall = rand( 4, 12 );
				const h = this.hear( g.position, 25 );
				this.sound.gull( h.gain, h.delay, h.pan );

			}

		}

	}

}
