"""Original, deterministic PCM music/effects for the sample. No external audio."""
from pathlib import Path
import math, random, struct, wave
ROOT=Path(__file__).parent/'assets'; ROOT.mkdir(exist_ok=True)
SR=22050

def save(name, samples):
    peak=max(1.0,max(abs(x) for x in samples)/.78)
    with wave.open(str(ROOT/name),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR)
        f.writeframes(b''.join(struct.pack('<h',int(max(-1,min(1,x/peak))*32767)) for x in samples))

def music(name, bright=False):
    beat=60/72; length=beat*64; out=[0.0]*round(length*SR)
    chords=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]] if not bright else [[60,64,67],[55,59,62],[57,60,64],[53,57,60]]
    # Circular decays make the piece loop without a hard waveform discontinuity.
    def note(midi,start,duration,gain):
        hz=440*2**((midi-69)/12)
        for i in range(round(duration*SR)):
            t=i/SR;env=(1-math.exp(-t*95))*math.exp(-t*1.65)*(1-min(1,t/duration))
            tone=sum(math.sin(2*math.pi*hz*h*t)*a*math.exp(-t*h*.18) for h,a in [(1,1),(2,.24),(3,.09),(4,.035)])
            k=(round(start*SR)+i)%len(out);out[k]+=gain*env*tone
    melody=[0,2,1,2,0,1,2,1]
    for bar in range(8):
        chord=chords[bar%4]
        for step in range(8):
            note(chord[melody[step]]+12,bar*8*beat+step*beat,beat*4,.105)
            if step%4==0: note(chord[0]-12,bar*8*beat+step*beat,beat*6,.06)
        if bright: note(chord[bar%3]+24,bar*8*beat+3.5*beat,beat*3,.045)
    dry=out[:]
    for i,x in enumerate(dry):
        out[(i+round(.24*SR))%len(out)]+=x*.17
        out[(i+round(.47*SR))%len(out)]+=x*.09
    save(name,out)

music('memory-loop.wav');music('tomorrow-loop.wav',True)
rng=random.Random(21)
click=[(rng.random()*2-1)*math.exp(-i/SR*70)*.2+math.sin(i/SR*2*math.pi*180)*math.exp(-i/SR*30)*.12 for i in range(round(SR*.22))]
save('record-click.wav',click)
stop=[(rng.random()*2-1)*math.exp(-i/SR*48)*.13 for i in range(round(SR*.3))];save('tape-stop.wav',stop)
bell=[sum(math.sin(i/SR*2*math.pi*hz)*math.exp(-i/SR*2)*.07 for hz in [523.25,659.25,783.99])*(1-math.exp(-i/SR*80)) for i in range(SR*3)];save('soft-chime.wav',bell)
print('Created two original 53-second loops and three effects.')
