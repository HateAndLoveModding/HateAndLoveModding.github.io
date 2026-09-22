Over the past few months I have used AI to code in four very different ways: as the driver on a client project, as a planner on a personal one, as a tutor in a class, and as a team of agents building this website. Here is what each one taught me, and how I plan to use AI from here.

## Qualcomm: letting Claude drive

This summer, three other Mines students and I built a data analytics chatbot for Qualcomm, and I built its retrieval pipeline ([the project write-up](project.html?slug=qualcomm-rag-pipeline) covers how it works). Qualcomm gave us access to Claude and encouraged us to use it. It was my first time with a paid AI tool, and nearly every tool, framework, and service on the project was new to me.

I did not start with Claude, though. I had never built a RAG system, so I learned from a tutorial series first, built a barebones version that worked, and refactored it until I understood every piece.

After that, I let Claude take over more and more. It wrote all of the pipeline's tests, 30 at first and 30 more near the end of the session. When I asked it how to improve retrieval, its suggestions for the algorithm were only somewhat useful, though having it write better descriptions of our data did raise our similarity scores. I stopped following the tutorial series and started asking Claude what to do next instead.

HyDE, a technique that searches with a hypothetical answer instead of the question, was different. I went back to the series to read about ways to improve RAG systems, and one morning I woke up at 4 a.m., thought it over, and decided to try HyDE, because I understood why it would work and it did not look hard to build. Claude helped me implement it, and it raised our scores again.

By the end, I did not fully understand the final code, and I had let Claude do some things I did not want. I had let it carry me part of the way instead of staying in control.

## My own RAG: trusting the plan

After Field Session I started building my own RAG system and tried to use AI more responsibly. I described the features I wanted to Cursor, an AI code editor, and had it plan the project structure and functions. Then I built it myself, working from the libraries' documentation and asking Cursor only narrow questions when I got stuck.

My mistake was accepting the plan without critiquing it. It spread the code across many ten-line files, each holding one or two short functions that added little, so following any piece of logic meant jumping between files. Three to five files, with functions combined unless they were called from more than one place, would have been much easier to read. I did the building, but I had handed off the design without checking it.

## OCaml: Claude as a teaching assistant

This semester I am taking Programming Languages, where we are learning OCaml, and I want to actually understand it. Our first lab was a set of simple recursive functions, and I asked Claude to act as a teaching assistant: explain concepts and ask questions that lead me to the answer, but never hand me the solution.

One function returned the nth element of a list. Once it worked, I spent much longer writing a second function to test it. That was not part of the assignment, and it turned out to be the hardest part of the lab, but it taught me things I would not have learned otherwise, like working with tuples, unpacking several values in one pattern, and catching exceptions with `try ... with`.

It was not quite test-driven development, which writes the tests before the code, since I wrote my test function after the function it tests. But I wrote down every edge case I could think of first, so my tests were close to complete from the first run: an empty list, a single element, the first, middle, and last positions, zero, negative positions, and positions past the end. Claude's questions then pointed me to what I had missed, such as lists with repeated values, and a test that is supposed to fail, which proves the test function can catch a bug at all. By the end I understood every line, and I was completely confident the function was correct.

You can read [the full conversation](post.html?slug=ocaml-conversation) to see how Claude guided me without ever handing me the solution.

## This website: planning first, then agents

For the first project in my Coding with AI Agents class, I am building this website and hosting it on GitHub Pages. This time I spent two hours defining every feature before any code was written. I pushed back on the plan Claude proposed and had it ask me clarifying questions until nothing was left unclear.

With a plan that thorough, I set up an orchestrator agent to direct sub-agents that built the site, and made sure it also spawned code review agents to check their work. I started it before leaving for work, and when I got home the site was fully built, without the agents having needed to ask me a single question. I then reviewed everything and had Claude fix the few issues and details I did not like. It was the first time I let agents build a whole project, and I was very happy with the result.

## Where I have landed

Looking back, the difference between these four projects was never how much code the AI wrote. What mattered was whether I stayed in control of the understanding and the design.

For anything fundamental, anything that will make me a better software engineer, I will use AI as a teaching assistant, as I did with OCaml. For work that is not fundamental, or that I am unlikely to need again, I will use agents, but only after a long planning session and with code reviewers checking the output, as I did with this website. Either way, I will learn what I need to and not let AI carry me: it will be either a senior engineer guiding me or an expert developer building from my plan.

This will change, because AI is moving so fast that my workflow six months from now may look nothing like this one. Next I want to learn more about AI's limits and how to raise the quality of its output, and to explore what fully embracing it looks like: not reviewing the code myself at all, but building the frameworks, like tests and review agents, that make its output trustworthy.
