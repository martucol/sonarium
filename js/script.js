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
var paletaBtn = document.querySelector("#paletaBtn");
var paletaColores = document.querySelector("#paletaColores");

// the sky shader is the page background from the start; only the controls wait for "start"
controles.style.visibility="hidden";

// //only for debugging
// landing.style.display="none";

// declaración de variables básicas 
var start = Date.now()
var muted;
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
// grid + sound sprites: only shown once the experience starts (the sky stays visible behind the landing)
var mundo;
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
	landing.style.display="none";
	controles.style.visibility="visible";
	mundo.visible = true;
	controls.enabled = true;
};

function info(){
	// clear the inline style so #landing falls back to its css (display: flex)
	landing.style.display="";
	controles.style.visibility="hidden";
	mundo.visible = false;
	// otherwise the mouse over the landing text would keep turning the camera
	controls.enabled = false;
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

// ----------  paleta: base color of the sky shader (and the whole page) --------
const SKY_COLORS = [
	{ name: "sage", hex: BACKGROUND_COLOR },
	{ name: "sky blue", hex: 0x88AFC1 },
	{ name: "charcoal", hex: 0x171313 },
	{ name: "lilac", hex: 0xd0c3d0 },
	{ name: "periwinkle", hex: 0xbec0d5 },
	{ name: "slate", hex: 0x8d939d }
];

function buildPaleta() {
	SKY_COLORS.forEach(function(c) {
		var css = "#" + new THREE.Color(c.hex).getHexString();
		var b = document.createElement("button");
		b.className = "paleta__color";
		b.style.backgroundColor = css;
		b.title = c.name;
		b.setAttribute("aria-label", c.name);
		b.dataset.hex = c.hex;
		b.setAttribute("aria-pressed", c.hex === skyColor);
		b.onclick = function() {
			setSkyColor(c.hex);
		};
		paletaColores.appendChild(b);
	});
	// click anywhere else or Escape closes the circles
	document.addEventListener("click", function(e) {
		if (!paletaColores.hidden && !e.target.closest(".paleta")) togglePaleta(false);
	});
	window.addEventListener("keydown", function(e) {
		if (e.key === "Escape" && !paletaColores.hidden) {
			togglePaleta(false);
			paletaBtn.focus();
		}
	});
}

// no argument: open if closed, close if open
function togglePaleta(open) {
	if (open === undefined) open = paletaColores.hidden;
	paletaColores.hidden = !open;
	paletaBtn.setAttribute("aria-expanded", open);
	toggleBtn.classList.toggle("icono-paleta--lleno", open);
}

// current base color of the sky (saved with the scene)
var skyColor = BACKGROUND_COLOR;

function setSkyColor(hex) {
	skyColor = hex;
	var color = new THREE.Color(hex);
	shadermaterial.uniforms.color.value.copy(color);
	scene.fog.color.copy(color);
	renderer.setClearColor(hex, 1);
	// page background (seen before webgl starts) and the css var the palette icon uses
	var css = "#" + color.getHexString();
	document.body.style.backgroundColor = css;
	document.body.style.setProperty("--color-background", css);
	// ring on the matching circle (none if a loaded scene uses a color that isn't in SKY_COLORS)
	paletaColores.querySelectorAll(".paleta__color").forEach(function(o) {
		o.setAttribute("aria-pressed", Number(o.dataset.hex) === hex);
	});
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
			var position = camera.position.clone();
			var blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
			decodeRecording(blob).then(function(buffer) {
				createSoundObject(position, blob, buffer, 0);
			}).catch(function(e) {
				__log("could not decode recording: " + e);
			});
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

// ----------  amplitude envelope --------
// length of each loudness window (seconds)
const ENVELOPE_WINDOW = 0.02;

// ----- sprite look from amplitude: tweak these -----
// the main signal is opacity: size changes also read as distance (closer / further away), so they stay optional
// sprite size (world units) when the amplitude is at AMP_REF
const SPRITE_SIZE = 40;
// amplitude (rms) that shows the sprite fully opaque and at full size. measured: speech / normal sounds peak around 0.1 - 0.25
const AMP_REF = 0.2;
// "log" only: amplitude treated as silence. measured: room noise sits around 0.001 - 0.002
const AMP_FLOOR = 0.003;
// "log": follows decibels, like the ear (quiet sounds still visible). "linear": amplitude / AMP_REF
const SIZE_CURVE = "log";
// opacity during silence: a faint ghost so the sound can still be found (0 = invisible)
const MIN_OPACITY = 0.4;
// size during silence. 1 = size never changes (opacity only), 0.85 = subtle breathing, 0.4 = big pulse (messes with depth)
const MIN_SCALE = 1;
// sounds louder than AMP_REF can grow up to this. 1 = never bigger than SPRITE_SIZE
const MAX_SCALE = 1;

const ATTACK = 0.03;
const RELEASE = 0.25;

function decibels(amp) {
	return 20 * Math.log10(Math.max(amp, 1e-6));
}

// 0 at silence, 1 at AMP_REF, more than 1 for louder sounds
function amplitudeToLevel(amp) {
	var t;
	if (SIZE_CURVE === "log") {
		t = (decibels(amp) - decibels(AMP_FLOOR)) / (decibels(AMP_REF) - decibels(AMP_FLOOR));
	} else {
		t = amp / AMP_REF;
	}
	return Math.max(0, t);
}

function lerp(a, b, t) {
	return a + (b - a) * t;
}

// loudness (rms) of every ENVELOPE_WINDOW of the buffer, computed once when the sound is created,
// so each frame only has to look up where the loop is right now
function computeEnvelope(buffer) {
	var data = buffer.getChannelData(0); // buffers are mono (toMono)
	var size = Math.max(1, Math.round(ENVELOPE_WINDOW * buffer.sampleRate));
	var envelope = new Float32Array(Math.ceil(data.length / size));
	for (var w = 0; w < envelope.length; w ++) {
		var start = w * size;
		var end = Math.min(start + size, data.length);
		var sum = 0;
		for (var i = start; i < end; i ++) {
			sum += data[i] * data[i];
		}
		envelope[w] = Math.sqrt(sum / (end - start));
	}
	return envelope;
}

var Sound = function ( buffer, volume , x, y , z ) {
	this.position = new THREE.Vector3( x, y, z );
	var startedAt = 0;
	var envelope = computeEnvelope( buffer );
	this.play = function ( offset ) {
		offset = ( offset || 0 ) % buffer.duration;
		sound.source.start( 0, offset );
		startedAt = audioCtx.currentTime - offset;
	}
	// where the loop is right now, in seconds (saved with the scene so loading keeps the same timing)
	this.getTime = function () {
		return ( audioCtx.currentTime - startedAt ) % buffer.duration;
	}
	// loudness of the sound at its source right now (not what the listener hears: no distance, no mixer)
	this.getAmplitude = function () {
		var i = Math.floor( this.getTime() / ENVELOPE_WINDOW );
		return envelope[ Math.min( i, envelope.length - 1 ) ];
	}
	var sound = {};
	sound.source = audioCtx.createBufferSource();
	sound.source.buffer = buffer;
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
	esfera.scale.set( SPRITE_SIZE, SPRITE_SIZE, 1 );
	mundo.add( esfera );

	// called every frame: opacity (and optionally size) follow the loudness of the sound (sprites scale around their center)
	// smoothed level, starts at silence so a new sound fades in
	var level = 0;
	this.update = function ( delta ) {
		// follow the target quickly when it rises (ATTACK) and slowly when it falls (RELEASE),
		// using the real frame time so it feels the same at any frame rate
		var target = amplitudeToLevel( this.getAmplitude() );
		var tau = target > level ? ATTACK : RELEASE;
		level += ( target - level ) * ( 1 - Math.exp( - delta / tau ) );
		var t = Math.min( level, 1 );
		spriteMat.opacity = lerp( MIN_OPACITY, 1, t );
		// up to AMP_REF: MIN_SCALE -> 1. above it: 1 -> MAX_SCALE
		var scale = level <= 1 ? lerp( MIN_SCALE, 1, t ) : Math.min( MAX_SCALE, level );
		esfera.scale.set( SPRITE_SIZE * scale, SPRITE_SIZE * scale, 1 );
	}

	// stop the sound and take it out of the scene (used when a scene is restored over this one)
	this.dispose = function () {
		sound.source.stop();
		sound.panner.disconnect();
		mundo.remove( esfera );
		spriteMat.map.dispose();
		spriteMat.dispose();
	}
}

// short fade baked into both ends of a recording, so the jump from the last sample back to the first doesn't click
const LOOP_FADE = 0.01;

function addLoopFade(buffer) {
	var n = Math.min(Math.floor(LOOP_FADE * buffer.sampleRate), Math.floor(buffer.length / 2));
	for (var c = 0; c < buffer.numberOfChannels; c ++) {
		var data = buffer.getChannelData(c);
		for (var i = 0; i < n; i ++) {
			data[i] *= i / n;
			data[buffer.length - 1 - i] *= i / n;
		}
	}
	return buffer;
}

// every sound is a single point in space, so stereo only doubles the memory: average the channels into one
function toMono(buffer) {
	if (buffer.numberOfChannels === 1) return buffer;
	var mono = audioCtx.createBuffer(1, buffer.length, buffer.sampleRate);
	var out = mono.getChannelData(0);
	for (var c = 0; c < buffer.numberOfChannels; c ++) {
		var data = buffer.getChannelData(c);
		for (var i = 0; i < buffer.length; i ++) {
			out[i] += data[i] / buffer.numberOfChannels;
		}
	}
	return mono;
}

function decodeRecording(blob) {
	return blob.arrayBuffer().then(function(bytes) {
		return audioCtx.decodeAudioData(bytes);
	}).then(toMono).then(addLoopFade);
}

// buffer is the decoded blob (decodeRecording); the blob is kept so the scene can be saved later
function createSoundObject(position, blob, buffer, startTime) {
	var sound = new Sound( buffer, 1, position.x, position.y, position.z );
	sound.blob = blob;
	sound.play(startTime);
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
			skyColor: "#" + new THREE.Color(skyColor).getHexString(),
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
		return fetch(s.src.data).then(function(r) { return r.blob(); }).then(function(blob) {
			return decodeRecording(blob).then(function(buffer) {
				return { blob: blob, buffer: buffer };
			});
		});
	})).then(function(decoded) {
		clearScene();
		// missing (files saved before the palette existed) or not a "#rrggbb" hex: first palette color
		var validColor = typeof data.skyColor === "string" && /^#[0-9a-f]{6}$/i.test(data.skyColor);
		setSkyColor(validColor ? parseInt(data.skyColor.slice(1), 16) : SKY_COLORS[0].hex);
		decoded.forEach(function(d, i) {
			var p = data.sounds[i].position;
			// files saved before startTime existed start from the beginning
			createSoundObject(new THREE.Vector3(p.x, p.y, p.z), d.blob, d.buffer, data.sounds[i].startTime || 0);
		});
		__log("scene loaded: " + decoded.length + " sounds");
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

		// 44.1 kHz instead of the usual 48 kHz: ~8% less audio work and memory, still full audible range
		// (old Safari's webkitAudioContext ignores the option and stays at the device rate)
		audioCtx = new AudioContext({ sampleRate: 44100 });
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
	buildPaleta();
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
	// off while the landing is showing, cambioEstilo turns it on
	controls.enabled = false;
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
	scene.add(sphere);

	mundo = new THREE.Group();
	mundo.visible = false;
	scene.add(mundo);

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
	mundo.add( grid );
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

// how long the listener takes to glide to a new position (seconds). setPosition jumps once per frame,
// and walking through a loud sound those jumps are heard as crackle ("fry")
const LISTENER_SMOOTHING = 0.03;

function moveListener(position, forward, up) {
	var listener = audioCtx.listener;
	var t = audioCtx.currentTime;
	// older browsers only have the setPosition / setOrientation methods
	if (!listener.positionX) {
		if (position) listener.setPosition(position.x, position.y, position.z);
		if (forward) listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
		return;
	}
	if (position) {
		listener.positionX.setTargetAtTime(position.x, t, LISTENER_SMOOTHING);
		listener.positionY.setTargetAtTime(position.y, t, LISTENER_SMOOTHING);
		listener.positionZ.setTargetAtTime(position.z, t, LISTENER_SMOOTHING);
	}
	if (forward) {
		listener.forwardX.setTargetAtTime(forward.x, t, LISTENER_SMOOTHING);
		listener.forwardY.setTargetAtTime(forward.y, t, LISTENER_SMOOTHING);
		listener.forwardZ.setTargetAtTime(forward.z, t, LISTENER_SMOOTHING);
		listener.upX.setTargetAtTime(up.x, t, LISTENER_SMOOTHING);
		listener.upY.setTargetAtTime(up.y, t, LISTENER_SMOOTHING);
		listener.upZ.setTargetAtTime(up.z, t, LISTENER_SMOOTHING);
	}
}

function render() {
	let delta = clock.getDelta();
	let	time = clock.getElapsedTime() * 5;
	controls.update( delta );
	renderer.render( scene, camera );
	moveListener(camera.position, null, null);

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

	sonidos.forEach(function(sound) { sound.update(delta); });

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
	moveListener(null, vec, up);

	m.elements[12] = mx;
	m.elements[13] = my;
	m.elements[14] = mz;
}


init();
animate();