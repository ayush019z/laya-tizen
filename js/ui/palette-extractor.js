/**
 * Laya TV - Dynamic Artwork-Driven Theming & Material Palette Extractor
 */

class PaletteExtractor {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 48;
    this.canvas.height = 48;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  async extractAndApply(imageUrl) {
    if (!imageUrl) return;

    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      this.ctx.clearRect(0, 0, 48, 48);
      this.ctx.drawImage(img, 0, 0, 48, 48);
      const imgData = this.ctx.getImageData(0, 0, 48, 48).data;

      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      let maxSat = 0;
      let vibrantColor = [255, 42, 109]; // fallback neon pink

      for (let i = 0; i < imgData.length; i += 16) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const a = imgData[i + 3];

        if (a < 128) continue;

        // Calculate saturation
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;

        rSum += r;
        gSum += g;
        bSum += b;
        count++;

        if (sat > maxSat && max > 60 && min < 220) {
          maxSat = sat;
          vibrantColor = [r, g, b];
        }
      }

      const avgR = count ? Math.floor(rSum / count) : 30;
      const avgG = count ? Math.floor(gSum / count) : 30;
      const avgB = count ? Math.floor(bSum / count) : 45;

      const [vr, vg, vb] = vibrantColor;

      // Apply dynamic colors to document root
      const root = document.documentElement;
      root.style.setProperty('--dynamic-accent', `rgb(${vr}, ${vg}, ${vb})`);
      root.style.setProperty('--dynamic-glow', `rgba(${vr}, ${vg}, ${vb}, 0.6)`);
      root.style.setProperty('--ambient-primary', `rgba(${vr}, ${vg}, ${vb}, 0.22)`);
      root.style.setProperty('--ambient-secondary', `rgba(${avgR}, ${avgG}, ${avgB}, 0.28)`);

      // Update liquid gradient background orbs
      const orb1 = document.querySelector('.liquid-orb-1');
      if (orb1) {
        orb1.style.background = `radial-gradient(circle, rgba(${vr}, ${vg}, ${vb}, 0.45) 0%, transparent 70%)`;
      }
      const orb2 = document.querySelector('.liquid-orb-2');
      if (orb2) {
        orb2.style.background = `radial-gradient(circle, rgba(${avgR}, ${avgG}, ${avgB}, 0.5) 0%, transparent 70%)`;
      }
    } catch (e) {
      console.warn('[PaletteExtractor] Fallback to default neon theme:', e);
    }
  }
}

window.PaletteExtractor = new PaletteExtractor();
