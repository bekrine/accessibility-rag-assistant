import os

import chromadb
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from huggingface_hub import InferenceClient
from fastapi.middleware.cors import CORSMiddleware
from rag_ingestion import refresh_knowledge_base

# Load environment variables
load_dotenv()


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Embedding model
# -----------------------------

model = SentenceTransformer(
    "all-MiniLM-L6-v2"
)


# -----------------------------
# ChromaDB
# -----------------------------

client = chromadb.PersistentClient(
    path="./chroma_db"
)


def get_collection():
    return client.get_collection(
        name="nexus_knowledge"
    )

# Chroma L2 distance cutoff for "is this actually relevant" filtering on
# unfiltered semantic search. Calibrated against this embedding model
# (all-MiniLM-L6-v2): genuinely relevant matches land around 1.5, unrelated
# queries land around 1.8+ - a bare "1.0" (unvalidated guess in the original
# code) rejected even perfect topical matches.
RELEVANCE_DISTANCE_THRESHOLD = 1.6

# -----------------------------
# Hugging Face
# -----------------------------

hf_client = InferenceClient(
    api_key=os.getenv("HF_API_KEY")
)

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")


def require_internal_key(x_internal_api_key: str = Header(default=None)):
    if not INTERNAL_API_KEY or x_internal_api_key != INTERNAL_API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid internal API key",
        )


# -----------------------------
# Request models
# -----------------------------

class SearchRequest(BaseModel):
    query: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    severity: str | None = None
    status: str | None = None
    issueId: str | None = None


class CountRequest(BaseModel):
    topic: str
    severity: str | None = None
    status: str | None = None
    issueId: str | None = None


class DeleteIssuesRequest(BaseModel):
    issueIds: list[str]


class Issue(BaseModel):
    id: str
    title: str
    wcag: str
    severity: str
    status: str
    page: str
    url: str
    description: str
    remediation: str
# -----------------------------
# Health check
# -----------------------------

@app.get("/health")
def health():

    return {
        "message": "RAG service is running"
    }

# -----------------------------
# Sync knowledge base
# -----------------------------

@app.post("/sync", dependencies=[Depends(require_internal_key)])
def sync():

    result = refresh_knowledge_base()

    return {
        "message": "Knowledge base synchronized",
        **result,
    }

# -----------------------------
# Search
# -----------------------------

@app.post("/search")
def search(request: SearchRequest):

    query_embedding = model.encode(
        request.query
    ).tolist()

    collection = get_collection()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=3,
    )

    return {
        "documents": results["documents"][0],
        "metadatas": results["metadatas"][0],
    }


# -----------------------------
# build filter from explicit intent fields
# -----------------------------
def build_filter(severity: str | None, status: str | None, issue_id: str | None):

    conditions = []

    if severity:
        conditions.append({"severity": severity})

    if status:
        conditions.append({"status": status})

    if issue_id:
        conditions.append({"issue_id": issue_id.upper()})

    if len(conditions) == 0:
        return None

    if len(conditions) == 1:
        return conditions[0]

    return {
        "$and": conditions
    }
# -----------------------------
# Chat
# -----------------------------

