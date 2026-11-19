"""Regenerate the original PostureLab launcher and splash graphics (Pillow required)."""
from pathlib import Path
from PIL import Image, ImageDraw

res = Path(__file__).resolve().parents[1] / 'android/app/src/main/res'
navy, gold = '#00335a', '#ffd166'
def symbol(size, transparent=False):
    image=Image.new('RGBA',(size,size),(0,0,0,0) if transparent else navy)
    draw=ImageDraw.Draw(image)
    def line(points,color,width):
        draw.line([(round(x*size/108),round(y*size/108)) for x,y in points],fill=color,width=max(1,round(width*size/108)),joint='curve')
    line([(31,46),(54,46),(77,46)],'white',4)
    line([(54,43),(54,68)],'white',4)
    line([(42,68),(66,68)],'white',4)
    line([(42,68),(35,86)],'white',4)
    line([(66,68),(73,86)],'white',4)
    line([(54,19),(54,91)],gold,1)
    for x,y,r in [(54,31,7),(31,46,2.5),(77,46,2.5),(42,68,2.5),(66,68,2.5),(35,86,2.5),(73,86,2.5)]:
        draw.ellipse(tuple(round(v*size/108) for v in (x-r,y-r,x+r,y+r)),fill=gold)
    return image
for path in res.glob('mipmap-*/*.png'):
    with Image.open(path) as current: size=current.width
    symbol(size, 'foreground' in path.name).save(path)
for path in res.glob('drawable*/splash.png'):
    with Image.open(path) as current: width,height=current.size
    image=Image.new('RGB',(width,height),navy)
    mark=symbol(max(120,min(width,height)//3))
    image.paste(mark,((width-mark.width)//2,(height-mark.height)//2),mark)
    image.save(path,optimize=True)
print('PostureLab Android branding regenerated.')
