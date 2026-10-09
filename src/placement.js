export function hasClearFootprint(world, object, x, y) {
  const hasFootprint = object.type === 'box' || object.type === 'table';
  const halfX = hasFootprint ? object.w / 2 : object.scale * 1.3;
  const halfY = hasFootprint ? object.d / 2 : object.scale * .45;
  const left = x - halfX;
  const right = x + halfX;
  const top = y - halfY;
  const bottom = y + halfY;

  for (let cellY = Math.floor(top); cellY < bottom; cellY++) {
    for (let cellX = Math.floor(left); cellX < right; cellX++) {
      if (world.isWall(cellX, cellY)) return false;
    }
  }
  return true;
}