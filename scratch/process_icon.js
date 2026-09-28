import { Jimp } from 'jimp';
import path from 'path';

async function processIcon() {
  const iconPath = path.resolve('assets/icon.png');
  const trayPath = path.resolve('assets/tray-iconTemplate.png');
  
  try {
    const image = await Jimp.read(iconPath);
    
    // Replace white-ish pixels with transparent
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const red = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];

      // If it's a white or very light gray pixel, make it fully transparent
      if (red > 240 && green > 240 && blue > 240) {
        this.bitmap.data[idx + 3] = 0; // Set alpha to 0 (transparent)
      }
    });

    // Overwrite the original files with the transparent versions
    await image.write(iconPath);
    await image.write(trayPath);
    console.log('Icons processed successfully!');
  } catch (error) {
    console.error('Error processing icons:', error);
  }
}

processIcon();
