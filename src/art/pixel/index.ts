/** Public entry point for all procedural pixel art. */
export * from './types';
export {
  makeCanvas,
  paint,
  silhouette,
  flipX,
  recolor,
  outlined,
  fromPixels,
  hash2,
  type Canvas,
} from './core';
export { getSprite, spriteInfo, getWeapon, weaponInfo } from './actors';
export { TILE, getGroundTile, getLiquidTile, getWallTile, getProp, propInfo } from './env';
export { getIcon } from './icons';
