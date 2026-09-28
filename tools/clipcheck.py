"""Checks the recorded clips (tools/clips.mjs): smooth motion and action kept in the safe centre.
  python tools/clipcheck.py [name ...]              new clips vs the same scene with the game's own camera
  python tools/clipcheck.py old=path/to/old.mp4 ...  the same motion measurement on any other clip

Motion: every frame is phase-correlated against the one before (background shift, whole video
pixels), and the shifts are converted to art pixels per 1/60 s, as a 60 Hz screen shows them.
A step-like clip shows runs of zeros broken by whole-pixel jumps (0,0,2,0,0,2); a smooth one
shows a steady small number every refresh.
Framing: from the per-frame log, the share of frames where the cat and the action it's framed
with sit inside the safe box (what the title's logo and menu, the cinematic's line and a
portrait phone's centre crop all leave clear).
"""
import json, subprocess, sys, os
import numpy as np

FF = os.environ.get('FFMPEG', r"C:/Users/ryan/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe")
TMP = 'tools/shots/clipframes'
BOX = (0.37, 0.36, 0.63, 0.62)  # x0, y0, x1, y1 on the 16:9 frame

def probe(path):
    out = subprocess.run([FF.replace('ffmpeg.exe', 'ffprobe.exe'), '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout.strip()
    w, h, r = out.split(',')
    a, b = r.split('/')
    return int(w), int(h), float(a) / float(b)

def frames(path, w, h):
    # one frame at a time, the central 70% (the edges add nothing but memory)
    pr = subprocess.Popen([FF, '-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], stdout=subprocess.PIPE)
    y0, x0 = int(h * 0.15), int(w * 0.15)
    while True:
        b = pr.stdout.read(w * h)
        if len(b) < w * h: break
        yield np.frombuffer(b, np.uint8).reshape(h, w)[y0:h - y0, x0:w - x0].astype(np.float32)

def shifts(fr):
    out, prev, win = [], None, None
    for f in fr:
        if win is None: win = np.outer(np.hanning(f.shape[0]), np.hanning(f.shape[1]))
        cur = np.fft.fft2((f - f.mean()) * win)
        if prev is None: prev = cur; continue
        a, b = cur, prev
        prev = cur
        c = a * np.conj(b)
        r = np.abs(np.fft.ifft2(c / (np.abs(c) + 1e-6)))
        y, x = np.unravel_index(np.argmax(r), r.shape)
        if y > r.shape[0] // 2: y -= r.shape[0]
        if x > r.shape[1] // 2: x -= r.shape[1]
        out.append((-x, -y))
    return np.array(out, float)

def motion(path, art_px):
    w, h, fps = probe(path)
    d = shifts(frames(path, w, h)) / (w / art_px)  # art pixels per video frame
    if fps < 59:  # a 30 fps clip on a 60 Hz screen: each frame shows twice, so every other refresh moves 0
        z = np.zeros((len(d) * 2, 2)); z[0::2] = d; d = z
    m = np.hypot(d[:, 0], d[:, 1])
    moving = m.mean()
    stalls = np.mean(m < 0.01)
    # evenness: how far each refresh's step is from the local (9-refresh) average
    k = np.convolve(m, np.ones(9) / 9, mode='same')
    jitter = np.abs(m - k)[4:-4].mean()
    return dict(res=f'{w}x{h}@{fps:.0f}', mean=round(moving, 3), stalls=round(float(stalls), 3), jitter=round(float(jitter), 3), maxstep=round(float(m.max()), 2),
                seq=' '.join(f'{v:.2f}'.rstrip('0').rstrip('.') for v in m[60:84]))

def inbox(p):
    return p and BOX[0] <= p[0] <= BOX[2] and BOX[1] <= p[1] <= BOX[3]

def framing(name):
    L = json.load(open(os.path.join(TMP, name + '.json')))
    cat = np.mean([inbox(m['cat']) for m in L])
    foc = [inbox(m['focus']) for m in L if m['focus'] and 0 <= m['focus'][0] <= 1 and 0 <= m['focus'][1] <= 1]
    act = [inbox(a[1:]) for m in L for a in m['act']]
    xs = [m['cat'][0] for m in L]; ys = [m['cat'][1] for m in L]
    return dict(cat_in=round(float(cat), 3), focus_in=round(float(np.mean(foc)), 3) if foc else None, all_action_in=round(float(np.mean(act)), 3) if act else None,
                cat_x=f'{min(xs):.2f}-{max(xs):.2f}', cat_y=f'{min(ys):.2f}-{max(ys):.2f}')

args = sys.argv[1:]
olds = [a[4:] for a in args if a.startswith('old=')]
names = [a for a in args if not a.startswith('old=')] or (None if olds else ['dawn', 'hunt', 'band', 'heat', 'night', 'chase', 'stampede', 'storm', 'fire'])
for n in names or []:
    print(n, 'clip ', motion(f'assets/clips/{n}.mp4', 480), framing(n))
    live = os.path.join(TMP, n + '-live.mkv')
    if os.path.exists(live): print(n, 'live ', motion(live, 480), framing(n + '-live'))
for o in olds:
    print(os.path.basename(o), 'old  ', motion(o, 480))
