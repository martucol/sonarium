/*
** credits to three.js webgl 3d sounds example  : https://threejs.org/examples/#misc_sound
** credits to recorder.js : https://github.com/mattdiamond/Recorderjs
*/

// funcionamiento landing page 
var landing = document.querySelector("#landing");
var container = document.querySelector("#container");
var controles = document.querySelector("#control");
var botonComenzar = document.querySelector("#comenzar");
var botonGrabar = document.querySelector("#record");
var botonParar = document.querySelector("#stop");
var muteBtn = document.querySelector("#muteFav");
var toggleBtn = document.querySelector("#toggleFav");

container.style.visibility="hidden";
controles.style.visibility="hidden";

// //only for debugging
// landing.style.display="none";

// declaración de variables básicas 
var start = Date.now()
var muted, view;
var container;
var camera, controls, scene, renderer;
var clock = new THREE.Clock();
// create audio context
var audio_context, mixer, limiter;
var streamDestination;
/// create recorder for mic
var recorder;
/// create streamDestinationNode and Media Recorder for download
var streamDest, mediaRec;
var esferas = {};
var sphere;
// variables a modificar 
var light, pointLight, ambientLight;
var mesh, bulbMat;
var shadermaterial;
var material_sphere1, material_sphere2;
var sonidos = [];
var sound1, sound2;
var limit;

let audioRecorder;
let mediaRecorder;
let shouldStop = false;
let stopped = false;

const BACKGROUND_COLOR = 0x828f85;
// bump when the saved scene format changes
const SCENE_VERSION = 1;


function cambioEstilo(){		
	container.style.visibility="visible";
	landing.style.display="none";
	controles.style.visibility="visible";
};

function info(){
	container.style.visibility="hidden";
	// clear the inline style so #landing falls back to its css (display: flex)
	landing.style.display="";
	controles.style.visibility="hidden";
};

function mute(){
	if (muted == false) {
		mixer.gain.value = 0 ;
		muted = true;
		muteBtn.classList.remove('fa-volume-up');
		muteBtn.classList.add('fa-volume-off');
	} else if (muted == true) {
		mixer.gain.value = 1;
		muted = false;
		muteBtn.classList.remove('fa-volume-off');
		muteBtn.classList.add('fa-volume-up');
	}
}

function toggleView(){
	if (view == false) {
		scene.add(sphere) ;
		view = true;
		toggleBtn.classList.add('icono-paleta--lleno');

	} else if (view == true) {
		scene.remove(sphere);
		view = false;
		toggleBtn.classList.remove('icono-paleta--lleno');
	}
}

// ----------  funciones de recorder js --------
function __log(e, data) {
	log.innerHTML += "\n" + e + " " + (data || '');
}

let recordedChunks = [];
function startUserMedia(stream) {
	var input = audioCtx.createMediaStreamSource(stream);
	mediaRecorder = new MediaRecorder(stream, {mimeType: 'audio/webm'});
	mediaRecorder.addEventListener('dataavailable', function(e) {
		if (e.data.size > 0) {
			recordedChunks.push(e.data);
		}
	
		if(shouldStop === true && stopped === false) {
			// the sound stays wherever the camera is when the recording ends
			createSoundObject(camera.position.clone(), new Blob(recordedChunks, { type: mediaRecorder.mimeType }));
			stopped = true;
			mixer.gain.value = 1;
		}
		// might need this later
		// mediaRecorder.addEventListener('stop', function() {
		// 	createSoundObject(currentPosition, new Blob(recordedChunks));
		// 	recordedChunks = [];
		// }); 
	});
}


function startRecordingSound(button) {
	recordedChunks = [];
	stopped = false;
	shouldStop = false;
    button.disabled = true;
	mediaRecorder.start();
    button.classList.add('active');
    button.nextElementSibling.disabled = false;
    mixer.gain.value = 0;
}

 function stopRecordingSound(button) {
	mediaRecorder.stop();
	shouldStop = true;
    button.disabled = true;
    button.previousElementSibling.disabled = false;
    button.previousElementSibling.classList.remove('active');
 }

