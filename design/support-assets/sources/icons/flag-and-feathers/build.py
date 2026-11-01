import os
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageFilter
import numpy as np
from collections import defaultdict
import subprocess,zipfile,json

R=Path(__file__).resolve().parent;SRC=R.parent/'reference'
for name in ['svg','png','masks','proofs']:(R/name).mkdir(exist_ok=True)
reference=Image.open(SRC/'diet_and_support_fit.png').convert('RGB')

def simplify(points,tol=1.2):
 p=np.asarray(points,dtype=float)
 if len(p)<3:return points
 v=p[-1]-p[0];den=np.linalg.norm(v)
 dist=np.abs(v[0]*(p[:,1]-p[0,1])-v[1]*(p[:,0]-p[0,0]))/den if den else np.linalg.norm(p-p[0],axis=1)
 k=int(dist.argmax())
 if dist[k]<=tol:return [points[0],points[-1]]
 return simplify(points[:k+1],tol)[:-1]+simplify(points[k:],tol)

def trace(cx):
 crop=reference.crop((cx-64,442,cx+64,570));a=np.asarray(crop);yy,xx=np.ogrid[:128,:128]
 ink=(a.max(axis=2)<100)&((xx-64)**2+(yy-64)**2<64**2)
 edges=set()
 for y,x in zip(*np.where(ink)):
  for p,q in [((x,y),(x+1,y)),((x+1,y),(x+1,y+1)),((x+1,y+1),(x,y+1)),((x,y+1),(x,y))]:
   if (q,p) in edges:edges.remove((q,p))
   else:edges.add((p,q))
 links=defaultdict(list)
 for p,q in edges:links[p].append(q)
 loops=[]
 while edges:
  p,q=min(edges);start=p;loop=[p]
  while True:
   edges.remove((p,q));loop.append(q)
   if q==start:break
   nxt=sorted(v for v in links[q] if (q,v) in edges)
   if not nxt:raise ValueError('Unclosed contour')
   p,q=q,nxt[0]
  if len(loop)>8:loops.append(loop[:-1])
 paths=[]
 for pts in loops:
  k=max(range(len(pts)),key=lambda i:(pts[i][0]-pts[0][0])**2+(pts[i][1]-pts[0][1])**2)
  pts=simplify(pts[:k+1])[:-1]+simplify(pts[k:]+[pts[0]])[:-1];pts=np.array(pts,dtype=float)*105/128
  inc=[];out=[]
  for i,p in enumerate(pts):
   u=pts[i-1]-p;v=pts[(i+1)%len(pts)]-p
   cosine=np.dot(u,v)/(np.linalg.norm(u)*np.linalg.norm(v))
   r=min(.2 if cosine>0 else 2,np.linalg.norm(u)/2,np.linalg.norm(v)/2)
   inc.append(p+u/np.linalg.norm(u)*r);out.append(p+v/np.linalg.norm(v)*r)
  fmt=lambda p:f'{p[0]:.3f} {p[1]:.3f}'
  path='M'+fmt(out[-1])
  for i,p in enumerate(pts):path+=' L'+fmt(inc[i])+' Q'+fmt(p)+' '+fmt(out[i])
  paths.append(path+' Z')
 return '<path fill-rule="evenodd" d="'+' '.join(paths)+'"/>',ink

flag,flag_ink=trace(1224);original_feather,_=trace(524)
ART={
 'flag-original-cleaned':('Original flag — edge cleanup',flag),
 'feather-a-original-cleaned':('A · Original cleaned',original_feather),
 'feather-b-flight':('B · Flight feather','''<g transform="rotate(30 52.5 52.5)">
 <path fill-rule="evenodd" d="M53 9 C66 18 73 33 71 46 L63 49 L70 52
 C68 65 62 75 53 82 C44 78 37 69 34 60 L43 63 L33 54
 C31 46 32 38 35 31 L44 39 L37 26 C41 18 47 12 53 9 Z
 M52 77 C49 57 49 34 53 18 C53 40 54 60 55 77 Z"/>
 <path d="M53 80 Q53 89 51 98" fill="none" stroke="#000" stroke-width="3.8" stroke-linecap="round"/></g>'''),
 'feather-c-soft':('C · Soft plume','''<g transform="rotate(30 52.5 52.5)">
 <path fill-rule="evenodd" d="M53 10 C69 17 77 33 74 48 L64 53 L73 52
 C71 61 67 69 60 74 L61 68 L55 80 Q52 84 49 80
 L42 70 L43 76 C35 70 29 60 29 51 L40 57 L29 45
 C29 31 39 16 53 10 Z
 M50 78 C47 58 48 36 53 21 C51 41 52 62 54 78 Z
 M52 47 L65 35 L55 51 Z
 M50 60 L38 45 L50 55 Z"/>
 <path d="M52 80 Q53 90 50 97" fill="none" stroke="#000" stroke-width="3.8" stroke-linecap="round"/></g>'''),
 'feather-d-slender':('D · Slender quill','''<g transform="rotate(30 52.5 52.5)">
 <path fill-rule="evenodd" d="M55 7 C65 24 69 39 65 52 L58 56 L64 56
 C61 68 57 77 51 83 C45 78 40 70 38 61 L44 64 L37 55
 C35 45 37 34 40 28 L46 38 L42 23 Q48 13 55 7 Z
 M49 78 Q47 51 54 18 Q50 50 52 78 Z"/>
 <path d="M51 81 Q50 91 48 98" fill="none" stroke="#000" stroke-width="3.5" stroke-linecap="round"/></g>''')}
