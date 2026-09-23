For my final project in CSCI 200 at Mines, I wrote a C++ program that scrambles a 3x3 Rubik's Cube and then solves it the way a person does, with the beginner method. It shows the cube after each stage in a window drawn with SFML, a C++ library for graphics and windows.

![The solver's SFML window showing the cube unfolded flat, stepping from a scramble through each stage until every face is one color, with the moves listed underneath](content/media/Rubik's_Cube.gif)

*One solve, from the scramble through each of the five stages to a solved cube.*

## Why solve it like a human

A program can solve a cube by searching, trying sequence after sequence of moves with an algorithm like depth-first or breadth-first search until one works. I wanted mine to follow the same steps a person learns instead, because what I ultimately want to build is an interactive program that teaches someone how to solve a Rubik's Cube. I have not built that part yet, but I would like to, and a solver that works in human steps is the foundation for it.

The beginner method solves the cube one layer at a time, in five stages:

- the white cross
- the white corners, which finishes the first layer
- the four edges of the middle layer
- the yellow cross on the last layer
- the last-layer corners

In the SFML version, you press the space bar to run each stage and watch the cube change, with the moves so far printed underneath.

## Storing the cube

The cube's state is six arrays of nine characters, one array per face, with each sticker stored as a letter for its color: W, Y, R, O, B, or G. The center sticker, at index 4, never moves, so it identifies the face. A turn is array manipulation in two parts: the turning face's own stickers rotate (the corners at 0, 2, 8, and 6 trade places, and so do the edges at 1, 5, 7, and 3), and a strip of three stickers moves around each of the four neighboring faces.

Every turn also adds its name in standard cube notation (U, D, R, L, F, or B, with a prime mark for counterclockwise) to a string, so the program records the whole solution as it goes. The scramble is 20 random turns.

## A lot of if statements

In terms of code, the program is actually very simple. For each stage, a long series of if statements looks at where the pieces are and picks the moves that fix them, the same way the beginner method tells a person "if the piece is here, do this sequence." I used object-oriented programming, with everything in one `Cube` class and a function for each stage and each named sequence, to make the code more readable, although a single if statement can still be hard to follow without a cube in your hand.

## Benchmarking

Besides the SFML version, the repository has a text-only version for benchmarking, which scrambles and solves as many cubes as you ask for and times them. Rebuilt and run for this write-up, it did 100,000 solves in 2.2 seconds, about 21 microseconds per cube, or roughly 46,000 cubes per second. The solutions are long, averaging 242 moves, because the beginner method trades efficiency for steps a person can remember.

## What I would change

The benchmark is supposed to catch a solve that went wrong: after each one, it checks whether the cube is solved and stops if it is not. But that check, `isCubeSolved`, compares only the first six of each face's nine stickers, so it never looks at the bottom row, and the last stage uses the same check to decide when it is finished. Checking all 54 stickers across 100,000 solves for this write-up showed that about 7% of them ended with the last layer unfinished while the program reported the cube as solved. Checking all nine stickers is a one-character fix, and then the last stage needs work until the full check passes every time.

After that, the next step is the one I started with: turning the solver into a program that teaches, walking someone through each stage on their own cube.
