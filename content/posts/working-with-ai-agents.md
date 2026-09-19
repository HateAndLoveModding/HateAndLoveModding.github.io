I am writing this partway through CSCI 498E, Coding with AI Agents, at Colorado School of Mines, and the habit the course keeps coming back to is the same one: never trust an agent result you have not given yourself a way to check. That sentence is the whole course in miniature, and this site is a working example of it rather than just a claim about it.

## Branches and PRs are not process for its own sake

The class works from a seven-rule working agreement for driving git with an agent, and the two rules that changed how I work the most are branch per task and the pull request as the unit of review. Being wrong on a branch costs nothing, so I can ask an agent for a bold change and actually mean "let's see", because the worst case is deleting a branch instead of explaining a broken `main`. And a PR packaging one branch with a description is not busywork: it is where I, or an agent reading the history later, goes to remember why a change happened. This site itself was built that way: `main` had a working "Hello, world" live on GitHub Pages before any rebuild work started, and everything since has happened on a feature branch merged through a pull request, so the live site never broke while the rebuild was in progress.

## Checking is the part that stays yours

An agent will tell you it deployed successfully. That claim is worth nothing until you look at the live URL yourself. Building this site made that concrete in small, unglamorous ways: a relative stylesheet path that works on `localhost` and 404s on GitHub Pages is, according to this course's own project brief, the most common way a site like this breaks, and the only way to catch it is to actually check the deployed URL, not just trust that the build succeeded. The same habit shows up at a smaller scale everywhere: does the JSON actually parse, does the link actually return a 200 and not a 404, does the phone number that is not supposed to be in this repo actually not appear anywhere in it. None of those are things an agent's summary of its own work can tell you; they are things you check.

## Splitting work by scope, not by vibes

The other concrete lesson, also drawn straight from this site's own build, is that an agent works best on a task when its file scope is explicit and narrow. This content layer, the project and post writing and the Markdown renderer, was built as its own scoped task, separate from the CSS and separate from the HTML pages, with an instruction not to touch either. That is not a limitation so much as the same idea as branch per task applied inside a single build: a narrow, explicit scope is what makes the result reviewable, because you know exactly what should have changed and can check that nothing else did.

## What I would tell someone starting the course

Read the diff, not the summary. Commit at checkpoints so your undo tool has something small to aim at. And when the agent says something works, that is the beginning of the conversation, not the end of it: go look.
