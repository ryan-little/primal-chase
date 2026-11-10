# Narration for the opening, read by Kokoro (open-source neural TTS, runs locally).
#   python -I tools/voicegen.py <model.onnx> <voices.bin> <out dir> [voice,voice,...]
# Writes <out>/<voice>/<nn>.wav; tools/voicegen.sh (or ffmpeg by hand) turns the chosen voice into assets/voice/<nn>.mp3.
# Setup (once, in a scratch venv): pip install kokoro-onnx soundfile; model files from the kokoro-onnx releases page.
import sys, os
import soundfile as sf
from kokoro_onnx import Kokoro

LINES = [
    'Before the fields and the walls, there was the grass... and everything that moved in it.',
    'You were the fastest thing in it. You still are.',
    'The land had its own herds... and its own teeth.',
    'It had its storms, and its fires.',
    'Then they came. Thin, and slow, and upright. They carry water. They carry fire.',
    'They do not run you down. They walk you down... through the heat of the day.',
    'But the land is older than they are, and it keeps places only you can find.',
    'They follow your tracks into the dark. They sing, to keep awake.',
    'Every runner tires. They are counting on it.',
    'They always catch you.',
    'How long can you run?',
]
model, voices, out = sys.argv[1:4]
want = (sys.argv[4] if len(sys.argv) > 4 else 'bm_lewis').split(',')
k = Kokoro(model, voices)
for v in want:
    os.makedirs(os.path.join(out, v), exist_ok=True)
    lang = 'en-gb' if v.startswith('b') else 'en-us'
    for i, text in enumerate(LINES):
        samples, sr = k.create(text, voice=v, speed=0.88, lang=lang)
        sf.write(os.path.join(out, v, f'{i:02d}.wav'), samples, sr)
    print(v, 'done')
