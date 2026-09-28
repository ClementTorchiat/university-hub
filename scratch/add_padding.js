import { Jimp } from 'jimp';
import path from 'path';

async function addPadding() {
  const iconPath = path.resolve('/Users/clementtorchiat/PhpstormProjects/university-hub/assets/icon.png');

  try {
    const original = await Jimp.read(iconPath);
    const W = original.bitmap.width;
    const H = original.bitmap.height;
    
    // Scale image to 82%
    const targetW = Math.floor(W * 0.82);
    const targetH = Math.floor(H * 0.82);
    
    const scaled = original.clone().resize({ w: targetW, h: targetH });
    
    // Create new transparent canvas of original size
    const canvas = new Jimp({ width: W, height: H, color: 0x00000000 });
    
    // Paste scaled image into center
    const x = Math.floor((W - targetW) / 2);
    const y = Math.floor((H - targetH) / 2);
    
    canvas.composite(scaled, x, y);
    
    await canvas.write(iconPath);
    console.log('Padding added successfully!');
  } catch (error) {
    console.error('Error adding padding:', error);
  }
}

addPadding();
