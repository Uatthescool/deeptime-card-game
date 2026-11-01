import os
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,zipfile,json
import numpy as np

R=Path(__file__).resolve().parent;B=R.parent
svg='''<svg xmlns="http://www.w3.org/2000/svg" width="105" height="105" viewBox="0 0 105 105">
<title>Adaptation test — hooked raptor claw</title>
<desc>Original vector drawing informed by the supplied hooked claw reference: long leftward tip, arched upper surface and knobby root. Black silhouette and transparent ridge only.</desc>
<path fill="#000000" fill-rule="evenodd" d="M6 37
 C18 18 36 9 54 12
 C75 15 90 34 95 57
 L98 70 Q99 77 93 79
 L83 79 Q79 80 77 85
 Q75 92 68 92 L58 90
 Q52 89 53 81 L55 71
 Q61 66 62 57
 C64 43 53 33 39 30
 C28 28 16 31 6 37 Z
 M16 30 C30 17 46 16 60 21
 C77 28 87 45 90 62
 Q88 65 84 65
 C82 46 72 30 57 25
 C44 20 29 22 16 30 Z
 M58 77 Q64 72 65 64
 Q67 73 62 79 L60 85 Q56 85 58 77 Z"/>
</svg>'''
(R/'adaptation-claw-test.svg').write_text(svg,encoding='utf-8')
node=os.environ.get('NODE','node')  # the Node executable
sharp=os.environ.get('SHARP','sharp')  # the sharp module: a path or a name Node can resolve
(R/'render.cjs').write_text('''const sharp=require(process.argv[2]),path=require('path');(async()=>{let r=process.argv[3];for(let n of [32,105,420])await sharp(path.join(r,'adaptation-claw-test.svg'),{density:576}).resize(n,n).png().toFile(path.join(r,'adaptation-claw-'+n+'.png'));})().catch(e=>{console.error(e);process.exit(1)});''')
subprocess.run([node,str(R/'render.cjs'),sharp,str(R)],check=True)
for n in [32,105,420]:
 p=R/f'adaptation-claw-{n}.png';im=Image.open(p).convert('RGBA');a=im.getchannel('A')
 out=Image.new('RGBA',im.size,(0,0,0,0));out.putalpha(a);out.save(p)
 if n==105:
  a.save(R/'adaptation-claw-mask.png');box=a.getbbox()
  assert all([box[0]>0,box[1]>0,box[2]<105,box[3]<105])
master=Image.open(B/'reference/Prehistoric_Card_Master_Template_Geometry_v3_1462x2048.png').convert('RGBA')
base=master.crop((1163,38,1419,276))
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',n)
bold=lambda n:ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',n)
sheet=Image.new('RGB',(700,655),'#f6f4ee');d=ImageDraw.Draw(sheet)
d.text((28,18),'ADAPTATION · HOOKED RAPTOR CLAW',font=bold(25),fill='black')
d.text((28,59),'New hooked profile informed by your reference',font=font(18),fill='#555555')
for x,label,large,small in [
 (30,'Selected · Slender Quill',B/'selected-icons/adaptation@4x.png',B/'selected-icons/adaptation-32.png'),
 (375,'Test · Hooked claw',R/'adaptation-claw-420.png',R/'adaptation-claw-32.png')]:
 d.text((x,109),label,font=bold(21),fill='black')
 frame=base.resize((1024,952),Image.Resampling.LANCZOS)
 im=Image.open(large).resize((512,512),Image.Resampling.LANCZOS);frame.alpha_composite(im,(290,236))
 sheet.paste(frame.resize((256,238),Image.Resampling.LANCZOS).convert('RGB'),(x,153))
 im=Image.open(large).resize((105,105),Image.Resampling.LANCZOS);sheet.paste(im,(x+15,439),im)
 im=Image.open(small);sheet.paste(im,(x+188,474),im)
 d.text((x+25,559),'105 px',font=font(16),fill='#555555');d.text((x+180,525),'32 px',font=font(16),fill='#555555')
d.text((28,610),'105 × 105 · unchanged medallion · black / transparent vector artwork',font=font(17),fill='#444444')
sheet.save(R/'claw-versus-quill.png')
(R/'README.txt').write_text('''Adaptation test: hooked raptor claw, an original vector drawing informed by the user-supplied reference profile.
This is a review alternative. The selected Slender Quill has not been replaced.
Editable SVG: 105x105. Transparent RGBA PNGs: 32, 105 and 420px.
Grayscale mask: white ink, black empty. Artwork is black with transparent cutouts.
No image generation; hand-authored vector contours. Master medallion remains unchanged.
''',encoding='utf-8')
with zipfile.ZipFile(R/'adaptation-claw-test.zip','w',zipfile.ZIP_DEFLATED) as z:
 for name in ['adaptation-claw-test.svg','adaptation-claw-32.png','adaptation-claw-105.png','adaptation-claw-420.png','adaptation-claw-mask.png','claw-versus-quill.png','README.txt']:z.write(R/name,name)
print('Single claw test exported; current selection preserved.')
