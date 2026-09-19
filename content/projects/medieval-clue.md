Medieval Clue is a digital version of the board game Clue, built in Java with a partner as a graded CSCI project. The board is modeled as a graph, using adjacency lists to represent which rooms and spaces connect to which, and the game runs on a Swing GUI with full turn handling, accusations, and suggestion logic for the computer players. Because it is a graded course project, this is write-up only: the source stays private, which is a plain honor-code call rather than something to explain away.

> **TODO: why I built this.** Ryker writes this one. It is the field that separates this
> site from every other student portfolio, so it is not auto-generated.

## The DFS with backtracking

The part of this project worth asking about in an interview is movement validation. Given a board modeled as a graph, figuring out every space a player can legally reach in a turn is a search problem: the implementation uses a recursive depth-first search (DFS) with backtracking, collecting valid movement targets into a HashSet so the result has no duplicates and lookup is fast. Backtracking here means the search can explore a path, hit a dead end or an already-visited space, and unwind cleanly to try the next option instead of getting stuck or double-counting.

## Testing the rules, not just the board

Movement logic and game-state rules were validated with JUnit tests, written and run alongside the graph and search code rather than after the fact, and the project was built collaboratively over Git with a partner.
