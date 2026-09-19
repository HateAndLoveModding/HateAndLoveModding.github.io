Qwixx is a dice game played with a paper scoresheet, and this is an interactive digital version of that scoresheet, written in Python with Tkinter for the desktop GUI. It handles the game's scoring rules (marking numbers across four colored rows, penalties for skipped turns, the running total) so players do not have to do that bookkeeping by hand.

> **TODO: why I built this.** Ryker writes this one. It is the field that separates this
> site from every other student portfolio, so it is not auto-generated.

## The engineering detail

Qwixx's scoring is deceptively fiddly: each row can only be marked left to right, locking a row early is a deliberate tradeoff, and the point total per row is nonlinear in how many numbers are marked. Encoding those rules correctly in a Tkinter GUI is the actual work behind what looks like a simple scoresheet.

TODO: how much of the rule enforcement (legal-move checking versus trusting the player) is actually built into the GUI is a specific implementation detail Ryker should confirm here rather than have this page assume.
