
// higher DELTA_SCORE_PENALTY_MULT results in smaller possible differences between the desired number
// of pieces and the actual number of pieces, but at the cost of pieces being less square.
const DELTA_SCORE_PENALTY_MULT = 2;
const ZOOM_FACTOR = 1.15;
const PIECE_CONNECT_DISTANCE = 0.25; // This times piece width is the maximum snap distace when connecting pieces.
const SELECTION_OUTLINE_WIDTH = 0.03; // As a proportion of piece width.
const CAMERA_PAN_SPEED = 1; // As a propotion of average viewport width and height per second.


const vertexShaderSource = `
		attribute vec4 aVertexPosition;
		attribute vec2 aTextureCoord;

		uniform mat4 uMatrix;
		uniform mat4 uTextureMatrix;

		varying highp vec2 vTextureCoord;

		void main(void) {
			gl_Position = uMatrix * aVertexPosition;
			vTextureCoord = ( uTextureMatrix * vec4( aTextureCoord , 0 , 1 ) ).xy;
		}
	`;

const fragmentShaderSource = `
		varying highp vec2 vTextureCoord;

		uniform sampler2D uTexture;

		void main(void) {
			gl_FragColor = texture2D(uTexture, vTextureCoord);
		}
	`;
const drawImage = (	tex , texWidth , texHeight , srcX , srcY , srcW , srcH , dstX , dstY , dstW , dstH , z ) => {
	gl.bindTexture( gl.TEXTURE_2D , tex );
	gl.useProgram( shaderProgram );

	gl.bindBuffer( gl.ARRAY_BUFFER , bufferVertex );
	gl.enableVertexAttribArray( locations.aVertexPosition );
	gl.vertexAttribPointer( locations.aVertexPosition , 2 , gl.FLOAT , false , 0 , 0 );
	gl.bindBuffer( gl.ARRAY_BUFFER , bufferTextureCoord );
	gl.enableVertexAttribArray( locations.aTextureCoord );
	gl.vertexAttribPointer( locations.aTextureCoord , 2 , gl.FLOAT , false , 0 , 0 );

	const left = camera.x;
	const right = camera.x + glCanvas.clientWidth / camera.zoom;
	const bottom = camera.y + glCanvas.clientHeight / camera.zoom;
	const top = camera.y;
	const x = dstW * ( 2 / ( right - left ) );
	const y = dstH * ( 2 / ( top - bottom ) );
	const tx = ( left + right ) / ( left - right ) + ( 2 / ( right - left ) ) * dstX;
	const ty = ( bottom + top ) / ( bottom - top ) + ( 2 / ( top - bottom ) ) * dstY;
	const matrix = [
		 x,  0,  0,  0,
		 0,  y,  0,  0,
		 0,  0,  0,  0,
		tx, ty,  z,  1,
	];
	gl.uniformMatrix4fv( locations.uMatrix , false , matrix );

	const textureMatrix = [
		srcW , 0 , 0 , 0 ,
		0 , srcH , 0 , 0 ,
		0 , 0 , 0 , 0 ,
		srcX , srcY , 0 , 1
	];
	gl.uniformMatrix4fv( locations.uTextureMatrix , false , textureMatrix );

	gl.uniform1i( locations.uTexture , 0 );
	gl.drawArrays( gl.TRIANGLES , 0 , 6 );
}
const drawScene = ( gl , texture ) => {
	// Clear the canvas before we start drawing on it.
	gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

	const pieceGap = puzzle.complete ? 0 : 0.3 / camera.zoom;
	drawImage( backgroundTexture , 1 , 1 , 0 , 0 , 1 , 1 , 0 , 0 , puzzle.playArea.width , puzzle.playArea.height , 1 );
	puzzle.pieces.forEach( piece => {
		const srcX = piece.column / puzzle.columns;
		const srcY = piece.row / puzzle.rows;
		const srcW = puzzle.pieceWidth / puzzle.width - ( pieceGap / puzzle.width );
		const srcH = puzzle.pieceHeight / puzzle.height - ( pieceGap / puzzle.height );
		const dstX = piece.x;
		const dstY = piece.y;
		const dstW = puzzle.pieceWidth - pieceGap;
		const dstH = puzzle.pieceHeight - pieceGap;
		// LOWER z values are DRAWN OVERTOP higher values.
		const z = piece.groupSize / puzzle.pieceAmount - ( piece.moving ? 1 : 0 );
		drawImage( texture , puzzle.width , puzzle.height , srcX , srcY , srcW , srcH , dstX , dstY , dstW , dstH , z );
		if ( piece.selected ) { // draw white box as outline behind drawn piece.
			const outline = puzzle.pieceWidth * SELECTION_OUTLINE_WIDTH;
			const dstX2 = dstX - outline;
			const dstY2 = dstY - outline;
			const dstW2 = dstW + 2 * outline;
			const dstH2 = dstH + 2 * outline;
			const z2 = z + 0.5 / puzzle.pieceAmount;
			drawImage( outlineTexture , 1 , 1 , 0 , 0 , 1 , 1 , dstX2 , dstY2 , dstW2 , dstH2 , z2 );
		}
	} );
	if ( puzzle.boxSelect ) {
		const x = Math.min( camera.mousedownX , camera.mouseX );
		const y = Math.min( camera.mousedownY , camera.mouseY );
		const w = Math.max( camera.mousedownX , camera.mouseX ) - x;
		const h = Math.max( camera.mousedownY , camera.mouseY ) - y;
		drawImage( boxSelectTexture , 1 , 1 , 0 , 0 , 1 , 1 , x , y , w , h , -1 );
	}
}
const updateTexture = ( gl , texture , video ) => {
	gl.bindTexture( gl.TEXTURE_2D , texture );
	gl.texImage2D( gl.TEXTURE_2D , 0 , gl.RGBA , gl.RGBA , gl.UNSIGNED_BYTE , video );
}
const checkSourceReady = el => {
	const tag = el.tagName.toLowerCase();
	const videoReady = tag == "video" && el.currentTime > 0 && !el.paused && !el.ended && el.readyState > 2;
	const imageReady = tag == "img" && el.complete && el.naturalHeight !== 0;
	return videoReady || imageReady;
}
const updateCanvasSize = e => {
	glCanvas.width = window.innerWidth;
	glCanvas.height = window.innerHeight;
	gl.viewport( 0 , 0 , window.innerWidth , window.innerHeight );
	gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
}
const zoom = e => {
	const newZoomUnbounded = camera.zoom * ( ( e.deltaY > 0 ) ? 1 / ZOOM_FACTOR : ZOOM_FACTOR );
	const newZoom = Math.max( Math.min( newZoomUnbounded , 2 ) , 0.1 );
	camera.x += e.clientX / camera.zoom - e.clientX / newZoom;
	camera.y += e.clientY / camera.zoom - e.clientY / newZoom;
	camera.zoom = Math.max( 0.1 , Math.min( 2 , newZoom ) );
}
const attemptConnections = ( piece ) => {
	piece.neighbours.forEach( ( neighbour , i ) => {
		if ( neighbour && neighbour.group != piece.group ) {
			const offsetX = ( ( 1 - i ) % 2 ) * puzzle.pieceWidth; // = (1,0,-1,0) * width.
			const offsetY = ( ( 2 - i ) % 2 ) * puzzle.pieceHeight; // = (0,1,0,-1) * height.
			const x = neighbour.x - offsetX - piece.x;
			const y = neighbour.y - offsetY - piece.y;
			const pieceConnectDistace = PIECE_CONNECT_DISTANCE * puzzle.pieceWidth;
			if ( Math.sqrt( x ** 2 + y ** 2 ) < pieceConnectDistace ) {
				// Snap selected pieces into flush connection.
				puzzle.pieces.filter( v => v.group == piece.group ).forEach( piece => {
					piece.x += x;
					piece.y += y;
				} );
				// unify group ids of all pieces that were just connected.
				const oldGroup = Math.max( piece.group , neighbour.group );
				const newGroup = Math.min( piece.group , neighbour.group );
				// puzzle.pieces.filter( v => v.group == oldGroup ).forEach( v => v.group = newGroup );


				const a = puzzle.pieces.filter( v => v.group == oldGroup || v.group == newGroup );
				a.forEach( v => v.group = newGroup );
				a.forEach( v => v.groupSize = a.length );

				puzzle.connectionCount += 1;
				document.querySelector( "#pieceCount>span" ).textContent = puzzle.connectionCount + " / " + puzzle.pieceAmount;
				const isComplete = puzzle.pieces.every( v => v.group == 0 );
				if ( isComplete ) {
					audioComplete.play();
					puzzle.complete = true;
				}
				else {
					audioClick.play();
				}
			}
		}
	} );
}
const mouseup = e => {
	if ( e.button == 0 ) { // left mouse button lifted
		const movingPieces = puzzle.pieces.filter( v => v.moving );
		movingPieces.forEach( v => v.moving = false );
		camera.panX = 0;
		camera.panY = 0;
		const allMovingPiecesSameGroup = movingPieces.every( v => v.group == movingPieces[0].group );
		if ( allMovingPiecesSameGroup && movingPieces.length > 0 ) {
			movingPieces.forEach( piece => attemptConnections( piece ) );
		}
		if ( puzzle.boxSelect ) {
			// Make a set with all the group ids in the box selection, then select all pieces whose
			// group id is in the set. If holding shift, don't deselect pieces that aren't in the box.
			const x1 = Math.min( camera.mousedownX , camera.mouseX ) - puzzle.pieceWidth;
			const y1 = Math.min( camera.mousedownY , camera.mouseY ) - puzzle.pieceHeight;
			const x2 = Math.max( camera.mousedownX , camera.mouseX );
			const y2 = Math.max( camera.mousedownY , camera.mouseY );
			const a = puzzle.pieces.filter( v => v.x >= x1 && v.x <= x2 && v.y >= y1 && v.y <= y2 );
			const groups = new Set( a.map( v => v.group ) );
			puzzle.pieces.forEach( v => v.selected = ( v.selected && e.shiftKey ) || groups.has( v.group ) );
			puzzle.boxSelect = false;
		}
	}
}
const panCamera = ( deltaX , deltaY ) => {
	const x = camera.x + deltaX;
	const y = camera.y + deltaY;
	const w = -glCanvas.clientWidth / camera.zoom;
	const h = -glCanvas.clientHeight / camera.zoom;
	camera.x = Math.max( w + 10 , Math.min( puzzle.playArea.width - 10 , x ) );
	camera.y = Math.max( h + 10 , Math.min( puzzle.playArea.height - 10 , y ) );
	camera.mouseX += deltaX;
	camera.mouseY += deltaY;
}
const mousemove = e => {
	const mouseXClamped = Math.max( 0 , Math.min( window.innerWidth , e.x ) );
	const mouseYClamped = Math.max( 0 , Math.min( window.innerHeight , e.y ) );
	camera.mouseX = mouseXClamped / camera.zoom + camera.x;
	camera.mouseY = mouseYClamped / camera.zoom + camera.y;
	// set if the screen should be panning. Pan happens when dragging piece or selection box to edge of screen.
	if ( e.buttons == 1 ) {
		const windowSize = 0.5 * ( window.innerWidth + window.innerHeight );
		const panSpeed = ( CAMERA_PAN_SPEED * windowSize ) / camera.zoom;
		camera.panX = e.x <= 0 ? -panSpeed : e.x >= window.innerWidth ? panSpeed : 0;
		camera.panY = e.y <= 0 ? -panSpeed : e.y >= window.innerHeight ? panSpeed : 0;
	}
	// pan camera if any of the following are held: right, right+left, middle or middle+left.
	if ( e.buttons >=2 && e.buttons <= 5 ) {
		panCamera( -e.movementX / camera.zoom , -e.movementY / camera.zoom );
	}
}
const mousedown = e => {
	if ( e.buttons == 1 ) {
		const piecesUnderMouse = puzzle.pieces.filter( piece => {
			const withinX = camera.mouseX > piece.x && camera.mouseX < piece.x + puzzle.pieceWidth;
			const withinY = camera.mouseY > piece.y && camera.mouseY < piece.y + puzzle.pieceHeight;
			return withinX && withinY
		} );
		if ( piecesUnderMouse.length > 0 ) { // setup piece movement.
			piecesUnderMouse.sort( ( a , b ) => a.groupSize < b.groupSize );
			const piece = piecesUnderMouse[piecesUnderMouse.length - 1];
			if ( e.shiftKey ) { // select piece and all pieces connected to piece.
				puzzle.pieces.filter( v => v.group == piece.group ).forEach( v => v.selected = !v.selected );
			}
			else {
				if ( !piece.selected ) {
					puzzle.pieces.forEach( v => v.selected = false );
				}
				const movingPieces = puzzle.pieces.filter( v => v.selected || ( v.group == piece.group ) );
				movingPieces.forEach( v => {
					v.moving = true;
					v.movingOffset.x = v.x - camera.mouseX;
					v.movingOffset.y = v.y - camera.mouseY;
				});
			}
		}
		else {
			puzzle.boxSelect = true;
			camera.mousedownX = camera.mouseX;
			camera.mousedownY = camera.mouseY;
		}
	}
}
const updatePiecePositions = () => {
	puzzle.pieces.filter( v => v.moving ).forEach( piece => {
		piece.x = piece.movingOffset.x + camera.mouseX;
		piece.y = piece.movingOffset.y + camera.mouseY;
	} );
}
const render = now => {
	if ( camera.panX != 0 || camera.panY != 0 ) {
		const time = now - timeAtPreviousFrame;
		panCamera( camera.panX * ( time / 1000 ) , camera.panY * ( time / 1000 ) );
	}
	updatePiecePositions();
	if ( !puzzle.complete && ( now % 1000 <= timeAtPreviousFrame % 1000 ) ) {
		const time = now - puzzle.startTime;
		const hours = Math.floor( time / 3600000 );
		const minutes = Math.floor( time / 60000 ) % 60;
		const seconds = Math.floor( time / 1000 ) % 60;
		const str = ( hours > 0 ? hours + ":" : "" ) + ( minutes < 10 ? "0" : "" ) + minutes + ":" + ( seconds < 10 ? "0" : "" ) + seconds;
		document.querySelector( "#timer>span" ).textContent = str;
	}

	if ( !puzzle.sourceReadyToDraw ) {
		puzzle.sourceReadyToDraw = checkSourceReady( puzzle.source );
		if ( puzzle.sourceReadyToDraw && !puzzle.isVideo ) {
			updateTexture( gl , texture , puzzle.source ); // only do updateTexture once for images.
		}
	}
	if ( puzzle.sourceReadyToDraw ) {
		if ( puzzle.isVideo ) { // not updateTexture'ing for images matters a lot for cpu usage.
			updateTexture( gl , texture , puzzle.source );
		}
		drawScene( gl , texture );
	}
	timeAtPreviousFrame = now;
	window.requestAnimationFrame(render);
}
const generatePuzzleDimensions = ( width , height , desiredPieces ) => {
	// Generates best amount of rows, columns and amount of pieces.
	// E.g a width to height ratio of 9:6 with 5 pieces shouldn't exist and gets rounded to 3x2 with 6 pieces.
	const imageRatio = Math.max( width , height ) / Math.min( width , height );
	const best = { "pieces" : undefined , "score" : Infinity , "rows" : undefined , "columns" : undefined };
	let delta = 0;
	let deltaScorePenalty = 0;
	while ( best.score > deltaScorePenalty ) { // check different piece amounts until all future guesses must be worse than our best piece amount.
		const pieces = desiredPieces + delta;
		for ( let i = 1; i <= Math.sqrt( pieces ); i++ ) { // get low factors of piece amount.
			const j = pieces / i;
			if ( Number.isInteger( j ) ) { // make sure high factors are whole numbers.
				const score = Math.abs( j / i - imageRatio ) + deltaScorePenalty;
				if ( score < best.score ) {
					best.pieces = pieces;
					best.score = score;
					best.rows = ( width > height ) ? i : j;
					best.columns = ( width < height ) ? i : j;
				}
			}
		}
		delta = ( delta + ( delta >= 0 ? 1 : 0 ) ) * -1; // 0 => -1 => 1 => -2 => 2 => -3 ....
		deltaScorePenalty = Math.abs( DELTA_SCORE_PENALTY_MULT * delta / desiredPieces );
	}
	return best
}
const puzzleInit = () => {
	const s = document.querySelector( "#preview>*" ); // get first child of preview
	const desiredPieces = parseInt( document.querySelector( "#piecesInput" ).value );
	puzzle.source = s;
	puzzle.sourceReadyToDraw = false;
	puzzle.isVideo = s.tagName == "VIDEO";
	puzzle.width = puzzle.isVideo ? s.videoWidth : s.naturalWidth;
	puzzle.height = puzzle.isVideo ? s.videoHeight : s.naturalHeight;
	const bestLayout = generatePuzzleDimensions( puzzle.width , puzzle.height , desiredPieces );
	puzzle.rows = bestLayout.rows;
	puzzle.columns = bestLayout.columns;
	puzzle.pieceAmount = bestLayout.pieces;
	puzzle.pieceWidth = puzzle.width / puzzle.columns;
	puzzle.pieceHeight = puzzle.height / puzzle.rows;
	puzzle.playArea = { "width" : 3 * puzzle.width , "height" : 3 * puzzle.height };
	puzzle.complete = false;
	puzzle.boxSelect = false;
	puzzle.startTime = window.performance.now();
	puzzle.connectionCount = 1;

	puzzle.pieces = Array.from( { "length" : puzzle.pieceAmount } , v => { return {} } );
	puzzle.pieces.forEach( ( piece , i , pieces ) => {
		piece.index = i;
		piece.group = i;
		piece.groupSize = 1;
		piece.row = Math.floor( i / puzzle.columns );
		piece.column = i % puzzle.columns;
		piece.selected = false;
		piece.moving = false;
		piece.movingOffset = { "x" : 0 , "y" : 0 };
		piece.neighbours = [ // right, down, left, up.
			( ( piece.column + 1 ) < puzzle.columns ) ? pieces[i + 1] : undefined,
			( ( piece.row + 1 ) < puzzle.rows ) ? pieces[i + puzzle.columns] : undefined,
			( ( piece.column - 1 ) >= 0 ) ? pieces[i - 1] : undefined,
			( ( piece.row - 1 ) >= 0 ) ? pieces[i - puzzle.columns] : undefined
		];
		piece.x = undefined; // defined further down
		piece.y = undefined; // defined further down
	} );
	// make an array of random positions, then set each piece to one of them.
	const random = Array.from( { "length" : puzzle.pieceAmount } , v => Math.random() );
	const indexes = random.map( ( v , i ) => i ).sort( ( a , b ) => random[a] - random[b] );
	indexes.forEach( ( v , i ) => {
		puzzle.pieces[v].x = ( i % puzzle.columns ) * 1.2 * puzzle.pieceWidth + 0.2 * puzzle.pieceWidth;
		puzzle.pieces[v].y = Math.floor( i / puzzle.columns ) * 1.2 * puzzle.pieceHeight + 0.2 * puzzle.pieceHeight;
	} );
 	// events need to be document instead of canvas to allow firing when mouse is outside viewport.
	document.addEventListener( "mousemove" , mousemove );
	document.addEventListener( "mousedown" , mousedown );
	document.addEventListener( "mouseup" , mouseup );
	document.addEventListener( "wheel" , zoom );
	document.querySelector( "#pieceCount>span" ).textContent = puzzle.connectionCount + " / " + puzzle.pieceAmount;
	document.querySelector( "#menu" ).style.display = "none";
	window.requestAnimationFrame( render );
}
const setVolume = e => {
	const video = document.querySelector( "#preview video" );
	if ( video ) {
		video.volume = e.target.value;
	}
}
const toggleDisplayNone = elem => {
	elem.style.display = elem.style.display ? "" : "none";
}
const menuToggle = e => {
	toggleDisplayNone( document.querySelector( "#menu" ) );
}
const muteToggle = e => {
	muted = !muted;
	[...e.currentTarget.children].forEach( v => toggleDisplayNone( v ) );
	const video = document.querySelector( "#preview>video" );
	if ( video ) {
		video.muted = muted;
	}
}
const loadFile = file => {
	if ( file.type.match( /(^image\/|^video\/)/ ) ) {
		const isVideo = file.type.match( /^video\// );
		const elem = document.createElement( isVideo ? "video" : "img" );
		if ( isVideo ) {
			// elem.volume = "0";
			elem.volume = document.querySelector( "#volumeSlider" ).value;
			elem.muted = muted;
			elem.loop = true;
			elem.autoplay = true;
		}
		elem.src = window.URL.createObjectURL( file );
		document.querySelector( "#preview" ).replaceChildren( elem );
	}
}
const dropFile = e => {
	e.preventDefault();
	loadFile( e.dataTransfer.files[0] );
	document.querySelector( "#menu" ).style.display = "";
}
const fileInput = e => {
	loadFile( e.target.files[0] );
}

const audioClick = document.querySelector( "#audioClick" );
const audioComplete = document.querySelector( "#audioComplete" );
audioClick.volume = 1;
audioComplete.volume = 1;
let muted = true;
let timeAtPreviousFrame = 0;
const puzzle = {};
const camera = { // all camera x and y values are in puzzle coordinate, not viewport coordinates.
	"x" : -50 ,
	"y" : -50 ,
	"zoom" : 0.5 ,
	"panX" : 0 ,
	"panY" : 0 ,
	"mouseX" : 0 ,
	"mouseY" : 0 ,
	"mousedownX" : 0 ,
	"mousedownY" : 0 ,
};
document.querySelector( "#fileInput" ).addEventListener( "change" , fileInput );
document.querySelector( "#startPuzzle" ).addEventListener( "click" , puzzleInit );
document.querySelector( "#menuButton" ).addEventListener( "click" , menuToggle );
document.querySelector( "#mute" ).addEventListener( "click" , muteToggle );
document.querySelector( "#volumeSlider" ).addEventListener( "input" , setVolume );
window.addEventListener( "resize" , updateCanvasSize );
window.addEventListener( "drop" , dropFile );
window.addEventListener( "dragover" , e => e.preventDefault() );

// ============================================================================
// ========================= init WebGL canvas stuff ==========================
// ============================================================================
const glCanvas = document.querySelector( "#canvasWebGL" );
const gl = glCanvas.getContext( "webgl" );
gl.clearColor( 0.1 , 0.1 , 0.1 , 1.0 ); // Clear to dark grey
gl.clearDepth( 1.0 ); // Clear everything
gl.enable( gl.DEPTH_TEST ); // Enable depth testing
gl.depthFunc( gl.LEQUAL ); // Near things obscure far things
updateCanvasSize(); // includes a gl.clear() call;
// need to allow alpha for box selection of pieces.
gl.enable( gl.BLEND );
gl.blendFunc( gl.SRC_ALPHA , gl.ONE_MINUS_SRC_ALPHA );
const shaderVertex = gl.createShader( gl.VERTEX_SHADER );
gl.shaderSource( shaderVertex , vertexShaderSource );
gl.compileShader( shaderVertex );
const shaderFragment = gl.createShader( gl.FRAGMENT_SHADER );
gl.shaderSource( shaderFragment , fragmentShaderSource );
gl.compileShader( shaderFragment );
const shaderProgram = gl.createProgram();
gl.attachShader( shaderProgram , shaderVertex );
gl.attachShader( shaderProgram , shaderFragment );
gl.linkProgram( shaderProgram );
if ( !gl.getProgramParameter(shaderProgram, gl.LINK_STATUS ) ) {
	console.log('Error in program linking:' + gl.getProgramInfoLog(shaderProgram) );
	gl.deleteProgram(shaderProgram);
}
const locations = {
	"aVertexPosition": gl.getAttribLocation( shaderProgram , "aVertexPosition" ),
	"aTextureCoord": gl.getAttribLocation( shaderProgram , "aTextureCoord" ),
	"uMatrix": gl.getUniformLocation( shaderProgram , "uMatrix" ),
	"uTextureMatrix": gl.getUniformLocation( shaderProgram , "uTextureMatrix" ),
	"uTexture": gl.getUniformLocation( shaderProgram , "uTexture" ),
};
const bufferVertex = gl.createBuffer();
gl.bindBuffer( gl.ARRAY_BUFFER , bufferVertex );
gl.bufferData( gl.ARRAY_BUFFER , new Float32Array( [0,0,0,1,1,0,1,0,0,1,1,1] ) , gl.STATIC_DRAW );
const bufferTextureCoord = gl.createBuffer();
gl.bindBuffer( gl.ARRAY_BUFFER , bufferTextureCoord );
gl.bufferData( gl.ARRAY_BUFFER , new Float32Array( [0,0,0,1,1,0,1,0,0,1,1,1] ) , gl.STATIC_DRAW	);

const createTexture = rgba => {
	const texture = gl.createTexture();
	gl.bindTexture( gl.TEXTURE_2D , texture );
	gl.texImage2D( gl.TEXTURE_2D , 0 , gl.RGBA , 1 , 1 , 0 , gl.RGBA , gl.UNSIGNED_BYTE , new Uint8Array( rgba ) );
	// these 3 parameters must be set for it to work at all with non-power-of-two images.
	gl.texParameteri( gl.TEXTURE_2D , gl.TEXTURE_WRAP_S , gl.CLAMP_TO_EDGE );
	gl.texParameteri( gl.TEXTURE_2D , gl.TEXTURE_WRAP_T , gl.CLAMP_TO_EDGE );
	gl.texParameteri( gl.TEXTURE_2D , gl.TEXTURE_MIN_FILTER , gl.LINEAR );
	return texture;
}
const texture = createTexture( [0 , 0 , 255 , 255] ); // dummy values until image data is supplied.
const outlineTexture = createTexture( [255 , 255 , 255 , 255] );
const boxSelectTexture = createTexture( [255 , 255 , 255 , 90] );
const backgroundTexture = createTexture( [70 , 130 , 180 , 255] ); // #4682B4 lightish blue
// ============================================================================








// =====plans=====


// spawn pieces in center of play area
	// or center play area on 0,0

// draw faint lines between connected pieces
	// currently have a bad hack solution where I just draw slightly smaller squares.
	// It's currently bad and I'd prefer to have solid black lines.
	// look in to drawing gl lines instead of triangles.

// favicon

// add server and multiplayer support
	// it'd be sick if it's peer to peer somehow.
	// it'll be important to make sure images and videos are loaded before doing things with non-local files






