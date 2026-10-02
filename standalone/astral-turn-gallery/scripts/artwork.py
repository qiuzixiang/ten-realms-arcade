from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math, random
root=Path(__file__).resolve().parents[1]
font='/System/Library/Fonts/PingFang.ttc'
if not Path(font).exists(): font='/System/Library/Fonts/STHeiti Medium.ttc'
def f(n): return ImageFont.truetype(font,n)
def paint(w,h,cover):
 im=Image.new('RGB',(w,h)); px=im.load()
 for y in range(h):
  for x in range(w):
   t=max(0,1-math.hypot((x-w*.5)/w,(y-h*.44)/h)*1.5);px[x,y]=(int(7+18*t),int(28+41*t),int(36+43*t))
 d=ImageDraw.Draw(im);gold=(232,196,133); dim=(95,133,130);cx=w/2;cy=h*(.53 if cover else .5);r=w*.40
 random.seed(22)
 for i in range(65 if cover else 26):
  x=random.randrange(w);y=random.randrange(h);d.ellipse((x,y,x+2,y+2),fill=dim)
 for scale,width in [(1,4),(.94,1),(.81,2)]:d.ellipse((cx-r*scale,cy-r*scale,cx+r*scale,cy+r*scale),outline=gold,width=width)
 for i in range(60):
  a=math.pi*i/30;rr=r*(.92 if i%5 else .88);d.line((cx+rr*math.cos(a),cy+rr*math.sin(a),cx+r*.97*math.cos(a),cy+r*.97*math.sin(a)),fill=gold,width=2)
 # Code-native emblem: four enamel plates around the true rotation pivot.
 size=w*.19;gap=w*.025
 for j,n in enumerate(['1','2','5','6']):
  x=cx+(j%2-.5)*(size+gap)-size/2;y=cy+(j//2-.5)*(size+gap)-size/2
  d.rounded_rectangle((x,y,x+size,y+size),radius=w*.025,fill=(31,70,77),outline=gold,width=max(2,w//180))
  d.text((x+size/2,y+size*.5),n,font=f(int(w*.095)),anchor='mm',fill=(250,233,199))
 d.ellipse((cx-w*.03,cy-w*.03,cx+w*.03,cy+w*.03),fill=gold)
 d.arc((cx-r*.71,cy-r*.71,cx+r*.71,cy+r*.71),195,290,fill=gold,width=max(3,w//120))
 a=math.radians(290);x=cx+r*.71*math.cos(a);y=cy+r*.71*math.sin(a);d.polygon([(x,y),(x-w*.035,y-w*.007),(x-w*.012,y+w*.027)],fill=gold)
 if cover:
  d.text((w/2,h*.095),'星仪回廊',font=f(94),anchor='mm',fill=(250,235,207))
  d.text((w/2,h*.16),'只转四格，怎么整盘都变了',font=f(38),anchor='mm',fill=gold)
  d.text((w/2,h*.86),'旋转相邻四枚星仪，让编号归位',font=f(35),anchor='mm',fill=(232,233,212))
  d.text((w/2,h*.92),'60 道校准题  /  6 段机械回廊',font=f(28),anchor='mm',fill=dim)
  d.text((w/2,h*.974),'主题图形 · 非玩法截图',font=f(18),anchor='mm',fill=dim)
 return im
paint(512,512,False).save(root/'release/icon-512.png')
paint(1080,1440,True).save(root/'release/cover-1080x1440.png')
print('Original geometric artwork exported')
