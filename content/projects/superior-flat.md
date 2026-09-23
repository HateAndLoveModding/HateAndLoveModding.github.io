Superior Flat is a Minecraft mod that makes flat worlds feel like the normal game. It is built on Fabric, a mod loader (the framework that loads mods into Minecraft and lets them hook into the game's code), and it adds six world presets to the "World Type" button on the world creation screen. Between July 2023 and August 2025 I shipped 11 releases covering Minecraft 1.19.1 through 1.21.8, and together they have 2,017 downloads on CurseForge.

## Flat, but not empty

Minecraft already has a Superflat world type, but it gives you a single biome (a region with its own climate, plants, and mobs, like desert or taiga) on top of three layers of dirt and grass. That is great for building and boring for everything else. I wanted flat worlds that keep the rest of the game: every biome, a full depth of stone and deepslate underneath to mine through, trees, villages, and flat versions of the Nether and the End too.

The main preset, Superior Flat, fills every overworld column with the same stack of 143 blocks: bedrock, 65 layers of deepslate, 65 of stone, 11 of dirt, and grass on top. The top of the stack changes with the biome underneath it, so the flat world still looks like the world you know:

- deserts and snowy beaches are sand, badlands are terracotta, and windswept gravelly hills are gravel
- mushroom fields get mycelium, ice spikes get snow, and mangrove swamps get mud
- rivers are 8 blocks of water, oceans are 20, and deep oceans are 40
- swamps are a patchwork of grass and shallow water

The Nether is bedrock and 64 layers of netherrack, with crimson or warped nylium on top in those forests and soul sand and soul soil in soul sand valleys. The End's main island is a flat, three-block-thick disc of end stone, and the outer islands are flat slabs.

## The presets

- **Superior Flat.** Everything above, with Minecraft's normal biome layout.
- **SF Classic.** The vanilla Superflat layers (bedrock, two dirt, grass) in plains, with a matching thin Nether and a flat End.
- **SF Leaves.** Three layers of oak leaves and nothing underneath, in every dimension. It is a survival challenge: one wrong step and you fall into the void.
- **SF Villages.** Superior Flat limited to the five biomes where villages spawn (plains, desert, savanna, taiga, and snowy plains), so villages show up far more often.
- **SF Forest.** Superior Flat limited to eight wooded biomes, from dark forest and flower forest to jungle and cherry grove.
- **SF Snow.** Only cold biomes. This is the one preset that is not flat: it keeps Minecraft's normal terrain, so it has frozen peaks and snowy slopes.

## How it works

Every preset is a JSON file in a data pack inside the mod. The file names a generator and a biome source for each of the three dimensions, and a tag file adds the presets to the World Type list. The villages and forest presets are mostly JSON: each lists its allowed biomes and reuses the main generators. The snow preset lists cold biomes and uses Minecraft's own generator.

The generators are Java classes. Minecraft builds normal terrain with a class called `NoiseChunkGenerator`, which fills each chunk (a 16 by 16 column of the world) from 3D noise to make hills, caves, and overhangs. Each of my generators extends that class and overrides `populateNoise`, the method that places the terrain blocks. Instead of sampling noise, mine walks every column in the chunk, asks which biome it is in, and copies the matching list of blocks straight up from the bottom of the world. It also overrides `carve` to do nothing, so ravines and carved caves do not cut holes in the ground.

Because everything else is inherited, the rest of Minecraft's world generation still runs on top of the flat ground: biomes land where they normally would, and trees, ores, and structures like villages generate as usual. `NoiseChunkGenerator` is not meant to be extended, though, so the mod uses an access widener, a Fabric file that opens up a class or method the game normally keeps private, to make it extendable.

## Keeping up with Minecraft

Minecraft changes its world generation code often, so a mod built for one version usually does not compile for the next. I keep a separate copy of the mod for each range of versions that share an API: 1.19.1 to 1.19.2, 1.19.3 to 1.20.4, 1.20.5 to 1.20.6, 1.21, and 1.21.5 to 1.21.8. The biggest change came with 1.19.3, when I moved the presets out of Java code and into the JSON files described above. The most downloaded file is the January 2024 build for 1.19.3 to 1.20.4, with 491 downloads.

## What I would change

The random parts of the world are not tied to the world's seed. Swamps, soul sand valleys, and the thickness of the End's outer islands (4, 8, 12, 16, or 20 blocks, picked once per chunk) all come from `new Random()`, which starts from a different value every time. Two players who create a world from the same seed get different swamps, and the underside of an outer End island steps between thicknesses at every chunk border. Seeding the random generator from the world seed and the chunk position would fix both.

The GitHub repository has also fallen behind. It stops at the 1.21 version from July 2024, and that branch's main class imports a Sort Of Flat generator that was never committed, so it does not build as published. The 1.21.5 to 1.21.8 source exists only on my machine. Every version should be on GitHub as its own branch.

Sort Of Flat is also the next preset. It keeps the ground flat everywhere except tall mountains, which are left as real terrain, and the ground ramps smoothly from flat up into each mountain instead of meeting it in a wall. It is written in my development copy for 1.21.5 to 1.21.8 but is not in a release yet.
