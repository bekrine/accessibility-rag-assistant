import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

function severityClass(severity) {
  switch ((severity || "").toLowerCase()) {
    case "high":
      return "severity-high";
    case "medium":
      return "severity-medium";
    case "low":
      return "severity-low";
    default:
      return "";
  }
}

function SourceCard({ source }) {
  return (
    <div className={`source-card ${severityClass(source.severity)}`}>
      <div className="source-title">
        <span>{source.title}</span>
        <span className="source-id">{source.issue_id}</span>
      </div>
      <div className="source-meta">
        {source.wcag && <span>{source.wcag}</span>}
        {source.severity && <span>{source.severity}</span>}
        {source.status && <span>{source.status}</span>}
        {source.page && <span>{source.page}</span>}
      </div>
    </div>
  );
}

function Message({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`message-row ${isUser ? "user" : "assistant"}`}>
      <div className={`avatar ${isUser ? "user" : "assistant"}`}>
        {isUser ? "You" : "AI"}
      </div>

      <div className="message-col">
        <div
          className={`bubble ${isUser ? "user" : "assistant"} ${
            message.isError ? "error" : ""
          }`}
        >
          {message.content}
        </div>

        {!isUser && message.sources?.length > 0 && (
          <div className="sources">
            <div className="sources-label">Sources</div>
            {message.sources.map((source) => (
              <SourceCard key={source.issue_id} source={source} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="message-row assistant">
      <div className="avatar assistant">AI</div>
      <div className="message-col">
        <div className="bubble assistant typing-bubble">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
      </div>
    </div>
  );
}

function App() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!message.trim() || loading) {
      return;
    }

    const userMessage = message;

    const updatedMessages = [
      ...messages,
      {
        role: "user",
        content: userMessage,
      },
    ];

    setMessages(updatedMessages);
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          history: messages,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
        },
      ]);
    } catch (error) {
      console.error(error);

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: "Something went wrong while contacting the RAG service.",
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">A11y</div>
        <div className="titles">
          <h1>Accessibility Assistant</h1>
          <p>Ask questions about accessibility issues in your app</p>
        </div>
      </header>

      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 && !loading ? (
          <div className="empty-state">
            <div className="logo">A11y</div>
            <h2>Ask about your accessibility issues</h2>
            <p>
              Try "What high severity issues are open?" or "Tell me about
              PN-1002".
            </p>
          </div>
        ) : (
          messages.map((item, index) => (
            <Message key={index} message={item} />
          ))
        )}

        {loading && <TypingIndicator />}
      </div>

      <div className="composer">
        <div className="composer-box">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask an accessibility question..."
            rows={1}
          />
          <button
            className="send-button"
            onClick={sendMessage}
            disabled={loading || !message.trim()}
            aria-label="Send message"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M14.5 1.5L7.5 8.5M14.5 1.5L10 14.5L7.5 8.5M14.5 1.5L1.5 6L7.5 8.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <div className="composer-hint">Enter to send · Shift+Enter for a new line</div>
      </div>
    </div>
  );
}

export default App;
