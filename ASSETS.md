# Assets & Credits

## Current: Procedural Pixel Art
Sprites are generated programmatically via Canvas2D (`src/engine/SpriteGenerator.ts`).
No external asset files required.

## Recommended Free Assets for Future Phases

### Kenney Assets (CC0 — Public Domain)
- **Isometric tiles**: https://kenney.nl/assets/isometric-miniature
- **Office/furniture**: https://kenney.nl/assets/furniture-kit
- **Characters**: https://kenney.nl/assets/tiny-town
- License: CC0 1.0 — free for any use, no attribution required

### LPC (Liberated Pixel Cup) Character Generator
- **Generator**: https://sanderfrenken.github.io/Universal-LPC-Spritesheet-Character-Generator/
- **Spritesheets**: https://opengameart.org/content/liberated-pixel-cup-lpc-base-assets-sprites-map-tiles
- License: CC-BY-SA 3.0 / GPL 3.0
- Attribution required if used

### OpenGameArt.org
- **Isometric tiles**: https://opengameart.org/art-search?keys=isometric+office
- Various licenses (check per asset)

## Integration Plan
1. Download Kenney isometric tiles → `public/assets/tiles/`
2. Generate LPC characters for each agent role → `public/assets/characters/`
3. Update `SpriteGenerator.ts` to load spritesheets instead of procedural generation
4. Add spritesheet animation frames (walk, idle, work cycles)
