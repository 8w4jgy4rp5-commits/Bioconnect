from PIL import Image
import numpy as np
im = np.asarray(Image.open("/home/user/Bioconnect/img/ref/rabbit-reference.jpg").convert("RGB")).astype(float)
key = np.median(np.concatenate([im[:20,:20].reshape(-1,3), im[-20:,-20:].reshape(-1,3)]), axis=0)
print("key", key)
d = np.sqrt(((im-key)**2).sum(-1))
a = np.clip((d-60)/(140-60), 0, 1)
# despill: pull magenta out of semi-transparent edge pixels
rgb = im.copy()
g = rgb[...,1]
spill = np.maximum(0, np.minimum(rgb[...,0], rgb[...,2]) - g)
edge = a < 1
rgb[...,0] = np.where(edge, rgb[...,0]-spill*(1-a), rgb[...,0])
rgb[...,2] = np.where(edge, rgb[...,2]-spill*(1-a), rgb[...,2])
out = np.dstack([np.clip(rgb,0,255), a*255]).astype(np.uint8)
img = Image.fromarray(out, "RGBA")
img = img.crop(img.getbbox())
print(img.size)
img.save("/home/user/Bioconnect/concepts/app-icon-v1/rabbit-cutout.png")