////  funcion para descargar sonidos --------------------------
// records the mixer output (what the listener hears while walking) and downloads it as mp3
function setupPathRecorder() {
	// the encoder runs in a worker, which browsers block on file:// pages; the scene still runs without it
	try {
		// record after the limiter so the mp3 matches what you hear
		mediaRec = new WebAudioRecorder(limiter, {
			workerDir: "build/",
			encoding: "mp3",
			options: { timeLimit: 60 * 60 }
		});
	} catch (e) {
		__log('No walk recording: ' + e);
		return;
	}
	mediaRec.onComplete = function(recorder, blob) {
		var stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
		var link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = "sonarium-walk-" + stamp + ".mp3";
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(function() { URL.revokeObjectURL(link.href); }, 1000);
		__log("walk saved");
		resetPathButtons();
	};
	mediaRec.onError = function(recorder, message) {
		__log("walk recording error: " + message);
		alert("sorry, the walk could not be recorded");
		resetPathButtons();
	};
}

// also called when the time limit ends the recording on its own
function resetPathButtons() {
	var startBtn = document.querySelector("#startRecordingPath");
	startBtn.disabled = false;
	startBtn.classList.remove('active');
	document.querySelector("#stopRecordingPath").disabled = true;
}

function startRecordingPath(button) {
	if (!mediaRec) {
		alert("sorry, walk recording needs the page to be served (https or localhost)");
		return;
	}
	// nothing reaches the recorder while the context is suspended
	if (audioCtx.state === 'suspended') {
		audioCtx.resume();
	}
    mediaRec.startRecording();
    button.disabled = true;
    button.classList.add('active');
    button.nextElementSibling.disabled = false;
 }

 function stopRecordingPath(button) {
  	mediaRec.finishRecording();
    // start comes back once the mp3 is ready (onComplete)
    button.disabled = true;
 }
//// fin funcion para descargar sonidos

function makeGlowTexture( hexColor ) {
	var c = document.createElement('canvas');
	c.width = c.height = 128;
	var ctx = c.getContext('2d');
	var col = new THREE.Color( hexColor );
	var r = Math.round(col.r*255), g = Math.round(col.g*255), b = Math.round(col.b*255);
	var grad = ctx.createRadialGradient(64,64,0, 64,64,64);
	grad.addColorStop(0.0, 'rgba('+r+','+g+','+b+',1)');
	grad.addColorStop(0.2, 'rgba('+r+','+g+','+b+',0.9)');
	grad.addColorStop(1.0, 'rgba('+r+','+g+','+b+',0)');
	ctx.fillStyle = grad;
	ctx.fillRect(0,0,128,128);
	var tex = new THREE.Texture(c);
	tex.needsUpdate = true;
	return tex;
}

