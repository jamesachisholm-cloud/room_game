# Current world map

Top-down schematic of the current game world. Building plans are schematic and not drawn to a common scale.

```text
[A] --10 room lengths--> [B]
 ^                        |
 |                        v
[D] <--10 room lengths-- [C]
```

Each path is 10 room lengths long and one grid cell wide, matching the door opening. `D` marks a doorway; `#` marks a closed wall.

## Building A (19 rooms)

Room 1 is wider than the others: it spans the first two original room positions. The former door between those positions is removed with the partition. The remaining rooms are renumbered 2–19.

```text
[01 WIDE: two room bays] --#-- [02] --D-- [03] --D-- [04]
  Down: 01-D-05; 01-#-06; 02-D-07; 03-D-08; 04-D-09
[05] --D-- [06] --#-- [07] --D-- [08] --D-- [09]
  Down: 05-#-10; 06-D-11; 07-D-12; 08-D-13; 09-#-14
[10] --D-- [11] --D-- [12] --D-- [13] --D-- [14]
  Down: 10-D-15; 11-D-16; 12-D-17; 13-#-18; 14-D-19
[15] --D-- [16] --#-- [17] --D-- [18] --D-- [19]
```

The added doorway is between Rooms 11 and 12 in the new numbering; it occupies the former 12-to-13 doorway position. Exterior doors:

- East door from Room 14 connects to Building B west door, Room 13.
- South door from Room 17 connects to Building D north door, Room 04.

Objects: a small wireframe box is in Room 06; a larger wireframe box is in Room 14.

## Building B (24 rooms; 6 columns by 4 rows)

Room numbers run left to right, then top to bottom.

```text
 01 --D-- 02 --#-- 03 --D-- 04 --D-- 05 --D-- 06
  D        #        D        D        D        #
 07 --#-- 08 --D-- 09 --D-- 10 --D-- 11 --D-- 12
  D        D        D        #        D        D
 13 --D-- 14 --D-- 15 --D-- 16 --D-- 17 --#-- 18
  D        #        D        D        D        #
 19 --D-- 20 --D-- 21 --D-- 22 --#-- 23 --D-- 24
```

Exterior doors:

- West door from Room 13 connects to Building A east door, Room 14.
- South door from Room 21 connects to Building C north door, Room 03.

## Building C (24 rooms; 6 columns by 4 rows)

Room numbers run left to right, then top to bottom.

```text
 01 --D-- 02 --#-- 03 --D-- 04 --D-- 05 --D-- 06
  D        #        D        D        D        #
 07 --#-- 08 --D-- 09 --D-- 10 --D-- 11 --D-- 12
  D        D        D        #        D        D
 13 --D-- 14 --D-- 15 --D-- 16 --D-- 17 --#-- 18
  D        #        D        D        D        #
 19 --D-- 20 --D-- 21 --D-- 22 --#-- 23 --D-- 24
```

Exterior doors:

- North door from Room 03 connects to Building B south door, Room 21.
- West door from Room 13 connects to Building D east door, Room 18.

## Building D (24 rooms; 6 columns by 4 rows)

Room numbers run left to right, then top to bottom.

```text
 01 --D-- 02 --#-- 03 --D-- 04 --D-- 05 --D-- 06
  D        #        D        D        D        #
 07 --#-- 08 --D-- 09 --D-- 10 --D-- 11 --D-- 12
  D        D        D        #        D        D
 13 --D-- 14 --D-- 15 --D-- 16 --D-- 17 --#-- 18
  D        #        D        D        D        #
 19 --D-- 20 --D-- 21 --D-- 22 --#-- 23 --D-- 24
```

Exterior doors:

- East door from Room 18 connects to Building C west door, Room 13.
- North door from Room 04 connects to Building A south door, Room 17.

## Ring connections

- Building A east, Room 14 to Building B west, Room 13.
- Building B south, Room 21 to Building C north, Room 03.
- Building C west, Room 13 to Building D east, Room 18.
- Building D north, Room 04 to Building A south, Room 17.