for key,(label,body) in ART.items():
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="105" height="105" viewBox="0 0 105 105"><title>{label}</title><g fill="#000">{body}</g></svg>'
 (R/'svg'/f'{key}.svg').write_text(svg,encoding='utf-8')

node=os.environ.get('NODE','node')  # the Node executable
sharp=os.environ.get('SHARP','sharp')  # the sharp module: a path or a name Node can resolve
(R/'render.cjs').write_text('''const sharp=require(process.argv[2]),fs=require('fs'),path=require('path');(async()=>{let r=process.argv[3];for(let f of fs.readdirSync(path.join(r,'svg')))for(let n of [32,105,128,420])await sharp(path.join(r,'svg',f),{density:576}).resize(n,n).png().toFile(path.join(r,'png',f.replace('.svg','')+'-'+n+'.png'));})().catch(e=>{console.error(e);process.exit(1)});''')
subprocess.run([node,str(R/'render.cjs'),sharp,str(R)],check=True)
checks={}
for key in ART:
 for n in [32,105,128,420]:
  p=R/'png'/f'{key}-{n}.png';im=Image.open(p).convert('RGBA');alpha=im.getchannel('A')
  black=Image.new('RGBA',im.size,(0,0,0,0));black.putalpha(alpha);black.save(p)
  if n==105:
   alpha.save(R/'masks'/f'{key}.png');checks[key]={'size':list(im.size),'bounds':alpha.getbbox()}
   assert alpha.getbbox()[0]>0 and alpha.getbbox()[1]>0 and alpha.getbbox()[2]<105 and alpha.getbbox()[3]<105
after=np.array(Image.open(R/'png/flag-original-cleaned-128.png'))[:,:,3]>=128
iou=(after&flag_ink).sum()/(after|flag_ink).sum();assert iou>.95
checks['flag_source_overlap']=float(iou)
master=Image.open(SRC/'Prehistoric_Card_Master_Template_Geometry_v3_1462x2048.png').convert('RGBA')
base=master.crop((1163,38,1419,276))
def frame(key):
 im=base.copy();im.alpha_composite(Image.open(R/'png'/f'{key}-128.png'),(70,57));return im.convert('RGB')
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',n)
bold=lambda n:ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',n)
sheet=Image.new('RGB',(640,320),'#f6f4ee');d=ImageDraw.Draw(sheet)
d.text((30,16),'Your original flag',font=font(20),fill='black');d.text((350,16),'Edge cleanup only',font=font(20),fill='black')
sheet.paste(reference.crop((1090,385,1346,623)),(30,58));sheet.paste(frame('flag-original-cleaned'),(350,58));sheet.save(R/'proofs/flag-cleanup.png')

sheet=Image.new('RGB',(1200,720),'#f6f4ee');d=ImageDraw.Draw(sheet)
d.text((24,18),'ADAPTATION · FOUR FEATHER OPTIONS',font=bold(27),fill='black')
d.text((24,59),'Same master medallion and placement · 105 × 105 symbol canvases',font=font(18),fill='#555555')
notes=['Original design, edges cleaned.','Bold, asymmetric flight feather.','Broader, softer plume.','Long, narrow quill.']
for i,(key,note) in enumerate(zip(list(ART)[1:],notes)):
 x=20+i*300;label=ART[key][0]
 d.text((x,106),label,font=bold(22),fill='black');sheet.paste(frame(key),(x,150))
 d.text((x,405),note,font=font(17),fill='#444444')
 im=Image.open(R/'png'/f'{key}-105.png');sheet.paste(im,(x+20,470),im)
 im=Image.open(R/'png'/f'{key}-32.png');sheet.paste(im,(x+195,508),im)
 d.text((x+25,594),'105 px',font=font(16),fill='#555555');d.text((x+188,554),'32 px',font=font(16),fill='#555555')
d.text((24,670),'Black silhouettes and transparent cutouts · deterministic vector work · no image generation',font=font(18),fill='#444444')
sheet.save(R/'proofs/feather-options.png')
(R/'validation.json').write_text(json.dumps(checks,indent=2))
(R/'README.txt').write_text('''Flag cleanup and four feather options.
Flag: traced directly from supplied proof, preserving pole, finial, slope and banner contour. Edge cleanup only.
A: original feather traced and cleaned; B: asymmetric flight feather; C: broad soft plume; D: slender quill.
All SVGs are editable 105x105 symbol-only artwork; existing master medallion unchanged.
PNG sizes: 105px native, 420px enlarged, 32px readability check, 128px proof placement.
All RGBA PNGs use black RGB, with opacity describing ink coverage. Negative space is transparent.
Grayscale masks use white for ink and black for empty, matching the diet mask convention.
Source for traced assets: supplied diet_and_support_fit.png. No source vector originals were available.
Hand-authored vector geometry and deterministic contour tracing only. No image generation or game-file changes.
''',encoding='utf-8')
with zipfile.ZipFile(R/'flag-and-feather-options.zip','w',zipfile.ZIP_DEFLATED) as z:
 for folder in ['svg','png','masks','proofs']:
  for p in sorted((R/folder).iterdir()):z.write(p,p.relative_to(R))
 for name in ['README.txt','validation.json','build.py','render.cjs']:z.write(R/name,name)
print(json.dumps(checks,indent=2))