var Sound = function ( sources, volume , x, y , z ) {
	var audio = document.createElement( 'audio' );
	for ( var i = 0; i < sources.length; i ++ ) {
		var source = document.createElement( 'source' );
		source.src = sources[ i ];
		audio.appendChild( source );
		audio.setAttribute('loop', true);
	}

	this.position = new THREE.Vector3( x, y, z );
	this.play = function () {
		audio.play();
	}
	// where the loop is right now, in seconds (saved with the scene so loading keeps the same timing)
	this.getTime = function () {
		return audio.currentTime;
	}
	// before play() this sets where playback starts
	this.setTime = function ( seconds ) {
		audio.currentTime = seconds;
	}
	var sound = {};
	sound.source = audioCtx.createMediaElementSource(audio);
	sound.volume = audioCtx.createGain();
	sound.panner = audioCtx.createPanner();
	sound.panner.distanceModel = "exponential";
	sound.panner.coneInnerAngle = 360;
	sound.panner.refDistance = 2.5;
	sound.panner.maxDistance = 500;
	
	sound.source.connect(sound.volume);
	sound.volume.connect(sound.panner);
	sound.panner.connect(mixer);

	if(audioCtx.state === 'suspended') {
		audioCtx.resume();
	}
	// #A3BECB
	const fullpallete = [0xCFE7DD, 0xD3B4BD, 0xA3BECB, 0xfb29ff, 0xff2ea1, 0xff7866, 0xff6505,0xD1A1B7, 0xffca42, 0xd3ff42, 0x66ff9, 0x0ed8a2, 0x0db4ce, 0x0461f6, 0xba7ef6];
	const pallete = [0xFFFFFF ];
	sound.source.loop = true;
	sound.panner.setPosition(x, y, z);
	// /* BLOB SPHERE */
	// var colorete = new THREE.Color(pallete[Math.floor(Math.random() * pallete.length)]);
	// this.customMaterial = shadermaterial.clone();
	// this.customMaterial.fragmentShader = document.getElementById('sphereFragmentShader').textContent
	// this.customMaterial.uniforms.color.value = new THREE.Vector3(colorete.r, colorete.g, colorete.b);
	// var esfera = new THREE.Mesh( new THREE.SphereGeometry(5, 32, 32), this.customMaterial);
	// esfera.position.set(x,y+2,z);
	// scene.add(esfera);

	/* FADED SPRITE */
	var colorete = new THREE.Color(pallete[Math.floor(Math.random() * pallete.length)]);

	var spriteMat = new THREE.SpriteMaterial({
		map: makeGlowTexture( colorete ),
		// blending: THREE.AdditiveBlending,
		depthWrite: false,
		transparent: true,
		fog: true
	});
	var esfera = new THREE.Sprite( spriteMat );
	esfera.position.set( x, y+2, z );
	esfera.scale.set( 40, 40, 1 );   // blob size, tune
	scene.add( esfera );

	// stop the sound and take it out of the scene (used when a scene is restored over this one)
	this.dispose = function () {
		audio.pause();
		sound.panner.disconnect();
		scene.remove( esfera );
		spriteMat.map.dispose();
		spriteMat.dispose();
		for ( var i = 0; i < sources.length; i ++ ) {
			URL.revokeObjectURL( sources[ i ] );
		}
	}
}

function createSoundObject(position, blob, startTime) {
	var url = URL.createObjectURL(blob);
	var sound = new Sound( [ url ], 1, position.x, position.y, position.z );
	// keep the recording so the scene can be saved later
	sound.blob = blob;
	if (startTime) sound.setTime(startTime);
	sound.play();
	sonidos.push(sound);
}

// ----------  guardar / cargar escena --------
function blobToDataURL(blob) {
	return new Promise(function(resolve, reject) {
		var reader = new FileReader();
		reader.onload = function() { resolve(reader.result); };
		reader.onerror = function() { reject(reader.error); };
		reader.readAsDataURL(blob);
	});
}

// the audio goes inside the json (src.kind "inline"), so a single file holds the whole scene
function serializeScene() {
	return Promise.all(sonidos.map(function(sound) {
		return blobToDataURL(sound.blob).then(function(data) {
			return {
				position: { x: sound.position.x, y: sound.position.y, z: sound.position.z },
				startTime: sound.getTime(),
				mimeType: sound.blob.type,
				src: { kind: "inline", data: data }
			};
		});
	})).then(function(sounds) {
		return {
			app: "sonarium",
			version: SCENE_VERSION,
			createdAt: new Date().toISOString(),
			sounds: sounds
		};
	});
}

function downloadScene() {
	if (sonidos.length === 0) {
		alert("there is nothing to save yet, record a sound first");
		return;
	}
	serializeScene().then(function(data) {
		var file = new Blob([ JSON.stringify(data) ], { type: "application/json" });
		var stamp = data.createdAt.slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
		var link = document.createElement("a");
		link.href = URL.createObjectURL(file);
		link.download = "sonarium-" + stamp + ".json";
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(function() { URL.revokeObjectURL(link.href); }, 1000);
		__log("scene saved: " + data.sounds.length + " sounds");
	}).catch(function(e) {
		__log("could not save scene: " + e);
		alert("sorry, the scene could not be saved");
	});
}

