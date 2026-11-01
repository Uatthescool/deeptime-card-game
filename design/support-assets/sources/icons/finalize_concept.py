import os
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,json,zipfile,shutil
import numpy as np
import xml.etree.ElementTree as ET

R=Path(__file__).resolve().parent;S=R/'selected-icons'
svg='''<svg xmlns="http://www.w3.org/2000/svg" width="105" height="105" viewBox="0 0 105 105">
<title>Concept — selected light bulb</title>
<desc>Centered light bulb silhouette with symmetric rays and a transparent curved highlight. Symbol only; existing medallion unchanged.</desc>
<g fill="#000000" transform="translate(-0.316 3.436)">
<path fill-rule="evenodd" d="M52.5 17.5
 C36 17.5 24.5 29 24.5 44.5
 C24.5 56.5 33 64.5 37.5 72.5
 L67.5 72.5 C72 64.5 80.5 56.5 80.5 44.5
 C80.5 29 69 17.5 52.5 17.5 Z
 M36.5 44.5 C36.5 34.8 42.6 28.7 51.5 27.5
 L51.5 32.5 C45 33.5 41.5 37.5 41.5 44.5 Z"/>
<rect x="37.5" y="77.5" width="30" height="7" rx="3.5"/>
<path d="M40.5 89.5 H64.5 C63 95.4 59 98.5 52.5 98.5 C46 98.5 42 95.4 40.5 89.5 Z"/>
<rect x="49.5" y="6.5" width="6" height="7" rx="1"/>
<rect x="9.5" y="40.5" width="9" height="6" rx="1"/>
<rect x="86.5" y="40.5" width="9" height="6" rx="1"/>
<path d="M19.5 19.5 L24.5 24.5 M85.5 19.5 L80.5 24.5" fill="none" stroke="#000000" stroke-width="6" stroke-linecap="round"/>
</g></svg>'''
(S/'concept.svg').write_text(svg,encoding='utf-8')
shutil.copy2(R/'adaptation-hooked-claw/adaptation-claw-test.svg',S/'adaptation.svg')
# Start with the approved flag source each time; apply placement only, with no contour edits.
ET.register_namespace('', 'http://www.w3.org/2000/svg')
flag=ET.parse(R/'flag-and-feathers/svg/flag-original-cleaned.svg').getroot()
group=ET.Element('{http://www.w3.org/2000/svg}g',{'transform':'translate(-3.554 0.278)'})
for child in list(flag):
 if child.tag.endswith('title'):continue
 flag.remove(child);group.append(child)
flag.append(group)
ET.ElementTree(flag).write(S/'continuous-event.svg',encoding='utf-8',xml_declaration=True)
node=os.environ.get('NODE','node')  # the Node executable
sharp=os.environ.get('SHARP','sharp')  # the sharp module: a path or a name Node can resolve
renderer=R/'render_selected.cjs'
renderer.write_text('''const sharp=require(process.argv[2]),path=require('path');(async()=>{let r=process.argv[3];for(let key of ['concept','adaptation','instant-event','continuous-event'])for(let n of [32,105,128,420])await sharp(path.join(r,key+'.svg'),{density:576}).resize(n,n).png().toFile(path.join(r,key+(n===105?'':n===420?'@4x':'-'+n)+'.png'));})().catch(e=>{console.error(e);process.exit(1)});''')
subprocess.run([node,str(renderer),sharp,str(S)],check=True)
for key in ['concept','adaptation','instant-event','continuous-event']:
 for suffix in ['', '@4x','-32','-128']:
  p=S/f'{key}{suffix}.png';im=Image.open(p).convert('RGBA');alpha=im.getchannel('A')
  black=Image.new('RGBA',im.size,(0,0,0,0));black.putalpha(alpha);black.save(p)
  if suffix=='':
   alpha.save(S/f'{key}-mask.png');assert im.size==(105,105)
   assert np.array_equal(np.array(alpha),np.array(Image.open(S/f'{key}-mask.png')))
centers={}
for key in ['concept','continuous-event']:
 arr=np.array(Image.open(S/f'{key}@4x.png'))[:,:,3]/255
 yy,xx=np.indices(arr.shape)
 center=[float((arr*(xx+.5)).sum()/arr.sum()/4),float((arr*(yy+.5)).sum()/arr.sum()/4)]
 assert all(abs(c-52.5)<.08 for c in center),center
 centers[key]=center
 alpha=Image.open(S/f'{key}.png').getchannel('A');box=alpha.getbbox()
 assert box[0]>0 and box[1]>0 and box[2]<105 and box[3]<105,box
(S/'centering-check.json').write_text(json.dumps({'ink_centers_in_105_canvas':centers,'medallion_center_in_proof_crop':[136.5,123.0]},indent=2))
manifest=json.loads((S/'SELECTIONS.json').read_text())
manifest['concept']='Selected: E — Light bulb; corrected placement and optical balance'
manifest['continuous-event']='Selected: original cleaned flag; corrected placement and optical balance'
manifest['adaptation']='Selected: new hooked raptor claw; approved by user'
manifest['status']='All four support icons locked by user'
(S/'SELECTIONS.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(S/'README.txt').write_text('''SELECTED SUPPORT ICONS
Concept: cleaned Light Bulb (E), optically centered.
Adaptation: approved hooked raptor claw.
Instant Event: original meteor, cleaned edges.
Continuous Event: original flag, cleaned edges, optically centered.

SVGs are editable 105 x 105 symbol-only artwork. Medallion geometry remains unchanged.
Native PNGs are 105 x 105; @4x PNGs are 420 x 420. All RGB pixels are black, with transparent negative space.
Grayscale masks use white for ink and black for empty. Additional 32px and 128px PNGs support readability checks and proof placement.
No image generation or game-file/layout changes. Only exported design selections are locked here.
''',encoding='utf-8')
master=Image.open(R/'reference/Prehistoric_Card_Master_Template_Geometry_v3_1462x2048.png').convert('RGBA')
base=master.crop((1163,38,1419,276))
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',n)
bold=lambda n:ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',n)
proof=Image.new('RGB',(1160,430),'#f6f4ee');d=ImageDraw.Draw(proof)
d.text((22,16),'SELECTED SUPPORT ICONS',font=bold(26),fill='black')
for i,(key,label) in enumerate([('concept','Concept'),('adaptation','Adaptation'),('instant-event','Instant Event'),('continuous-event','Continuous Event')]):
 x=20+i*290
 # Composite at 4x so the measured half-pixel center can be represented exactly.
 frame=base.resize((1024,952),Image.Resampling.LANCZOS)
 art=Image.open(S/f'{key}@4x.png').resize((512,512),Image.Resampling.LANCZOS)
 frame.alpha_composite(art,(290,236))
 frame=frame.resize((256,238),Image.Resampling.LANCZOS)
 d.text((x,65),label,font=bold(21),fill='black');proof.paste(frame.convert('RGB'),(x,104))
 im=Image.open(S/f'{key}-32.png');proof.paste(im,(x+100,366),im)
proof.save(S/'selected-icons-proof.png')
with zipfile.ZipFile(R/'selected-support-icons.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(S.iterdir()):
  if p.is_file():z.write(p,p.name)
print('Selected set regenerated; verified optical ink centers:',centers)
