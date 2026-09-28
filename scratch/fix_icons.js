import { Jimp } from 'jimp';
import path from 'path';

async function fixIcons() {
  const iconPath = path.resolve('assets/icon.png');
  const originalPath = path.resolve('assets/icon_original.png'); // assuming we have the original or we'll just modify the current
  const trayPath = path.resolve('assets/tray-iconTemplate.png');
  const tray2xPath = path.resolve('assets/tray-iconTemplate@2x.png');

  try {
    // 1. Fix Dock Icon (Rounded Corners)
    const image = await Jimp.read(iconPath);
    const W = image.bitmap.width;
    const H = image.bitmap.height;
    // Apple standard corner radius is roughly 22.5% of the width
    const R = Math.floor(W * 0.225); 

    image.scan(0, 0, W, H, function(x, y, idx) {
      let drop = false;
      
      // Top Left
      if (x < R && y < R) {
        if (Math.pow(x - R, 2) + Math.pow(y - R, 2) > Math.pow(R, 2)) drop = true;
      }
      // Top Right
      else if (x > W - R && y < R) {
        if (Math.pow(x - (W - R), 2) + Math.pow(y - R, 2) > Math.pow(R, 2)) drop = true;
      }
      // Bottom Left
      else if (x < R && y > H - R) {
        if (Math.pow(x - R, 2) + Math.pow(y - (H - R), 2) > Math.pow(R, 2)) drop = true;
      }
      // Bottom Right
      else if (x > W - R && y > H - R) {
        if (Math.pow(x - (W - R), 2) + Math.pow(y - (H - R), 2) > Math.pow(R, 2)) drop = true;
      }

      if (drop) {
        this.bitmap.data[idx + 3] = 0; // Transparent
      }
    });

    await image.write(iconPath);
    console.log('Dock icon rounded successfully!');

    // 2. Create minimalist Tray Icon (Just a U for UniHub, or we can draw a simple shape)
    // We will create a small 44x44 (for retina) black and transparent image.
    // We can just use the center part of the logo or draw a simple "U".
    
    // Instead of complex drawing, let's just make a small circle as a placeholder, 
    // or take the original image, scale it to 32x32, turn it entirely BLACK.
    // Since the original image is a solid block, it would just be a black square.
    
    // Let's create a custom "U" using Jimp pixels
    const trayImg = new Jimp({ width: 44, height: 44, color: 0x00000000 }); // Transparent
    // Draw a thick 'U'
    trayImg.scan(0, 0, 44, 44, function(x, y, idx) {
      // U shape: left bar, right bar, bottom bar
      const isLeftBar = x >= 8 && x <= 14 && y >= 8 && y <= 30;
      const isRightBar = x >= 30 && x <= 36 && y >= 8 && y <= 30;
      const isBottomBar = x >= 8 && x <= 36 && y >= 26 && y <= 32;
      
      if (isLeftBar || isRightBar || isBottomBar) {
        this.bitmap.data[idx + 0] = 0; // R
        this.bitmap.data[idx + 1] = 0; // G
        this.bitmap.data[idx + 2] = 0; // B
        this.bitmap.data[idx + 3] = 255; // Alpha
      }
    });
    
    await trayImg.write(tray2xPath); // Retina
    trayImg.resize({ w: 22, h: 22 });
    await trayImg.write(trayPath);   // Standard

    console.log('Tray icons generated successfully!');
  } catch (error) {
    console.error('Error processing icons:', error);
  }
}

fixIcons();
