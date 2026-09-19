During a Mines Field Session at Qualcomm, I worked as an AI Engineering Consultant building a retrieval-augmented generation, or RAG, pipeline for an analytics chatbot. The stack was Python, LangChain, and Qdrant as the vector store, and the work was done as part of a cross-functional team rather than solo. This is a write-up only: the work is Qualcomm's employer IP, so there is no source and no repo link here, stated plainly rather than apologized for.

<div class="todo">TODO: why I built this. Ryker writes this one. It is the field that separates this site from every other student portfolio, so it is not auto-generated.</div>

## The chunking work and the number that matters

The concrete result I can point to is retrieval relevance: optimizing how documents were chunked before embedding raised the average retrieval relevance from 0.74 to 0.86. That is the number a hiring engineer should ask about, because chunking strategy (how you split source documents before they go into the vector store) is one of the highest-leverage, least-glamorous levers in a RAG system, and it is easy to get wrong in ways that only show up as bad answers later.

## Integration and presentation

The pipeline was integrated with Model Context Protocol (MCP) servers and containerized tools, which was the part of the work that touched reliable data ingestion rather than just retrieval quality. I also presented the RAG architecture and evaluation results to Qualcomm stakeholders directly and incorporated their feedback to refine retrieval, improve factual accuracy, and reduce hallucination risk in the chatbot's responses, so the evaluation loop was not just a metric on a slide, it changed what shipped.
