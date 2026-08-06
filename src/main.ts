// Boot: capability gate, then hand off to the app.
// Kept minimal so a failure here can still show a human message.

const boot = document.getElementById('boot')!;

function fail(msg: string): void {
  boot.textContent = msg;
  boot.style.letterSpacing = '0.05em';
  boot.style.textTransform = 'none';
}

const probe = document.createElement('canvas').getContext('webgl2', {
  powerPreference: 'high-performance'
});

if (!probe) {
  fail('Primal Chase needs WebGL2, which this browser does not provide.');
} else {
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  const mode = new URLSearchParams(location.search).get('mode');
  const entry = mode === 'view'
    ? import('./viewer').then((m) => m.start())
    : import('./game/app').then((m) => m.startGame());
  entry.catch((err: unknown) => {
    console.error(err);
    fail('Something failed while loading the game. A reload may help.');
  });
}
