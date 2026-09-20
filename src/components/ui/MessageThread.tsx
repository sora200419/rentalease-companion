'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  read: boolean;
  sender: {
    id: string;
    name: string;
    role: string;
  };
}

interface Props {
  tenancyId: string;
  currentUserId: string;
  // The other party's name shown in the thread header
  otherPartyName: string;
  contextLabel?: string;
}

export default function MessageThread({
  tenancyId,
  currentUserId,
  otherPartyName,
  contextLabel,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ref to the bottom of the message list — used for auto-scrolling
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetches the latest messages from the API.
  // useCallback memoises this function so we can safely use it in useEffect
  // dependencies without triggering infinite re-renders.
  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/messages?tenancyId=${encodeURIComponent(tenancyId)}`,
      );
      if (!response.ok) return;
      const data = await response.json();
      setMessages(data.messages ?? []);
    } catch {
      // Silently fail on polling errors — don't disrupt the UI
    } finally {
      setIsLoading(false);
    }
  }, [tenancyId]);

  // Initial load + polling setup.
  // The interval fires every 10 seconds to check for new messages.
  // We clear it when the component unmounts to avoid memory leaks.
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10_000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Auto-scroll to bottom whenever messages change —
  // this is the expected behaviour in any chat interface.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenancyId, content }),
      });

      if (!response.ok) {
        const result = await response.json();
        setError(result.error ?? 'Failed to send message');
        return;
      }

      setNewMessage('');
      // Immediately fetch updated messages so the sent message appears
      await fetchMessages();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Allow sending with Enter key (Shift+Enter inserts a newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-MY', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="flex flex-col bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] overflow-hidden h-full min-h-[480px]">
      {/* Thread header */}
      <div className="border-b border-[rgba(196,154,60,0.1)] bg-white/[0.03] px-5 py-4">
        <p className="text-sm font-semibold text-white">{otherPartyName}</p>
        <p className="mt-0.5 truncate text-xs text-white/40">{contextLabel ?? 'Messages are scoped to this tenancy'}</p>
      </div>

      {/* Message list — scrollable middle section */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="text-sm text-white/50">No messages yet</p>
            <p className="text-xs text-white/40 mt-0.5">Start the conversation below</p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.sender.id === currentUserId;

          return (
            <div
              key={msg.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}
              >
                {/* Sender name — shown for received messages */}
                {!isOwn && (
                  <p className="text-xs text-white/40 px-1">
                    {msg.sender.name}
                  </p>
                )}

                {/* Bubble */}
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    isOwn
                      ? 'bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] text-[#1C2740] rounded-br-sm'
                      : 'bg-[#1C2740] border border-[rgba(196,154,60,0.15)] text-white rounded-bl-sm shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>

                {/* Timestamp */}
                <p className="text-xs text-white/40 px-1">
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}

        {/* Invisible div at the bottom — we scroll to this */}
        <div ref={bottomRef} />
      </div>

      {/* Message input area */}
      <div className="border-t border-[rgba(196,154,60,0.1)] bg-[#1C2740] px-4 py-3">
        {error && <p className="mb-2 text-xs text-[#f87171]">{error}</p>}
        <div className="flex items-end gap-2 rounded-xl border border-[rgba(196,154,60,0.15)] bg-white/[0.03] p-2 focus-within:ring-2 focus-within:ring-[rgba(196,154,60,0.5)]">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            disabled={isSending}
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/20"
          />
          <button
            onClick={handleSend}
            disabled={isSending || !newMessage.trim()}
            className="shrink-0 rounded-lg bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] px-4 py-2.5 text-sm font-semibold text-[#1C2740] transition-colors hover:opacity-90 disabled:opacity-40"
          >
            {isSending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
