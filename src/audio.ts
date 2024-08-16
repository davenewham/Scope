// todo: turn this into a class

type Sound = "gunshot" | "reload"

var audioContext: AudioContext = null;
const gunSounds: Record<Sound, AudioBuffer | null> = {
  gunshot: null,
  reload: null,
};

function ensureAudioContext(): void {
  // only load the audioContext after user interaction, otherwise we won't get one.
  if (audioContext === null) {
    audioContext = new AudioContext();
  }
}

function playSound(sound: Sound) {
  ensureAudioContext();

  const source = audioContext!.createBufferSource();
  source.buffer = gunSounds[sound];
  source.connect(audioContext.destination);
  source.start(0);
}

function loadSound(name: Sound, url: string): void {
  ensureAudioContext();
  const request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.responseType = 'arraybuffer';
  request.onload = function () {
    audioContext!.decodeAudioData(request.response, function (buffer) {
      gunSounds[name] = buffer;
    }, (error) => { console.log(error) });
  }
  request.send();
}
