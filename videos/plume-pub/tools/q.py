import json,sys,re
from pathlib import Path
shot=sys.argv[1]; pat=re.compile(sys.argv[2] if len(sys.argv)>2 else '.', re.I)
B=json.loads(Path(__file__).resolve().parent.parent.joinpath('assets/boxes',shot+'.boxes.json').read_text())
for b in B:
    s=' '.join(str(b.get(k,'')) for k in ('id','text','label'))
    if pat.search(s): print(f"{b['tag']:8} x{b['x']:5} y{b['y']:5} w{b['w']:5} h{b['h']:5}  {s.strip()[:70]}")
