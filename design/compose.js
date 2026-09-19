// Composite-Vorschau bauen: rundet die Icons wie iOS ab und legt sie nebeneinander (reines Node, kein npm).
const fs=require('fs'),zlib=require('zlib');
function crc32(b){let c,crc=0xffffffff;for(let n=0;n<b.length;n++){c=(crc^b[n])&0xff;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crc=(crc>>>8)^c;}return(crc^0xffffffff)>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(td));return Buffer.concat([l,td,c]);}
function readPNG(file){const b=fs.readFileSync(file);let p=8,w,h,ct,idat=[];while(p<b.length){const len=b.readUInt32BE(p),t=b.toString('ascii',p+4,p+8),d=b.slice(p+8,p+8+len);if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);ct=d[9];}if(t==='IDAT')idat.push(d);p+=12+len;}
  const raw=zlib.inflateSync(Buffer.concat(idat));const bpp=ct===6?4:3,stride=w*bpp;const out=Buffer.alloc(w*h*4);let prev=Buffer.alloc(stride);
  for(let y=0;y<h;y++){const f=raw[y*(stride+1)];const row=Buffer.from(raw.slice(y*(stride+1)+1,(y+1)*(stride+1)));
    for(let i=0;i<stride;i++){const a=i>=bpp?row[i-bpp]:0,b2=prev[i],c=i>=bpp?prev[i-bpp]:0;let v=row[i];
      if(f===1)v+=a;else if(f===2)v+=b2;else if(f===3)v+=(a+b2)>>1;else if(f===4){const pa=Math.abs(b2-c),pb=Math.abs(a-c),pc=Math.abs(a+b2-2*c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b2:c;}row[i]=v&255;}
    for(let x=0;x<w;x++){out[(y*w+x)*4]=row[x*bpp];out[(y*w+x)*4+1]=row[x*bpp+1];out[(y*w+x)*4+2]=row[x*bpp+2];out[(y*w+x)*4+3]=bpp===4?row[x*bpp+3]:255;}prev=row;}
  return{w,h,data:out};}
function writePNG(file,w,h,data){const rows=[];for(let y=0;y<h;y++){rows.push(Buffer.from([0]));rows.push(data.slice(y*w*4,(y+1)*w*4));}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
  fs.writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]));}
// Squircle-Maske (Superellipse n=5)
function inSquircle(x,y,s){const nx=Math.abs(x/(s/2)-1),ny=Math.abs(y/(s/2)-1);return Math.pow(nx,5)+Math.pow(ny,5)<=1;}
const size=300,gap=60,pad=60;const W=pad*2+size*3+gap*2,H=pad*2+size;const out=Buffer.alloc(W*H*4);
for(let i=0;i<W*H;i++){out[i*4]=242;out[i*4+1]=242;out[i*4+2]=247;out[i*4+3]=255;}
['A','B','C'].forEach((k,idx)=>{const img=readPNG(`icon-${k}.svg.png`);const ox=pad+idx*(size+gap),oy=pad;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){if(!inSquircle(x+.5,y+.5,size))continue;
    // Downsample 1024→300 mit Box-Filter
    const sx0=Math.floor(x*img.w/size),sx1=Math.floor((x+1)*img.w/size),sy0=Math.floor(y*img.h/size),sy1=Math.floor((y+1)*img.h/size);let r=0,g=0,b=0,n=0;
    for(let sy=sy0;sy<sy1;sy++)for(let sx=sx0;sx<sx1;sx++){const i=(sy*img.w+sx)*4;r+=img.data[i];g+=img.data[i+1];b+=img.data[i+2];n++;}
    const o=((oy+y)*W+(ox+x))*4;out[o]=r/n;out[o+1]=g/n;out[o+2]=b/n;out[o+3]=255;}});
writePNG('preview.png',W,H,out);console.log('preview ok');
