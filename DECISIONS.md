# Decision log

Your methods section. About one page total.

Answer these as you go, not the night before it is due.
Specifics beat polish - a short honest answer is worth more than a long vague one.

Delete these instructions when you are done, or leave them. It does not matter.

---

## 1. What did you set out to build, and what changed?

What you wanted at the start, and what is actually live now.
Name one thing you dropped or added along the way, and why.

*I wanted a unique site that looks clean and that people will remember. Everything I had imagined came to fruition. The main unique part that I wanted was an actual terminal where you can type commands and get all the same information that the interactive website has. The terminal acts exactly like I would expect it to. For example there is tab completion, messages that get printed whenever you enter a session, debug messages that get printed the first time you enter the terminal, commands where if you don't provide an argument, it prints out valid arguments, and it also prints error messages. Though I also really wanted an interactive per se normal website so that everyone can navigate it. 99.9% of people will not actually use the terminal, but people may remember the website as "The nerdy, computer science, terminal website." For the very few also nerdy computer people, they may enjoy the terminal but I want to make sure the website is accessible to everyone and I succeeded with that. There are obvious project or blog posts, tabs in the header, and a light mode. I added picture support at the end. Originally I wasn't thinking I would have support for pictures but I really wanted it to show the Qwixx scoresheet project. Pictures convey information that words cannot sometimes and that is why I added it.*

---

## 2. A fork in the road

Name one real choice where you could have gone two ways.
Plain HTML or a framework. One page or several. Your own CSS or someone's template.
What goes on the front page and what does not.

Say which you picked, what the alternative was, and what you gave up by not taking it.

"There was no alternative" is not an answer. Find the fork.

*It asked me if I wanted to fork my portfolio website that I built last year. I genuinely considered it because I wanted to essentially just make an updated portfolio website. A lot of the same content would be in both but I decided not to because Claude can directly query that old website in order to create the content for this website. Also I anticipated the html and css being very different which it might confuse Claude. That is why I decided to start from scratch and just give Claude context to build the website content. Choosing to start from scratch meant losing something that I had made myself. But that allows me to modify that website myself and keep it as something I have fully built myself without AI.*

---

## 3. Where you overruled the agent

One time Claude suggested, wrote, or claimed something and you did not take it.

What did it do? How did you notice? What did you do instead?

If it genuinely never happened, say so plainly, and then say what you would have had to
check in order to notice. Being honest here costs you far less than a story you cannot
defend when you record your video.

*In the plan I told Claude to create the templates in the plan, but after reading the content, I scrapped them. I didn't like it because I already had stuff in my mind about what I wanted to talk about. So I just wrote a rough draft with practically no formatting and had Claude then add formatting and revise it to make it sound better.*

---

## 4. How you know it works

What check did you run, and what did it tell you?

Then the real question: **what would have made this check fail?**
A check that could not have failed is not a check.

Link to your `verification/` folder.

*I had a check to make sure the website was showing what I thought it should be. I had Claude run the check before merging into main so that I knew what was there before and what was there after to make sure everything was working as intended. Output before merge: verification/fetch-before-merge.txt. It told me the pages website had deployed with the updated code and that links to the css files and the resume were working. verification/fetch.txt The screenshot shows that it is working. Running the check before the site was actually deployed would have meant a 404 to resume.md.*

---

## 5. What is still wrong

One thing on your own site that is not right, not finished, or that you do not
fully understand.

What would you do next, and how would you find out?

*One thing that I want to tweak is adding a little more color, specifically for the terminal. To make it more obvious where the commands are and what is output. One thing that I don't fully understand is how it handles showing the media. Since that is the last thing I implemented, I was not able to spend time understanding the code.*
