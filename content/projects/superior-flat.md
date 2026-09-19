Superior Flat is a Fabric mod for Minecraft, written in Java, that rebuilds the Superflat world type into something worth playing on. It ships 6 custom Superflat presets that cover the Overworld, the Nether, and the End, so flat-world generation is no longer just a single empty layer of stone. It has passed 2,000 downloads on CurseForge and I have kept releases going for every major Minecraft version from 1.19.1 through 1.21, which means going back into the Fabric API each time Mojang changes how world generation hooks together.

<div class="todo">TODO: why I built this. Ryker writes this one. It is the field that separates this site from every other student portfolio, so it is not auto-generated.</div>

## The chunk generators

The engineering core of the mod is 8 custom chunk generators, each one extending Minecraft's `NoiseChunkGenerator` through the Fabric API rather than replacing world generation wholesale. That distinction matters: hooking into the existing noise pipeline means the mod stays compatible with everything else that expects a normal chunk generator (structures, mob spawning, other mods), instead of forking Minecraft's terrain code and fighting it forever. Each generator corresponds to one of the presets and controls what the flat layers look like and how the dimension-specific rules (caves, structures, biome placement) apply on top of them.

## Maintenance across versions

Minecraft's world generation internals change enough between major versions that "maintained 1.19.1 through 1.21" is not a passive claim. Every Fabric API and mapping update has been a chance for the chunk generator hooks to break, so keeping six presets working across that whole span has meant re-verifying the generation pipeline on each release rather than just bumping a version number in `gradle.properties`.