function openSceneFile() {
	document.querySelector("#sceneFile").click();
}

function loadSceneFromFile(input) {
	var file = input.files[0];
	// reset so picking the same file again still fires onchange
	input.value = "";
	if (!file) return;
	if (sonidos.length > 0 && !confirm("this will replace the sounds in your current scene. continue?")) return;

	file.text().then(function(text) {
		var data = JSON.parse(text);
		validateScene(data);
		return restoreScene(data);
	}).then(function() {
		cambioEstilo();
	}).catch(function(e) {
		__log("could not load scene: " + e);
		alert("sorry, this file could not be loaded as a sonarium scene\n(" + e.message + ")");
	});
}

function validateScene(data) {
	if (!data || data.app !== "sonarium") throw new Error("not a sonarium scene file");
	if (data.version > SCENE_VERSION) throw new Error("this scene was saved with a newer version of sonarium");
	if (!Array.isArray(data.sounds)) throw new Error("the scene has no sound list");
	data.sounds.forEach(function(s, i) {
		var p = s && s.position;
		if (!p || !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) throw new Error("sound " + (i + 1) + " has an invalid position");
		if (s.startTime !== undefined && !(isFinite(s.startTime) && s.startTime >= 0)) throw new Error("sound " + (i + 1) + " has an invalid start time");
		// only embedded audio for now, never fetch arbitrary urls from a file someone sent
		if (!s.src || s.src.kind !== "inline" || typeof s.src.data !== "string" || s.src.data.indexOf("data:audio/") !== 0) {
			throw new Error("sound " + (i + 1) + " has no embedded audio");
		}
	});
}

function restoreScene(data) {
	// decode everything first, so a broken file leaves the current scene untouched
	return Promise.all(data.sounds.map(function(s) {
		return fetch(s.src.data).then(function(r) { return r.blob(); });
	})).then(function(blobs) {
		clearScene();
		blobs.forEach(function(blob, i) {
			var p = data.sounds[i].position;
			// files saved before startTime existed start from the beginning
			createSoundObject(new THREE.Vector3(p.x, p.y, p.z), blob, data.sounds[i].startTime || 0);
		});
		__log("scene loaded: " + blobs.length + " sounds");
	});
}

function clearScene() {
	sonidos.forEach(function(sound) { sound.dispose(); });
	sonidos = [];
}

function init() {
	/**  check compatibility for audio and graphics **/
	try {
		// webkit shim
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		window.URL = window.URL || window.webkitURL;

		audioCtx = new AudioContext;
		__log('Audio context set up.');
	} catch (e) {
		alert('No web audio support in this browser!');
	}

	if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

    
	// mediaDevices only exists on https or localhost; without it the scene still runs, just without recording
	if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
		navigator.mediaDevices.getUserMedia({audio: true}).then(startUserMedia).catch(function(e) {
			__log('No live audio input: ' + e);
		});
	} else {
		__log('No live audio input: microphone needs https or localhost');
	}
	
	mixer = audioCtx.createGain();
	// limiter: many sounds summed at gain 1 go over 1.0 and clip, this squashes the peaks instead
	limiter = audioCtx.createDynamicsCompressor();
	limiter.threshold.value = -6;
	limiter.knee.value = 0;
	limiter.ratio.value = 20;
	limiter.attack.value = 0.003;
	limiter.release.value = 0.25;
	mixer.connect(limiter);
	limiter.connect(audioCtx.destination);

	createScene();
	setupPathRecorder();
	
	muted = false; 
	view = false;
	limit = 500;
}

