import React, { useState, useRef, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import type { ChatMessage } from '../types';
import { useDialog } from '../contexts/DialogContext';
import api from '../lib/api';
import ReactMarkdown from 'react-markdown';
import './ChatBubble.css';

export const ChatBubble: React.FC = () => {
  const { showChatBubble } = useSettings();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { confirm, alert } = useDialog();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [resetting, setResetting] = useState(false);

  // Fetch history natively on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get('/chat');
        if (res.data.messages) {
          setMessages(res.data.messages);
        }
      } catch (err) {
        setMessages([{ role: 'assistant', content: 'מערכת הצ\'אט חוותה שגיאה בטעינת ההיסטוריה.' }]);
      }
    };
    if (showChatBubble) {
      fetchHistory();
    }
  }, [showChatBubble]);

  // Hidden state for Modals
  const [isHidden, setIsHidden] = useState(false);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsHidden(document.querySelectorAll('.modal-backdrop').length > 0);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Check initial
    setIsHidden(document.querySelectorAll('.modal-backdrop').length > 0);
    return () => observer.disconnect();
  }, []);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!showChatBubble || isHidden) return null;

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/chat', {
        message: input,
        history: messages.slice(-8),
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'מצטער, אירעה שגיאה. נסה שוב.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    const confirmed = await confirm({
      title: 'איפוס צ\'אט',
      message: 'האם אתה בטוח שברצונך למחוק את היסטוריית הצ\'אט? כל המידע יאבד.',
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
      await alert('שגיאה', 'אירעה שגיאה במחיקת היסטוריית הצ\'אט. נסה שוב מאוחר יותר.');
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

  return (
    <div className="chat-container">
      {open && (
        <div className="chat-window">
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-avatar">🤖</div>
              <div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.9rem' }}>עוזר חכם</div>
                <div style={{ color: 'var(--brand-primary)', fontSize: '0.75rem', fontWeight: 600, opacity: 0.9 }}>מחובר</div>
              </div>
            </div>
            <div className="chat-header-actions" style={{ display: 'flex', gap: '8px' }}>
              <button className="reset-chat-btn" onClick={handleReset} title="נקה התכתבות" disabled={loading}>אפס שיחה</button>
              <button className="icon-btn" onClick={() => setOpen(false)}>✕</button>
            </div>
          </div>

          <div className={`chat-content-wrap ${resetting ? 'grayed-out' : ''}`}>
            <div className="chat-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.role === 'user' ? 'chat-message-user' : 'chat-message-bot'}`}>
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
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-row">
              <button
                className="btn btn-primary btn-sm send-btn"
                onClick={sendMessage}
                disabled={loading || !input.trim() || resetting}
              >
                שלח
              </button>
              <input
                className="form-input chat-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="שאל אותי על החשבונות שלך..."
                disabled={loading || resetting}
              />
            </div>
          </div>

          {resetting && (
            <div className="processing-overlay chat-reset-overlay">
              <div className="processing-content">
                <div className="spinner" style={{ width: '50px', height: '50px', borderWidth: '4px', marginBottom: '1.5rem' }}></div>
                <div className="dynamic-process-button" style={{
                  fontSize: '1.1rem',
                  padding: '12px 24px',
                  minWidth: 'auto',
                  background: 'transparent',
                  border: '2px solid var(--brand-primary)',
                  color: 'var(--brand-primary)',
                  boxShadow: 'none'
                }}>
                  מאפס היסטוריה
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        className={`chat-fab ${open ? 'chat-fab-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="פתח צ'אט"
      >
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
};
