Alongside Superior Flat, I have shipped three more Minecraft mods in Java: Villagers Empowered, ported separately to both Fabric and Forge, and Random Reimagined Renovations. They are grouped on one card here rather than three thin ones because they are the same modding story as Superior Flat, not three separate portfolios worth of work.

<div class="todo">TODO: why I built this. Ryker writes this one. It is the field that separates this site from every other student portfolio, so it is not auto-generated.</div>

## Maintaining two mod loaders

Fabric and Forge are two different mod loaders for the same game, with different APIs, different event systems, and different release cadences, so a Fabric mod does not become a Forge mod by recompiling it. Villagers Empowered exists as two real ports, `villagers_empowered-FABRIC` and `villagers_empowered-FORGE`, which is the part of this work that is actually interesting to talk about: the game logic is shared conceptually, but the integration layer against each loader has to be written and kept working twice.

## What each mod does

<div class="todo">TODO: a sentence per mod on what Villagers Empowered and Random Reimagined Renovations actually change in-game. Ryker fills this in with the specifics; leaving it out here rather than guessing at gameplay details that are not in the source material for this build.</div>
