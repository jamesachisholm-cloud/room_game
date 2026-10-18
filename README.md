# Room Lines

Room Lines is a first-person wireframe exploration game that runs in the browser. Explore five connected buildings, collect objects, and match them with pictures to earn credits.

## Run the game

The game uses browser modules and fetches its map data, so serve the project over HTTP instead of opening `index.html` directly. With Python 3 installed, run this from the project directory:

```sh
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). Stop the server with `Ctrl+C`.

## Controls

- `W`, `A`, `S`, `D`: move
- Arrow keys: move forward/back and turn left/right
- Mouse: look around after clicking the game to capture the pointer
- `E`: pick up a nearby object
- `1`–`9` or `0`: select an inventory slot
- `G`: drop the selected object

The inventory holds up to 10 objects. Drop an object in a room with its matching picture to earn credits. Picking up a paired object again reverses the credit.

## Edit the map

Open [map.html](map.html) for a visual map and the map syntax guide. Edit [maps/world.map](maps/world.map), then refresh the map page or game. Each bay is 7 × 7 map units; repeated room IDs join connected bays into a room. The plan defines rooms, doors, exits, objects, building connections, and junction paths.

## Object and picture placement rules

Apply these whenever objects or pictures in [maps/world.map](maps/world.map) are added or moved (buildings A–D):

- At most one item (object or picture) per room.
- An object and its matching picture go in different buildings.
- Place objects in room corners (`1.6` or `5.4` within the bay), away from doorways.
- Never place a picture on a door, exit, or magic door; keep at least 0.8 map units from the opening and otherwise use the wall offset closest to the centre (`3.5`).

When a game starts, non-picture objects are randomly reassigned among eligible picture-free rooms in buildings A–D. Buildings E and F are excluded.

## Project layout

- `src/main.js`: starts the game and coordinates each frame
- `src/world.js`: builds the world from the parsed plan
- `src/map-plan.js`: loads, parses, and validates `maps/world.map`
- `src/object-geometry.js`: creates wireframe geometry for objects and pictures
- `src/object-types.js`: shared object names, values, and map markers
- `src/player.js`: movement, pickup, drop, and interaction controls
- `src/renderer.js`: canvas raycasting, projection, and drawing
- `src/hud.js`: inventory and game HUD
- `src/map-preview.js`: renders the building map page
- `tests/core.test.js`: parser and placement tests

## Tests

Requires Node.js 18 or newer. No packages need to be installed; tests use Node's built-in test runner:

```sh
npm test
```