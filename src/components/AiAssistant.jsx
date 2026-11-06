import React, { useState, useRef, useEffect } from "react";
import { summary } from "../api/client.js";

export default function AiAssistant({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hello ${user.email}, I'm the ORAC-IOS AI Assistant. I can summarize your operational data or explain workflows. How can I help?`
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setLoading(true);

    try {
      // Mocking the AI using our actual data for now until OpenAI is configured
      const data = await summary.get();
      
      let reply = "I'm sorry, I didn't understand that. You can ask me to 'summarize my dashboard', 'explain pending worksheets', or 'check inventory'.";
      const q = userMessage.toLowerCase();

      if (q.includes("summarize") || q.includes("dashboard")) {
        reply = `Here is your current overview: You have ${data.total_quotes} total quotes, ${data.total_worksheets} worksheets, and ${data.total_invoices} invoices logged in the system. There are ${data.pending_dispatch} jobs pending dispatch.`;
      } else if (q.includes("worksheet") || q.includes("pending")) {
        reply = `There are ${data.total_worksheets} total worksheets. If any are pending, they require Supervisor review before moving to Finance.`;
      } else if (q.includes("inventory") || q.includes("stock")) {
        reply = `We are currently tracking ${data.total_inventory_items} items in the inventory. Low stock alerts are enabled for items dropping below their minimum threshold.`;
      } else if (q.includes("help") || q.includes("workflow")) {
        reply = "The standard workflow is: Quote -> Approved Quote -> Purchase Order -> Dispatch -> Field Worksheet -> Supervisor Review -> Invoice.";
      }

      // Simulate network delay for realism
      await new Promise(r => setTimeout(r, 1000));

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error communicating with backend data. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-orac-blue text-white shadow-lg shadow-orac-blue/30 transition-transform hover:scale-105 active:scale-95"
      >
        {isOpen ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[500px] w-96 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center space-x-3 bg-orac-slate px-4 py-3 text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold">ORAC Assistant</h3>
              <p className="text-xs text-white/70">Read-only Operational Helper</p>
            </div>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-orac-blue text-white rounded-br-none"
                      : "bg-white border border-gray-100 text-gray-700 shadow-sm rounded-bl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex space-x-1 rounded-2xl rounded-bl-none bg-white border border-gray-100 px-4 py-3 shadow-sm">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "0ms" }}></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "150ms" }}></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-300" style={{ animationDelay: "300ms" }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="border-t border-gray-100 bg-white p-3">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your dashboard..."
                className="flex-1 rounded-full border border-gray-300 bg-gray-50 px-4 py-2 text-sm focus:border-orac-blue focus:bg-white focus:outline-none focus:ring-1 focus:ring-orac-blue"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-orac-blue text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-orac-text-muted">
              AI can make mistakes. Verify critical data.
            </p>
          </form>
        </div>
      )}
    </>
  );
}
