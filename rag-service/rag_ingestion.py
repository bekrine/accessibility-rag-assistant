import chromadb
import os
import requests
from sentence_transformers import SentenceTransformer

# --------------------------------
# Configuration
# --------------------------------

BACKEND_URL = os.getenv(
    "BACKEND_URL",
    "http://localhost:5000"
)


# --------------------------------
# Embedding model
# --------------------------------

model = SentenceTransformer(
    "all-MiniLM-L6-v2"
)


# --------------------------------
# ChromaDB
# --------------------------------

client = chromadb.PersistentClient(
    path="./chroma_db"
)


# --------------------------------
# Refresh knowledge base
# --------------------------------

def refresh_knowledge_base():

    # Get latest issues from backend

    response = requests.get(
        f"{BACKEND_URL}/api/issues"
    )

    response.raise_for_status()

    issues = response.json()

    print(
        f"Retrieved {len(issues)} issues from backend."
    )


    # Delete old collection

    try:

        client.delete_collection(
            name="nexus_knowledge"
        )

    except Exception:

        pass


    # Create fresh collection

    collection = client.get_or_create_collection(
        name="nexus_knowledge"
    )


    # --------------------------------
    # Convert issues to documents
    # --------------------------------

    documents = []

    for issue in issues:

        document = f"""
Issue ID: {issue["id"]}

Title:
{issue["title"]}

WCAG:
{issue["wcag"]}

Severity:
{issue["severity"]}

Status:
{issue["status"]}

Page:
{issue["page"]}

URL:
{issue["url"]}

Description:
{issue["description"]}

Remediation:
{issue["remediation"]}
"""

        documents.append(document)


    # --------------------------------
    # Generate embeddings
    # --------------------------------

    embeddings = model.encode(
        documents
    ).tolist()


    # --------------------------------
    # Store in ChromaDB
    # --------------------------------

    collection.upsert(

        ids=[
            issue["id"]
            for issue in issues
        ],

        documents=documents,

        embeddings=embeddings,

        metadatas=[
            {
                "issue_id": issue["id"],
                "title": issue["title"],
                "wcag": issue["wcag"],
                "severity": issue["severity"],
                "status": issue["status"],
                "page": issue["page"],
                "url": issue["url"],
            }

            for issue in issues
        ],
    )


    print(
        "Knowledge base successfully updated."
    )

    print(
        f"Total documents: {collection.count()}"
    )


    return {
        "issues": len(issues),
        "documents": collection.count(),
    }