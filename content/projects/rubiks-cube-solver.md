This is a Rubik's Cube solver written in C++, using SFML for the graphics library, that scrambles a cube and then solves it again with a visual display of the cube's state as it works. It is the strongest algorithms-and-systems piece in this portfolio for the backend roles I am targeting, since it is C++ and search rather than a scripting-language utility.

> **TODO: why I built this.** Ryker writes this one. It is the field that separates this
> site from every other student portfolio, so it is not auto-generated.

## The engineering detail

TODO: the specific solving approach (which search or layer method the solver uses, and how cube state is represented internally) is the detail a hiring engineer would ask about first, and it is not something this build has a verified answer for. Ryker fills in the actual algorithm here rather than have this page guess at it.

## The visual display

Rendering the cube's state with SFML as it scrambles and solves means keeping the graphics in sync with whatever internal representation of the cube the solver uses on every move, which is its own small correctness problem separate from the solving algorithm itself.
