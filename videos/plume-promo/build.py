"""Assemble index.html from src/ (styles and scripts inlined so lint/check see them)."""
from pathlib import Path

root = Path(__file__).parent
src = (root / "src" / "index.src.html").read_text(encoding="utf-8")
css = (root / "src" / "plume.css").read_text(encoding="utf-8").replace('url("fonts/', 'url("assets/fonts/')
ui = (root / "src" / "ui.js").read_text(encoding="utf-8")
tl = (root / "src" / "timeline.js").read_text(encoding="utf-8")
voice = "window.__plumeVoice = " + (root / "assets" / "audio" / "voice.json").read_text(encoding="utf-8") + ";"
out = src.replace("/*@@VOICE@@*/", voice).replace("/*@@CSS@@*/", css).replace("/*@@UI@@*/", ui).replace("/*@@TL@@*/", tl)
(root / "index.html").write_text(out, encoding="utf-8")
print("index.html", len(out), "bytes")
