# usage: fit-panic.py <src.png> <calm.png> <out.png> [low=.55]
# Fits a ChatGPT panic edit onto the calm file's frame by matching the
# part below `low` (the legs), which the edit must not have moved. A head
# part (the fox) passes 0 to match the whole silhouette.
import sys
from PIL import Image
import numpy as np
src=Image.open(sys.argv[1]).convert('RGBA'); calm=Image.open(sys.argv[2]).convert('RGBA')
print('src',src.size,'alpha range',np.array(src)[...,3].min(),np.array(src)[...,3].max(),'calm',calm.size)
ca=np.array(calm)[...,3]>128; H,W=ca.shape
LOW=float(sys.argv[4]) if len(sys.argv)>4 else .55  # fraction of the height above the part that must not move
mask=np.zeros_like(ca); mask[int(H*LOW):,:]=True
def place(sc,dx,dy):
    w=round(W*sc); h=round(src.height*w/src.width)
    im=src.resize((w,h),Image.LANCZOS)
    x0=dx+(W-w)//2; y0=dy+(H-h)//2
    canvas=Image.new('RGBA',(W,H),(0,0,0,0))
    canvas.paste(im,(x0,y0),im)
    return canvas
best=None
for sc in np.arange(0.94,1.065,0.005):
    w=round(W*sc); h=round(src.height*w/src.width)
    a=np.array(src.resize((w,h),Image.LANCZOS))[...,3]>128
    for dx in range(-10,11):
        for dy in range(-10,11):
            can=np.zeros((H,W),bool); x0=dx+(W-w)//2; y0=dy+(H-h)//2
            sx,sy=max(0,-x0),max(0,-y0); tx,ty=max(0,x0),max(0,y0)
            ww=min(w-sx,W-tx); hh=min(h-sy,H-ty)
            can[ty:ty+hh,tx:tx+ww]=a[sy:sy+hh,sx:sx+ww]
            m=ca&mask; c=can&mask; iou=(m&c).sum()/max(1,(m|c).sum())
            if best is None or iou>best[0]: best=(iou,sc,dx,dy)
print('best lower-body IoU %.4f scale %.3f dx %d dy %d'%best)
out=place(*best[1:]); out.save(sys.argv[3])
oa=np.array(out)[...,3]>128
print('whole IoU %.4f'%((oa&ca).sum()/(oa|ca).sum()))
