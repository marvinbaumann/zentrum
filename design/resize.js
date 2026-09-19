// Skaliert ein 1024er PNG (Box-Filter) auf die App-Icon-Größen.
const fs=require('fs');
const src=process.argv[2];
const code=fs.readFileSync('compose.js','utf8');
const readPNG=eval(code.match(/function readPNG[\s\S]*?\n  return\{w,h,data:out\};\}/)[0].replace(/^function readPNG/,'(function readPNG')+')');
const helpers=code.match(/function crc32[\s\S]*?function writePNG[\s\S]*?\n  fs\.writeFileSync[^\n]*\n\}/)[0];
const zlib=require('zlib');
eval(helpers.replace(/function (\w+)/g,'globalThis.$1=function $1'));
const img=readPNG(src);
for(const size of [180,512,1024]){
  const out=Buffer.alloc(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const sx0=Math.floor(x*img.w/size),sx1=Math.max(sx0+1,Math.floor((x+1)*img.w/size)),sy0=Math.floor(y*img.h/size),sy1=Math.max(sy0+1,Math.floor((y+1)*img.h/size));
    let r=0,g=0,b=0,n=0;for(let sy=sy0;sy<sy1;sy++)for(let sx=sx0;sx<sx1;sx++){const i=(sy*img.w+sx)*4;r+=img.data[i];g+=img.data[i+1];b+=img.data[i+2];n++;}
    const o=(y*size+x)*4;out[o]=r/n;out[o+1]=g/n;out[o+2]=b/n;out[o+3]=255;}
  writePNG(`../icons/icon-${size}.png`,size,size,out);
}
console.log('icons written');
