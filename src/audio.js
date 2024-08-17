var audioContext = null;
var gunSounds = {};
const SOUND_GUNSHOT = "gunshot"
const SOUND_RELOAD = "reload"
/**
 * @typedef {SOUND_GUNSHOT | SOUND_RELOAD} Sound
 */

function ensureAudioContext() {
  // only load the audioContext after user interaction, otherwise we won't get one.
  if (audioContext === null) {
    audioContext = new AudioContext();
  }
}

/**
 * @param {Sound} sound
 */
function playSound(sound) {
  ensureAudioContext();
  var source = audioContext.createBufferSource();
  source.buffer = gunSounds[sound];
  source.connect(audioContext.destination);
  source.start(0);
}

/**
 * @param {Sound} name
 * @param {string} url
 */
function loadSound(name, url) {
  ensureAudioContext();
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.responseType = 'arraybuffer';
  request.onload = function () {
    audioContext.decodeAudioData(request.response, function (buffer) {
      gunSounds[name] = buffer;
    }, (error) => { console.log(error) });
  }
  request.send();
}
