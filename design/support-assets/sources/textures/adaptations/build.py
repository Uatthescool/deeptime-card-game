from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np
import json,zipfile

R=Path(__file__).resolve().parent
source=Path('C:/Dev/prehistoric-card-game/design/period-textures/Jurassic.png')
im=Image.open(source).convert('RGB')
assert im.size==(1049,1499)
a=np.asarray(im,dtype=float)/255
# Preserve the source texture's relief and spatial composition; change only its color ramp.
# Red is the main tonal channel in this red fossil texture.
t=a[:,:,0]
stops=np.array([0,.35,.65,1.0])
colors=np.array([[9,10,11],[21,22,23],[40,40,39],[68,64,54]],dtype=float)
out=np.empty_like(a)
for c in range(3):out[:,:,c]=np.interp(t,stops,colors[:,c])
# Warm mineral accents are confined to sparse, already-bright texture details.
# A local contrast test follows the existing fossil relief rather than drawing decoration.
from PIL import ImageFilter
blur=np.asarray(Image.fromarray((t*255).astype('uint8')).filter(ImageFilter.GaussianBlur(3)),dtype=float)/255
detail=t-blur
accent=np.clip((detail-.022)/.085,0,1)*np.clip((t-.66)/.22,0,1)*.68
amber=np.array([146,111,51],dtype=float)
out=out*(1-accent[:,:,None])+amber*accent[:,:,None]
texture=Image.fromarray(np.clip(np.round(out),0,255).astype('uint8'),'RGB')
texture.save(R/'Adaptations-charcoal-amber.png',dpi=(300,300))
texture.resize((525,750),Image.Resampling.LANCZOS).save(R/'Adaptations-charcoal-amber-preview.png')
sheet=Image.new('RGB',(832,650),'#f6f4ee');d=ImageDraw.Draw(sheet)
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',n)
bold=lambda n:ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',n)
d.text((24,16),'ADAPTATIONS · CHARCOAL + AMBER STUDY',font=bold(23),fill='black')
d.text((24,56),'Same fossil detail and native 1049 × 1499 size as the Jurassic texture',font=font(17),fill='#555555')
for x,label,img in [(24,'Existing Jurassic texture',im),(432,'Adaptation charcoal / amber',texture)]:
 d.text((x,98),label,font=bold(19),fill='black');sheet.paste(img.resize((376,537),Image.Resampling.LANCZOS),(x,132))
# Extend bottom to keep the full artwork within the sheet.
canvas=Image.new('RGB',(832,696),'#f6f4ee');canvas.paste(sheet,(0,0))
for x,img in [(24,im),(432,texture)]:canvas.paste(img.resize((376,537),Image.Resampling.LANCZOS),(x,132))
canvas.save(R/'texture-comparison.png')
(R/'palette.json').write_text(json.dumps({'status':'Review draft — charcoal with restrained amber accents','dimensions':[1049,1499],'source':str(source),'method':'Deterministic charcoal ramp; amber on sparse high-relief highlights; no image generation','ramp':dict(zip(['deep_shadow','shadow','mid_charcoal','highlight'],['#090a0b','#151617','#282827','#444036'])),'accent':'#926f33'},indent=2))
(R/'README.txt').write_text('''ADAPTATION CHARCOAL / AMBER — FIRST COLOR STUDY
Native texture: Adaptations-charcoal-amber.png, RGB PNG, 1049 x 1499 pixels.
This matches the Jurassic texture and the most common dimensions among the period arts.
The existing fossil texture is recolored through a charcoal ramp with sparse amber mineral highlights.
No new image generation, symbols, text, frame or medallion is baked into the texture.
Preview and side-by-side comparison are supplied separately.
The charcoal / amber color family is agreed; this precise treatment is a review draft.
No game assets or frame geometry have been changed.
''',encoding='utf-8')
assert Image.open(R/'Adaptations-charcoal-amber.png').size==im.size
with zipfile.ZipFile(R/'adaptation-charcoal-amber-study.zip','w',zipfile.ZIP_DEFLATED) as z:
 for name in ['Adaptations-charcoal-amber.png','Adaptations-charcoal-amber-preview.png','texture-comparison.png','palette.json','README.txt','build.py']:z.write(R/name,name)
print('Exported RGB texture at',texture.size)
