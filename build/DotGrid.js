function DotGrid( size, step, dotSize, color ) {
	size    = size    !== undefined ? size    : 500;
	step    = step    !== undefined ? step    : 25;
	dotSize = dotSize !== undefined ? dotSize : 3;
	color   = color   !== undefined ? color   : 0xffffff;
    this.color = color;
	var n = Math.floor( ( size * 2 ) / step ) + 1,
		count = n * n,
		r = dotSize / 2;

	var pos = new Float32Array( count * 4 * 3 ),
		uv  = new Float32Array( count * 4 * 2 ),
		idx = new Uint16Array( count * 6 ),
		v = 0, u = 0, t = 0, o = 0,
		x, z;

	for ( var i = 0; i < n; i++ ) {

		x = -size + i * step;

		for ( var j = 0; j < n; j++ ) {

			z = -size + j * step;

			pos[v++] = x - r; pos[v++] = 0; pos[v++] = z - r;
			pos[v++] = x + r; pos[v++] = 0; pos[v++] = z - r;
			pos[v++] = x + r; pos[v++] = 0; pos[v++] = z + r;
			pos[v++] = x - r; pos[v++] = 0; pos[v++] = z + r;

			uv[u++] = 0; uv[u++] = 0;
			uv[u++] = 1; uv[u++] = 0;
			uv[u++] = 1; uv[u++] = 1;
			uv[u++] = 0; uv[u++] = 1;

			idx[t++] = o;     idx[t++] = o + 1; idx[t++] = o + 2;
			idx[t++] = o;     idx[t++] = o + 2; idx[t++] = o + 3;
			o += 4;
		}
	}

	var geo = new THREE.BufferGeometry();
	geo.addAttribute( 'position', new THREE.BufferAttribute( pos, 3 ) );
	geo.addAttribute( 'uv', new THREE.BufferAttribute( uv, 2 ) );
	geo.setIndex( new THREE.BufferAttribute( idx, 1 ) );
	geo.computeBoundingSphere();

	var mat = new THREE.MeshBasicMaterial({
		color: color,
		// texture only drives opacity, so the dot colour stays uniform (no dark fringe)
		alphaMap: DotGrid.getTexture(),
		transparent: true,
		alphaTest: 0.02,
		depthWrite: false,
		side: THREE.DoubleSide,
		fog: true
	});

	THREE.Mesh.call( this, geo, mat );
}

DotGrid.prototype = Object.create( THREE.Mesh.prototype );
DotGrid.prototype.constructor = DotGrid;

DotGrid.getTexture = function () {
	if ( DotGrid._tex ) return DotGrid._tex;

	var c = document.createElement( 'canvas' );
	c.width = c.height = 64;
	var ctx = c.getContext( '2d' );
	// alphaMap reads brightness: white = opaque, black = transparent
	ctx.fillStyle = "#000000";
	ctx.fillRect( 0, 0, 64, 64 );
	// soft edge: solid until 0.5 of the radius, then fades out. tweak the stops to change the falloff
	var grad = ctx.createRadialGradient( 32, 32, 0, 32, 32, 30 );
	grad.addColorStop( 0.0, "#ffffff" );
	grad.addColorStop( 0.1, "#ffffff" );
	grad.addColorStop( 1.0, "#000000" );
	ctx.fillStyle = grad;
	ctx.fillRect( 0, 0, 64, 64 );

	var tex = new THREE.Texture( c );
	tex.minFilter = THREE.LinearMipMapLinearFilter;
	tex.needsUpdate = true;
	DotGrid._tex = tex;
	return tex;
};

DotGrid.prototype.dispose = function () {
	this.geometry.dispose();
	this.material.dispose();
};