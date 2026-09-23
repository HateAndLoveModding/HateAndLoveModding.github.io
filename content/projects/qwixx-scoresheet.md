Qwixx is a dice game my family loves to play together, and during one of our games I had an idea for a variation that would extend the gameplay. To try it, I built an interactive scoresheet in Python with Tkinter, the graphical user interface (GUI) library that ships with Python. Every player gets their own clickable, color-coded card, and the program rolls the dice, highlights the numbers you can cross off, and adds up the scores at the end.

## The game, and my variations

In Qwixx, each player's card has four colored rows: red and yellow run from 2 to 12, and green and blue run from 12 down to 2. Each turn someone rolls six dice, two white and one each of red, yellow, green, and blue, and players cross off numbers that match the dice sums, always moving left to right along a row. Crossing off the last number in a row, once it has at least five crosses, locks it, and every row scores more the more crosses it has, while each penalty box costs 5 points.

![A normal Qwixx card in the scoresheet: red and yellow rows run 2 to 12, green and blue run 12 to 2, and the squares matching the last roll are outlined in black](content/media/Qwixx_Normal.png)

*The normal card after a roll. The outlined squares are the ones the dice allow.*

My variations shuffle the card. Besides the normal game there are eight of them, and they come in two kinds: a "hodgepodge" shuffles the card but keeps some structure, and a "pandemonium" shuffles everything across the whole card.

- **Hodgepodge of Numbers.** Each row keeps its color and still has 2 through 12 once each, in a random order.
- **Pandemonium of Numbers.** All 44 numbers on the card, four of each, are shuffled across every row, so a row can have the same number twice and be missing another.
- **Hodgepodge of Colors, versions 1 to 3.** The numbers stay in their normal order and the colors move. In version 1, every number still appears once in each color. In version 2, every column holds one square of each color. In version 3, the two rows that count up share two randomly chosen colors and the two rows that count down share the other two, mixed square by square.
- **Pandemonium of Colors.** The numbers stay in order and all 44 colored squares are shuffled across the card.
- **Hodgepodge of Numbers and Colors.** Every row has 2 through 12 once each in a random order, and every number appears once in each color.
- **Pandemonium of Numbers and Colors.** The numbers and the colors are both shuffled across the whole card, independently of each other.

![A Hodgepodge of Numbers card: each row is a single color, with the numbers 2 to 12 in a random order](content/media/Hodgepodge_of_Numbers.png)

*Hodgepodge of Numbers: each row keeps its color, and its numbers are shuffled.*

![A Pandemonium of Colors card: the numbers are in their normal order, but the four colors are scattered across the whole card](content/media/Pandemonium_of_Colors.png)

*Pandemonium of Colors: the numbers stay in order, and the colors land anywhere.*

![A Hodgepodge of Numbers and Colors card: every row has 2 to 12 in a random order, and the colors are mixed within each row](content/media/Hodgepodge_of_Numbers_and_Colors.png)

*Hodgepodge of Numbers and Colors: every row still has 2 through 12, and every number appears once in each color.*

The number shuffles change the game the most. In a normal row, the last number is 12 or 2, the hardest sums to roll with two dice, so locking a row is hard. When the numbers are shuffled, those hard numbers are spread out across the card instead of all sitting at the ends, which makes it easier to lock a color, and that means more points.

## How it is built

The code is organized around two classes. `Player` holds a player's name, the frame (the section of the window) their card lives in, their buttons, and their move history. `QwixxGame` builds the window and runs the game.

Every mode, from normal to pandemonium, produces the same thing: two lists of 44 entries, one of colors and one of numbers, read left to right and top to bottom across the card. A single loop then builds every player's card from those two lists, so adding a mode only means writing a new way to fill them. Each card also gets a Lock button at the end of each row, four gray penalty boxes, and an Undo button.

Each button is stored in a dictionary (a lookup table from names to values) under two keys. One is its position, such as `3_3` for the fourth row and fourth column, which the game rules use. The other is its color and number, such as `blue_5`, which the dice use. Once the colors can land anywhere, a blue 5 is no longer always in the same spot, so after a roll the program looks up each sum by color instead of by row. The two white dice together count in every color, and each white die paired with a colored die counts only on squares of that color. The program outlines every matching square that has not been crossed off yet, so nobody has to do the arithmetic. After each roll, a thick black border also moves to the active player, the one whose roll it is.

Clicking a number marks it with an X and disables every number to its left in that row, since Qwixx only lets you move to the right. With several people clicking on one screen, mistakes happen, so every move goes onto the player's history, and Undo reverses the last one and re-enables the buttons it disabled. Undo Roll does the same for the dice.

Every card is written to a file, `qwixx.txt`, and when the program starts it asks whether to load the last saved board, so a card you liked can be played again. When the game ends, the program counts the Xs in each row, where n crosses are worth n(n+1)/2 points (1, 3, 6, 10, and so on), subtracts 5 for each penalty, and shows everyone's score.

![A finished three-player game of Hodgepodge of Numbers and Colors, with most squares crossed off, a thick black border around the active player's card, and the final scores along the bottom](content/media/Hodgepodge_of_Numbers_and_Colors_Real_Game.png)

*A finished three-player game of Hodgepodge of Numbers and Colors, with the final scores along the bottom.*

## Linux and Windows

The repository has two versions, `qwixx_linux.py` and `qwixx_windows.py`, because I added a feature that saves a picture of the finished game. On Linux it takes the picture with `gnome-screenshot`, since Debian with GNOME is my main operating system. I have not kept the Windows version up to date, so it is an older version of the game. The Linux version runs on Windows too, except that clicking End throws an error when it tries to call `gnome-screenshot`.

## What I would change

The number of players, whether to load the last board, the mode, and each player's name are all typed into the terminal before the window opens, so the game is only half a GUI; those should be on a start screen in the window itself. The saved board is also read back from `qwixx.txt` with `eval`, which runs the file's contents as Python code, when a data format such as JSON would do the same job safely.
