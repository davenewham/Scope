var audioContext = null;
var gunSounds = {};
const SOUND_GUNSHOT = "gunshot";
const SOUND_RELOAD = "reload";
/**
 * @typedef {SOUND_GUNSHOT | SOUND_RELOAD} Sound
 */

/**
 * Helper function to initialize AudioContext
 */
function ensureAudioContext() {
  // only load the audioContext after user interaction, otherwise we won't get one.
  if (audioContext === null) {
    // load regular window.AudioContext, but if not available (like on iOS), use window.webkitAudioContext 
    audioContext = window.AudioContext || window.webkitAudioContext;
    if (audioContext) {
      audioContext = new audioContext();
    } else {
      console.error("AudioContext is not supported on this device.");
      return;
    }
  }
}

/**
 * @param {Sound} sound
 */
function playSound(sound) {
  ensureAudioContext();

  if (audioContext && gunSounds[sound]) {
    var source = audioContext.createBufferSource();
    source.buffer = gunSounds[sound];
    source.connect(audioContext.destination);
    source.start(0);
  }
}

/**
 * @param {Sound} name
 * @param {string} url
 */
function loadSound(name, url) {
  ensureAudioContext();

  if (!audioContext) return;  // abort if audioContext is not supported

  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.responseType = 'arraybuffer';

  request.onload = function () {
    audioContext.decodeAudioData(request.response, function (buffer) {
      gunSounds[name] = buffer;
    }, (error) => { console.log(error) });
  };

  request.send();
}
