import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import type { ChatMessage } from '../types';
import { useDialog } from '../contexts/DialogContext';
import api from '../lib/api';
import ReactMarkdown from 'react-markdown';
import './ChatBubble.css';

const NEAR_BOTTOM_THRESHOLD = 80; // px from bottom before we consider "at bottom"

export const ChatBubble: React.FC = () => {
  const { showChatBubble } = useSettings();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isFilesExpanded, setIsFilesExpanded] = useState(false);
  const { confirm, alert } = useDialog();

  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedScrollY = useRef(0);

  // ── Fetch chat history on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!showChatBubble) return;
    api.get('/chat')
      .then(res => { if (res.data.messages) setMessages(res.data.messages); })
      .catch(() => setMessages([{ role: 'assistant', content: "מערכת הצ'אט חוותה שגיאה בטעינת ההיסטוריה." }]));
  }, [showChatBubble]);

  // ── Hide when modals are open ────────────────────────────────────────────
  const [isHidden, setIsHidden] = useState(false);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsHidden(document.querySelectorAll('.modal-backdrop').length > 0);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setIsHidden(document.querySelectorAll('.modal-backdrop').length > 0);
    return () => observer.disconnect();
  }, []);

  // ── Body scroll lock (prevents page scrolling behind the chat on mobile) ──
  useEffect(() => {
    if (open) {
      // Save position before locking so we can restore it on close
      savedScrollY.current = window.scrollY;
      document.body.style.overflow = 'hidden';
      // iOS-specific: position:fixed prevents overscroll bounce from leaking
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY.current}px`;
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, savedScrollY.current);
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [open]);

  // ── Scroll position tracking ──────────────────────────────────────────────
  const handleMessagesScroll = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distFromBottom < NEAR_BOTTOM_THRESHOLD;
    setIsAtBottom(atBottom);
    setShowScrollBtn(!atBottom && el.scrollHeight > el.clientHeight);
  }, []);

  // ── Smart auto-scroll: only move to bottom if user IS near bottom 
  //    (or just sent a message themselves) ───────────────────────────────────
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const lastMsg = messages[messages.length - 1];
    const shouldScroll = isAtBottom || lastMsg?.role === 'user';
    if (shouldScroll) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // ── Instant scroll to bottom when chat first opens ───────────────────────
  useEffect(() => {
    if (open) {
      // Use requestAnimationFrame so the DOM has rendered
      requestAnimationFrame(() => {
        if (messagesRef.current) {
          messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
          setIsAtBottom(true);
          setShowScrollBtn(false);
        }
      });
    }
  }, [open]);

  const scrollToBottom = () => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
    setIsAtBottom(true);
    setShowScrollBtn(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newArray = Array.from(e.target.files);
    
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'text/plain', 'text/csv'];
    const invalidFiles = newArray.filter(f => !allowedTypes.includes(f.type) && !f.name.endsWith('.csv') && !f.name.endsWith('.txt'));
    
    if (invalidFiles.length > 0) {
      alert('שגיאה', 'סוג הקובץ אינו נתמך (Word/Excel וכו\'). אנא העלה רק PDF, תמונות או טקסט.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFiles(prev => {
      const combined = [...prev, ...newArray];
      if (combined.length > 3) {
        alert('שגיאה', 'ניתן להעלות עד 3 קבצים בכל פעם.');
        return combined.slice(0, 3);
      }
      return combined;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const randomWaitMessages = [
    "אני מעלה את הקבצים שלך, רגע קט...",
    "בסדר גמור, מעבד את המסמכים, שנייה...",
    "רק רגע, קורא את הנתונים...",
    "מסדר את המידע מהקבצים, כמה שניות..."
  ];

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (input.trim().length < 3 || loading) return;
    
    if (selectedFiles.length > 0) {
      const invalidSize = selectedFiles.some(f => f.size > 5 * 1024 * 1024);
      if (invalidSize) {
        await alert('שגיאה', 'גודל קובץ מקסימלי הוא 5MB.');
        return;
      }
    }

    const currentInput = input;
    const currentFiles = [...selectedFiles];
    
    setInput('');
    setSelectedFiles([]);
    setLoading(true);
    setIsAtBottom(true);
    
    let chatHistory = [...messages];

    // Immediate UI Update! Show User's input directly without waiting for anything
    if (currentInput.trim()) {
       chatHistory.push({ role: 'user', content: currentInput });
    } else if (currentFiles.length > 0) {
       chatHistory.push({ role: 'user', content: `[הועלו ${currentFiles.length} קבצים]` });
    }
    setMessages([...chatHistory]);

    try {
      if (currentFiles.length > 0) {
        let uploadMsg = randomWaitMessages[Math.floor(Math.random() * randomWaitMessages.length)];
        
        try {
          // Now fetch the dynamic processing message while the user sees their own message
          const waitRes = await api.get('/chat/wait-message');
          if (waitRes.data && waitRes.data.reply) {
            uploadMsg = waitRes.data.reply;
          }
        } catch (err) {
          // fallback to static array if API fails
        }
        
        // Insert the dynamic wait message bubble
        chatHistory.push({ role: 'assistant', content: uploadMsg });
        setMessages([...chatHistory]);

        const formData = new FormData();
        currentFiles.forEach(file => formData.append('files', file));
        
        const uploadRes = await api.post('/chat/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        chatHistory.pop(); // Remove wait msg
        
        if (!currentInput.trim()) {
          chatHistory.push({ role: 'assistant', content: `העליתי ${uploadRes.data.processed?.length || currentFiles.length} קבצים בהצלחה. איך אוכל לעזור לך איתם?` });
          setMessages([...chatHistory]);
          setLoading(false);
          return;
        }
      }

      const res = await api.post('/chat', { message: currentInput, history: chatHistory.slice(-8) });
      setMessages([...chatHistory, { role: 'assistant', content: res.data.reply }]);
    } catch {
      if (currentFiles.length > 0) chatHistory.pop();
      setMessages([...chatHistory, { role: 'assistant', content: 'מצטער, אירעה שגיאה בבקשה או בהעלאה. נסה שוב.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    const confirmed = await confirm({
      title: "איפוס צ'אט",
      message: "האם אתה בטוח שברצונך למחוק את היסטוריית הצ'אט? כל המידע יאבד.",
      icon: '🗑️',
      actions: [
        { label: 'מחק היסטוריה', type: 'danger' },
        { label: 'ביטול', type: 'ghost' }
      ]
    });
    if (confirmed !== 0) return;
    setResetting(true);
    try {
      const res = await api.delete('/chat');
      setMessages([{ role: 'assistant', content: res.data.reply }]);
    } catch {
      await alert('שגיאה', "אירעה שגיאה במחיקת היסטוריית הצ'אט. נסה שוב מאוחר יותר.");
    } finally {
      setResetting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!showChatBubble || isHidden) return null;

  return (
    <div className="chat-container">
      {open && (
        <div className="chat-window" role="dialog" aria-label="עוזר חכם">
          {/* ── Header ────────────────────────────────────── */}
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-avatar">🤖</div>
              <div>
                <div className="chat-title">עוזר חכם</div>
                <div className="chat-status">מחובר</div>
              </div>
            </div>
            <div className="chat-header-actions">
              <button
                className="reset-chat-btn"
                onClick={handleReset}
                title="נקה התכתבות"
                disabled={loading || resetting}
              >
                אפס שיחה
              </button>
              <button
                className="chat-close-btn"
                onClick={() => setOpen(false)}
                aria-label="סגור צ'אט"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── Messages ──────────────────────────────────── */}
          <div className={`chat-content-wrap ${resetting ? 'grayed-out' : ''}`}>
            <div
              className="chat-messages"
              ref={messagesRef}
              onScroll={handleMessagesScroll}
            >
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`chat-message ${msg.role === 'user' ? 'chat-message-user' : 'chat-message-bot'}`}
                >
                  <div className="chat-bubble-msg">
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown>
                        {msg.content.replace(/(?<!\n)(\d+\.\s)/g, '\n$1')}
                      </ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {loading && !resetting && (
                <div className="chat-message chat-message-bot">
                  <div className="chat-bubble-msg chat-typing">
                    <span /><span /><span />
                  </div>
                </div>
              )}
              {/* Sentinel for scroll target */}
              <div style={{ height: 1, flexShrink: 0 }} />
            </div>

            {/* ── Scroll-to-bottom button ────────────────── */}
            {showScrollBtn && (
              <button
                className="scroll-to-bottom-btn"
                onClick={scrollToBottom}
                aria-label="גלול לתחתית"
              >
                ↓
              </button>
            )}

            {/* ── File Pills ──────────────────────────────── */}
            {selectedFiles.length > 0 && (
              <div className="chat-file-pills">
                <div 
                  className="chat-file-pills-header" 
                  onClick={() => setIsFilesExpanded(!isFilesExpanded)}
                  title="לחץ להצגה/הסתרה"
                >
                  <span style={{ fontSize: '0.8rem', transition: 'transform 0.2s', transform: isFilesExpanded ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
                  {selectedFiles.length === 1 ? '1 קובץ מצורף' : `${selectedFiles.length} קבצים מצורפים`}
                </div>
                {isFilesExpanded && (
                  <div className="chat-file-pills-list">
                    {selectedFiles.map((file, i) => (
                      <div key={i} className="chat-file-pill">
                        <span title={file.name}>{file.name}</span>
                        <button className="chat-file-remove" onClick={(e) => { e.stopPropagation(); removeFile(i); }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Input row ──────────────────────────────── */}
            <div className="chat-input-row">
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.csv,.txt"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <button 
                className="attach-btn" 
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || resetting}
                title="צרף מסמך (עד 3)"
              >
                +
              </button>
              <input
                ref={inputRef}
                className="chat-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="שאל אותי על החשבונות שלך..."
                disabled={loading || resetting}
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="send"
              />
              <button
                className="btn btn-primary send-btn"
                onClick={sendMessage}
                disabled={loading || resetting || input.trim().length < 3}
                aria-label="שלח"
              >
                שלח
              </button>
            </div>
          </div>

          {/* ── Reset overlay ──────────────────────────── */}
          {resetting && (
            <div className="processing-overlay chat-reset-overlay">
              <div className="processing-content">
                <div className="spinner" style={{ width: '50px', height: '50px', borderWidth: '4px', marginBottom: '1.5rem' }} />
                <div className="dynamic-process-button" style={{
                  fontSize: '1.1rem', padding: '12px 24px', minWidth: 'auto',
                  background: 'transparent', border: '2px solid var(--brand-primary)',
                  color: 'var(--brand-primary)', boxShadow: 'none'
                }}>
                  מאפס היסטוריה
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FAB ────────────────────────────────────────── */}
      <button
        className={`chat-fab ${open ? 'chat-fab-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? "סגור צ'אט" : "פתח צ'אט"}
      >
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
};
