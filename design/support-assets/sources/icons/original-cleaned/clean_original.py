import os
from pathlib import Path
from collections import defaultdict
from PIL import Image,ImageDraw,ImageFont
import numpy as np
import subprocess,zipfile

R=Path(__file__).resolve().parent
src=R.parent/'reference'
proof=Image.open(src/'diet_and_support_fit.png').convert('RGB')
crop=proof.crop((810,442,938,570))
a=np.asarray(crop); yy,xx=np.ogrid[:128,:128]
ink=(a.max(axis=2)<100)&((xx-64)**2+(yy-64)**2<64**2)
# Trace the actual source pixels, including the crater holes; do not redraw the design.
edges=set()
for y,x in zip(*np.where(ink)):
 for p,q in [((x,y),(x+1,y)),((x+1,y),(x+1,y+1)),((x+1,y+1),(x,y+1)),((x,y+1),(x,y))]:
  if (q,p) in edges:edges.remove((q,p))
  else:edges.add((p,q))
links=defaultdict(list)
for p,q in edges:links[p].append(q)
loops=[]
while edges:
 p,q=min(edges);start=p; loop=[p]
 while True:
  edges.remove((p,q));loop.append(q)
  if q==start:break
  nxt=sorted(v for v in links[q] if (q,v) in edges)
  if not nxt:raise ValueError('Unclosed source contour')
  p,q=q,nxt[0]
 if len(loop)>8:loops.append(loop[:-1])

def simplify(points,tol=.85):
 p=np.asarray(points,dtype=float)
 if len(p)<3:return points
 v=p[-1]-p[0];den=np.linalg.norm(v)
 dist=np.abs(v[0]*(p[:,1]-p[0,1])-v[1]*(p[:,0]-p[0,0]))/den if den else np.linalg.norm(p-p[0],axis=1)
 k=int(dist.argmax())
 if dist[k]<=tol:return [points[0],points[-1]]
 return simplify(points[:k+1],tol)[:-1]+simplify(points[k:],tol)

paths=[]
for pts in loops:
 # Split closed contours at their farthest vertex before simplifying.
 k=max(range(len(pts)),key=lambda i:(pts[i][0]-pts[0][0])**2+(pts[i][1]-pts[0][1])**2)
 pts=simplify(pts[:k+1])[:-1]+simplify(pts[k:]+[pts[0]])[:-1]
 pts=np.array(pts,dtype=float)*105/128
 # Subpixel rounding removes staircase corners while retaining the source outline.
 incoming=[];outgoing=[]
 for i,p in enumerate(pts):
  u=pts[i-1]-p;v=pts[(i+1)%len(pts)]-p
  cosine=np.dot(u,v)/(np.linalg.norm(u)*np.linalg.norm(v))
  r=min(.2 if cosine>0 else 2.0,np.linalg.norm(u)/2,np.linalg.norm(v)/2)
  incoming.append(p+u/np.linalg.norm(u)*r);outgoing.append(p+v/np.linalg.norm(v)*r)
 fmt=lambda p:f'{p[0]:.3f} {p[1]:.3f}'
 path='M'+fmt(outgoing[-1])
 for i,p in enumerate(pts):path+=' L'+fmt(incoming[i])+' Q'+fmt(p)+' '+fmt(outgoing[i])
 paths.append(path+' Z')
svg='<svg xmlns="http://www.w3.org/2000/svg" width="105" height="105" viewBox="0 0 105 105"><title>Original Instant Event meteor — edge cleanup</title><path fill="#000" fill-rule="evenodd" d="'+' '.join(paths)+'"/></svg>'
(R/'instant-event-original-cleaned.svg').write_text(svg,encoding='utf-8')
node=os.environ.get('NODE','node')  # the Node executable
sharp=os.environ.get('SHARP','sharp')  # the sharp module: a path or a name Node can resolve
(R/'render.cjs').write_text('''const sharp=require(process.argv[2]),path=require('path');(async()=>{let r=process.argv[3];for(let n of [105,128,420])await sharp(path.join(r,'instant-event-original-cleaned.svg'),{density:576}).resize(n,n).png().toFile(path.join(r,'meteor-'+n+'.png'));})().catch(e=>{console.error(e);process.exit(1)});''')
subprocess.run([node,str(R/'render.cjs'),sharp,str(R)],check=True)
for n in [105,128,420]:
 p=R/f'meteor-{n}.png';im=Image.open(p).convert('RGBA');alpha=im.getchannel('A')
 black=Image.new('RGBA',im.size,(0,0,0,0));black.putalpha(alpha);black.save(p)
 if n==105:alpha.save(R/'instant-event-mask.png')
native=Image.open(R/'meteor-128.png')
# Confirm cleanup stayed close to the actual source silhouette, including holes.
after=np.asarray(native)[:,:,3]>=128
iou=np.sum(after&ink)/np.sum(after|ink)
assert iou>.97,iou
master=Image.open(src/'Prehistoric_Card_Master_Template_Geometry_v3_1462x2048.png').convert('RGBA')
frame=master.crop((1163,38,1419,276));frame.alpha_composite(native,(70,57))
sheet=Image.new('RGB',(640,320),'#f6f4ee');d=ImageDraw.Draw(sheet)
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',20)
d.text((30,16),'Your original',font=font,fill='black');d.text((350,16),'Edge cleanup only',font=font,fill='black')
sheet.paste(proof.crop((740,385,996,623)),(30,58));sheet.paste(frame.convert('RGB'),(350,58))
sheet.save(R/'original-cleanup-comparison.png')
(R/'README.txt').write_text(f'''Original meteor retained. This is an edge cleanup traced from the supplied comparison PNG, not a redesign.
Source contours and crater holes were threshold-traced and simplified by at most 0.85 source pixel. Small contour joins were smoothed with quadratic curves; sharp trail tips were preserved.
105 x 105 editable SVG and exact-black transparent RGBA PNG; grayscale mask uses white ink / black empty.
420px PNG also supplied. Frame appears only in the proof, unchanged.
Raster silhouette overlap against the original source: {iou:.2%} (intersection over union).
No image generation. No game files changed.
''')
with zipfile.ZipFile(R/'original-meteor-cleaned.zip','w',zipfile.ZIP_DEFLATED) as z:
 for name in ['instant-event-original-cleaned.svg','meteor-105.png','meteor-420.png','instant-event-mask.png','original-cleanup-comparison.png','README.txt','clean_original.py','render.cjs']:z.write(R/name,name)
print(f'Original silhouette overlap: {iou:.2%}; 105x105 RGBA and mask exported.')