function createScene() {
	container = document.getElementById('container');
	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1, 10000 );
	camera.position.set( 0, 20, 0 );
	controls = new THREE.FirstPersonControls( camera );
	controls.movementSpeed = 100;
	controls.lookSpeed = 0.07;
	controls.noFly = true;
	controls.lookVertical = false; 
	scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2( BACKGROUND_COLOR, 0.000000025 );
	light = new THREE.DirectionalLight( 0xffffff );
	light.position.set( 0, 0.5, 1 ).normalize();
	scene.add( light );
	ambientLight = new THREE.AmbientLight( 0xff5555 , 0.5);
	scene.add(ambientLight);
	
	shadermaterial = new THREE.ShaderMaterial({side: THREE.DoubleSide,
		uniforms: { 
			amp: {
				type: "f",
				value: 3.0
			},
			sync:{
				type: "f",
				value: 0.5
			},
			time: { 
				type: "f",
				value: 0.0001
			},
			color: {
				type: "c",
				value: new THREE.Color(BACKGROUND_COLOR)
			}
		},
		vertexShader: document.getElementById('vertexShader2').textContent,
		fragmentShader: document.getElementById('fragmentShader2').textContent
	} );
	sphere = new THREE.Mesh(new THREE.SphereGeometry(1000, 100, 100), shadermaterial);

	var material_wireframe = new THREE.MeshLambertMaterial( { color: 0xFFFFFF, wireframe: true } );
	mesh = new THREE.Mesh( new THREE.PlaneGeometry( 1000, 1000, 50, 50 ), material_wireframe );
	mesh.position.y = 0.1;
	mesh.rotation.x = - Math.PI /2;
	// scene.add(mesh)
	// var grid = new THREE.GridHelper( 500, 25 );
	// grid.setColors( 0xFFFFFF, 0xfFFFFF );
	// scene.add( grid );
	// DotGrid( size, spacing, dotSize, color ) -> dotSize is the dot diameter in world units, tweak here
	var grid = new DotGrid( 500, 20, 1.75, 0xeeeeee );
	scene.add( grid );
	// renderer setup and adding to HTML
	renderer = new THREE.WebGLRenderer( { clearColor: BACKGROUND_COLOR, clearAlpha: 1, antialias: true } );
	// sharper dot texture when seen at a low angle (the floor from eye height)
	grid.material.alphaMap.anisotropy = renderer.getMaxAnisotropy();
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( BACKGROUND_COLOR, 1 );
	container.innerHTML = "";
	container.appendChild( renderer.domElement );

	window.addEventListener( 'resize', onWindowResize, false );
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
	controls.handleResize();
}

function animate() {
	requestAnimationFrame( animate );
	render();
}

function render() {
	let delta = clock.getDelta();
	let	time = clock.getElapsedTime() * 5;
	controls.update( delta );
	renderer.render( scene, camera );
	audioCtx.listener.setPosition(camera.position.x, camera.position.y, camera.position.z);

	//limit camera movement
	if (camera.position.x > limit) {
		camera.position.x = limit;
	}
	if (camera.position.x < -limit) {
		camera.position.x = -limit;
	}
	if (camera.position.z > limit) {
		camera.position.z = limit;
	}
	if (camera.position.z < -limit) {
		camera.position.z = -limit;
	}
	if (camera.position.y < 20) {
		camera.position.y = 20;
	}

	shadermaterial.uniforms[ 'time' ].value = .0005 * ( Date.now() - start );
	shadermaterial.uniforms[ 'amp' ].value = ( Date.now() - start ) / 70 ;

	var m = camera.matrix;

	var mx = m.elements[12], my = m.elements[13], mz = m.elements[14];
	m.elements[12] = m.elements[13] = m.elements[14] = 0;

	// Multiply the orientation vector by the world matrix of the camera.
	var vec = new THREE.Vector3(0,0,1);
	vec.applyProjection(m);
	vec.normalize();

	// Multiply the up vector by the world matrix.
	var up = new THREE.Vector3(0,-1,0);
	up.applyProjection(m);
	up.normalize();

	// Set the orientation and the up-vector for the listener.
	audioCtx.listener.setOrientation(vec.x, vec.y, vec.z, up.x, up.y, up.z);

	m.elements[12] = mx;
	m.elements[13] = my;
	m.elements[14] = mz;
}


init();
animate();