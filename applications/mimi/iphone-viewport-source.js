// Canvas adapter for the iPhone immersive presentation. Physics remain in the
// original 360 × 640 world; extra screen space reveals more sky and terrain.
function createMimiViewport(canvas, context) {
  const viewport = { immersive: false, width: 360, height: 640, worldY: 0, worldX: 0, hudY: 0 };
  function resize() {
    viewport.immersive = document.documentElement.classList.contains('km-mimi');
    const bounds = canvas.getBoundingClientRect();
    const scale = viewport.immersive ? Math.min(bounds.width / 360, bounds.height / 640) : bounds.width / 360;
    if (!(scale > 0)) return;
    const density = Math.min(devicePixelRatio || 1, 2);
    viewport.width = viewport.immersive ? bounds.width / scale : 360;
    viewport.height = viewport.immersive ? bounds.height / scale : 640;
    viewport.worldY = (viewport.height - 640) / 2;
    viewport.worldX = viewport.immersive ? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--km-safe-left')) || 0) / scale : 0;
    viewport.hudY = viewport.immersive ? Math.max(((parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--km-safe-top')) || 0) + 68) / scale, viewport.worldY) : 0;
    canvas.width = Math.round(viewport.width * scale * density);
    canvas.height = Math.round(viewport.height * scale * density);
    context.setTransform(scale * density, 0, 0, scale * density, 0, 0);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  window.addEventListener('resize', resize);
  resize();
  viewport.dispose = () => { observer.disconnect(); window.removeEventListener('resize', resize); };
  viewport.begin = (distance, image) => {
    context.fillStyle = '#fffaf1';
    context.fillRect(-10, -10, viewport.width + 20, viewport.height + 20);
    if (image?.complete && image.naturalWidth > 0) {
      const tileHeight = viewport.height + 20;
      const tileWidth = image.naturalWidth * tileHeight / image.naturalHeight;
      const offset = (distance * .075) % (tileWidth * 2);
      for (let index = -1; index * tileWidth - offset < viewport.width + 10; index++) {
        context.save();
        context.translate(index * tileWidth - offset, -10);
        if (Math.abs(index % 2) === 1) { context.translate(tileWidth, 0); context.scale(-1, 1); }
        context.drawImage(image, 0, 0, tileWidth, tileHeight);
        context.restore();
      }
    }
  };
  return viewport;
}
