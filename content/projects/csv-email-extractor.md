Several times every year, my dad spent hours searching through a CSV file (a spreadsheet saved as plain text, with commas between the columns) and copying out the email address of everyone he wanted to send a holiday card or an open house invite. When I realized how long it was taking him, I thought about it for a minute and said, "I can make a Python program to do that for you." So I did. It runs in about 30 seconds, and a job that took several hours now takes a few minutes.

## How it works

There are two scripts, one for each list, and each is under twenty lines. Each one opens the file with Python's built-in `csv` module and goes through it row by row. If any cell in a row contains "Holiday Card" (or "Open House" in the other script), it takes the email address from that row and adds it to the list, followed by a semicolon. At the end it writes the whole list to `emails.txt`, replacing the last run's list, and my dad copies it straight into an email.

The repository holds only the two scripts, not the data.

## Small on purpose

This is the simplest program on this site, and that was the right size for the problem. It assumes a file named `data.CSV` and reads the email from a fixed column, which works because his export has the same layout every time. It did not need a GUI or a configuration file; it needed to save my dad several hours a few times a year, and it does.

## What I would change

The fixed column is the fragile part. The script reads the email from column 58 by position, so if the export ever adds or reorders a column, it will quietly collect the wrong field. Python's `csv.DictReader` can find the column by its header name instead, which would survive a change in layout. The two scripts are also copies of each other that differ only in the phrase they search for, so they could be one script that takes the phrase as input. And the Open House script has the start of a feature, commented out, that would skip anyone already on an older list; finishing it would save my dad from sending the same person two invitations.
