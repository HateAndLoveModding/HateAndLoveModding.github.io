In the summer of 2026, three other Mines students and I spent five weeks building a data analytics chatbot for Qualcomm as our Computer Science Field Session (Advanced Software Engineering). I built the ingestion and retrieval layer of its retrieval-augmented generation (RAG) pipeline, which finds the data relevant to a user's question for the language model to answer from. By optimizing chunk size, converting plain text to Markdown, using Claude to generate richer table and column descriptions, and implementing HyDE (Hypothetical Document Embeddings), I raised the average cosine similarity score of retrieved data from 0.74 to 0.86.

## Architecture before code

We spent the first week getting access to Qualcomm's virtual machines and sketching the system architecture. In the second week we documented each major component and its protocol, split the components among the four of us, and presented the design to our client. He gave us feedback, and another senior engineer at Qualcomm approved the architecture. We started coding at the end of that week and had a working demo by the next client meeting.

Getting the chatbot to answer was the easy part. Making its answers relevant and factual took the rest of the session, and my part of that was retrieval.

## Building the first version

I had never built a RAG system, so before bringing in Claude I followed a tutorial series recorded by a software engineer at LangChain, the framework we used, and built a barebones pipeline from its first few videos. Watching the retrieval step return the right data for the first time was a thrill. I refactored that code until I understood every piece of it, then ingested our databases and watched the whole pipeline run.

## Chunk size is a balancing act

A RAG system splits its data into chunks and converts each one into an embedding, a long list of numbers (a vector) that represents the chunk's meaning. When a question comes in, the system embeds it the same way and returns the chunks whose embeddings are closest to it. Every embedding has the same number of dimensions no matter how much text went into it, so the more a chunk covers, the more its meanings get blended together, and the less strongly it matches a question about any one thing in it. Small chunks match precisely, but they often leave out the context the model needs to actually answer.

Song lyrics make the tradeoff easy to see. Say you remember a line from the chorus and want the words to the second verse. If every line is its own chunk, retrieval returns exactly the line you already knew. Storing the song, artist, and line number with each chunk helps only a little on its own: you learn which song it is, but you still do not have the verse. Larger chunks are harder to match, so a vague memory of the chorus may not find the right one, but when the right chunk does come back it is much more likely to contain the verse you wanted. Even when it does not, its contents give you a better query for a second search.

For the Qualcomm data, I kept each table's information in a single chunk unless it passed a size threshold, and only then split it.

## What raised the scores

Four changes together moved the average cosine similarity score from 0.74 to 0.86:

- **Tuning chunk size**, along the lines above.
- **Converting plain text to Markdown.** Language models handle Markdown's structure well, and its headers are a natural place to record where each piece of data came from. In the lyrics example, the first header would be the artist and the second the song, and during ingestion those headers get attached to every chunk beneath them.
- **Better data descriptions.** I had Claude write richer table and column descriptions, which gave the embeddings more meaning to match against and noticeably raised the scores.
- **HyDE (Hypothetical Document Embeddings).** Instead of searching with the user's question, the model first writes a hypothetical answer, and the pipeline searches with that. An answer looks much more like the stored data than a question does, so it lands closer to the right chunks. The hypothetical answer can get details wrong, which is fine: it is only used for the search, and the chatbot still answers from the real chunks it retrieves. I found HyDE in the tutorial series and chose it because I understood why it would work and it did not look hard to build; Claude helped me implement it.

## How I measured it, and what I would change

I measured progress with the cosine similarity score between each search and the chunks it returned, and by the end there were 60 retrieval tests, which Claude wrote.

Similarity is only a proxy, though. A high score says the retrieved chunks sit close to the search, not that they are the right chunks, and HyDE raises the score partly just by making the search text look more like the stored data. Next time I would start with mean reciprocal rank (MRR), which I learned about near the end of the session.

For each test question, you decide in advance which piece of data should come back, then check where it ranks in the results. A question scores 1 if the right chunk comes first, 1/2 if it comes second, 1/3 if third, and 0 if it does not come back at all, and MRR is the average of those scores across all the questions. Rank matters because a right chunk further down makes the model dig for the answer, and a missing one means the model either cannot answer or makes something up.

MRR can also hint at which way to move the chunk size. A poor MRR can mean chunks are too large to match precisely, while a good MRR with weak answers can mean the right chunk is being found but is too small to hold the context the model needs. Claude generated a handful of MRR test cases near the end, and they looked good, but there were too few to give numbers I would stand behind.

## The rest of the system

One teammate built the agent that uses the retrieved data to generate the chatbot's answers. Another did most of the work of integrating the pipeline with Model Context Protocol (MCP) servers, a standard way to give a language model access to tools and data. The third integrated the pipeline with FastAPI, containerized each component, and set them up to run together with Docker Compose. That work mattered as much as mine: retrieval quality means nothing if the data does not reach the pipeline reliably, or if the agent cannot turn what I retrieve into a good answer.

For the other side of this project, how I used Claude to build it and what I would do differently, see [How I Code With AI](post.html?slug=how-i-code-with-ai).