@app.post("/chat")
def chat(request: ChatRequest):

    # --------------------------------
    # 1. Convert question to embedding
    # --------------------------------

    query_embedding = model.encode(
        request.message
    ).tolist()


    # --------------------------------
    # 2. Build structured filter from the caller's already-extracted intent
    # --------------------------------

    where_filter = build_filter(
        request.severity,
        request.status,
        request.issueId,
    )


    # --------------------------------
    # 3. Prepare ChromaDB query
    # --------------------------------

    # A structured filter already narrows the candidate pool (by severity,
    # status, or issue id), so it's safe and useful to return more matches
    # in that case instead of capping at 5 like an open-ended semantic search.
    query_options = {
        "query_embeddings": [query_embedding],
        "n_results": 25 if where_filter else 5,
    }


    if where_filter:

        query_options["where"] = where_filter


    # --------------------------------
    # 4. Search ChromaDB
    # --------------------------------
    collection = get_collection()
    results = collection.query(
        **query_options
    )


    # --------------------------------
    # 5. Get retrieved data
    # --------------------------------

    documents = results["documents"][0]

    metadatas = results["metadatas"][0]

    distances = results["distances"][0]


    # --------------------------------
    # 6. Filter semantic results
    # --------------------------------

    if not where_filter:

        filtered_results = [
            (document, metadata, distance)

            for document, metadata, distance in zip(
                documents,
                metadatas,
                distances,
            )

            if distance <= RELEVANCE_DISTANCE_THRESHOLD
        ]

        documents = [
            item[0]
            for item in filtered_results
        ]

        metadatas = [
            item[1]
            for item in filtered_results
        ]

        distances = [
            item[2]
            for item in filtered_results
        ]


    # --------------------------------
    # 7. No relevant information
    # --------------------------------

    if not documents:

        return {
            "answer": (
                "I couldn't find sufficiently relevant "
                "information in the knowledge base."
            ),
            "sources": [],
        }


    # --------------------------------
    # 8. Build sources
    # --------------------------------

    sources = []

    for metadata in metadatas:

        sources.append({
            "issue_id": metadata.get("issue_id"),
            "title": metadata.get("title"),
            "wcag": metadata.get("wcag"),
            "severity": metadata.get("severity"),
            "status": metadata.get("status"),
            "page": metadata.get("page"),
            "url": metadata.get("url"),
        })


    # --------------------------------
    # 9. Combine documents into context
    # --------------------------------

    context = "\n\n".join(
        documents
    )


    # --------------------------------
    # 10. Convert conversation history
    # --------------------------------

    conversation = "\n".join(
        f"{message.role}: {message.content}"
        for message in request.history
    )


    # --------------------------------
    # 11. Create LLM prompt
    # --------------------------------

    prompt = f"""
You are an accessibility assistant.

You are having a conversation with the user.

Use the conversation history to understand
references such as "it", "this issue", "that button",
or "the previous problem".

Use the retrieved knowledge base information
to answer the user's question.

CONVERSATION HISTORY:
{conversation}

RETRIEVED KNOWLEDGE:
{context}

CURRENT USER QUESTION:
{request.message}

IMPORTANT RULES:

1. Use the retrieved knowledge when answering
application-specific questions.

2. Use conversation history to understand context.

3. Do not invent application-specific information.

4. If the answer is not available in the knowledge
base, clearly say that the information is not
available in the knowledge base.

5. You may explain general accessibility concepts
when useful, but do not present them as facts
about the application unless they are present
in the retrieved knowledge.
"""


    # --------------------------------
    # 12. Ask Hugging Face
    # --------------------------------

    response = hf_client.chat.completions.create(

        model="openai/gpt-oss-120b",

        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],

        max_tokens=1500,
    )


    # --------------------------------
    # 13. Get generated answer
    # --------------------------------

    answer = response.choices[0].message.content


    # --------------------------------
    # 14. Return answer + sources
    # --------------------------------

    return {
        "answer": answer,
        "sources": sources,
    }


# -----------------------------
# Topic-aware count
# -----------------------------

@app.post("/count")
def count(request: CountRequest):

    # 1. Embed the topic

    query_embedding = model.encode(
        request.topic
    ).tolist()


    # 2. Build a structured filter, same as /chat

    where_filter = build_filter(
        request.severity,
        request.status,
        request.issueId,
    )


    # 3. Query the full collection so we can count every match,
    #    not just a top-k window like /chat uses

    collection = get_collection()

    query_options = {
        "query_embeddings": [query_embedding],
        "n_results": max(collection.count(), 1),
    }

    if where_filter:
        query_options["where"] = where_filter

    results = collection.query(
        **query_options
    )

    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]


    # 4. Without a structured filter, only count matches that are
    #    actually relevant to the topic (same threshold /chat uses)

    if where_filter:
        matches = list(metadatas)
    else:
        matches = [
            metadata
            for metadata, distance in zip(metadatas, distances)
            if distance <= RELEVANCE_DISTANCE_THRESHOLD
        ]


    # 5. A few example sources for the answer to cite

    sources = []

    for metadata in matches[:5]:
        sources.append({
            "issue_id": metadata.get("issue_id"),
            "title": metadata.get("title"),
            "wcag": metadata.get("wcag"),
            "severity": metadata.get("severity"),
            "status": metadata.get("status"),
            "page": metadata.get("page"),
            "url": metadata.get("url"),
        })

    return {
        "count": len(matches),
        "sources": sources,
    }


@app.post("/sync/issue", dependencies=[Depends(require_internal_key)])
async def sync_issue(issue: Issue):
    try:
        # Build the text that will be embedded
        document = f"""
        Issue ID: {issue.id}
        Title: {issue.title}
        WCAG: {issue.wcag}
        Severity: {issue.severity}
        Status: {issue.status}
        Page: {issue.page}
        URL: {issue.url}
        Description: {issue.description}
        Remediation: {issue.remediation}
        """

        # Generate embedding
        embedding = model.encode(document).tolist()

        # Get a fresh collection
        collection = get_collection()

        # Upsert the issue
        collection.upsert(
            ids=[issue.id],
            documents=[document],
            embeddings=[embedding],
            metadatas=[{
                "type": "issue",
                "issue_id": issue.id,
                "title": issue.title,
                "wcag": issue.wcag,
                "severity": issue.severity,
                "status": issue.status,
                "page": issue.page,
                "url": issue.url
            }]
        )

        return {
            "success": True,
            "message": f"Issue {issue.id} synchronized successfully"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@app.post("/sync/issues/delete", dependencies=[Depends(require_internal_key)])
def delete_issues(request: DeleteIssuesRequest):
    if not request.issueIds:
        return {"success": True, "deleted": 0}

    try:
        collection = get_collection()
        collection.delete(ids=request.issueIds)

        return {
            "success": True,
            "deleted": len(request.issueIds),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )