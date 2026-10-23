"""Original instrumental bed, deterministic synthesis; no sampled music or voice."""
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
import subprocess
SR=44100;DURATION=135;N=SR*DURATION;beat=60/104
rng=np.random.default_rng(23)
L=np.zeros(N);R=np.zeros(N)
def add(x,t,gain=1,pan=0):
 i=int(t*SR);n=min(len(x),N-i)
 if n>0:
  L[i:i+n]+=x[:n]*gain*(1-pan*.35);R[i:i+n]+=x[:n]*gain*(1+pan*.35)
def note(m,d=1.6):
 t=np.arange(int(d*SR))/SR;f=440*2**((m-69)/12)
 envelope=(1-np.exp(-t*90))*np.exp(-t*2.8)
 return (np.sin(2*np.pi*f*t)+.25*np.sin(2*np.pi*2*f*t)+.08*np.sin(2*np.pi*3*f*t))*envelope
def pad(chord):
 t=np.arange(int(beat*4.2*SR))/SR
 e=np.minimum(1,t/.3)*np.minimum(1,(t[-1]-t)/.6)
 return sum(np.sin(2*np.pi*440*2**((m-69)/12)*t) for m in chord)*e*.018
chords=[[52,55,59,62],[48,52,55,59],[43,50,55,59],[50,54,57,62]]
for bar in range(int(DURATION/(beat*4))+1):
 chord=chords[bar%4];t=bar*beat*4
 add(pad(chord),t,.65)
 for k in [0,1.5,2.5,3.25]:
  m=chord[(bar+int(k*2))%4]+12
  add(note(m),t+k*beat,.085,pan=(-1 if k<2 else 1)*.6)
  add(note(m),t+k*beat+.29,.018,pan=.8)
 for k in [0,2]:add(note(chord[0]-12,1.1),t+k*beat,.085)
 if bar>2 and bar<55:
  for k in [0,2]:
   q=np.arange(int(.15*SR))/SR
   kick=np.sin(2*np.pi*(48*q+2*(1-np.exp(-q*25))))*np.exp(-q*24)
   add(kick,t+k*beat,.048)
  for k in [1,3]:
   q=np.arange(int(.09*SR))/SR;noise=rng.standard_normal(len(q));noise=sosfilt(butter(2,1800,fs=SR,btype='high',output='sos'),noise)
   add(noise*np.exp(-q*70),t+k*beat,.018)
  for k in [.5,1.5,2.5,3.5]:
   q=np.arange(int(.04*SR))/SR;add(rng.standard_normal(len(q))*np.exp(-q*130),t+k*beat,.004,pan=.5)
mix=np.stack([L,R],axis=1)
mix[:SR]*=np.linspace(0,1,SR)[:,None];mix[-SR*3:]*=np.linspace(1,0,SR*3)[:,None]
mix=np.tanh(mix*1.1);mix*=.65/max(np.abs(mix).max(),.01)
dest=Path(__file__).resolve().parent.parent/'assets'/'audio';dest.mkdir(parents=True,exist_ok=True)
wavfile.write(dest/'music.wav',SR,(mix*32767).astype(np.int16))
subprocess.run(['ffmpeg','-v','error','-y','-i',str(dest/'music.wav'),'-b:a','192k',str(dest/'music.mp3')],check=True)
(dest/'music.wav').unlink()
print('Original music written: 135 sec, 104 BPM; deterministic notes, no licensed samples.')
