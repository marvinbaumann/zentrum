// node resize.js icon-B.svg.png  → schreibt ../icons/sun-{180,512,1024}.png
const { readPNG, writePNG, resize } = require('./png.js');
const img = readPNG(process.argv[2]);
for (const size of [180, 512, 1024]) writePNG(`../icons/sun-${size}.png`, size, size, resize(img, size));
console.log('icons written');
