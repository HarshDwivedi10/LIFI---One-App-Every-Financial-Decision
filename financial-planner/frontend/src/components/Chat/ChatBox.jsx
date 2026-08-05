import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { chatApi } from '../../services/api';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

import './ChatBox.css';

export default function ChatBox({ partner, onClose, onNewMessage, onHireClick, isHired }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const stompClientRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Free 10-Minute Trial Timer Logic (600 seconds)
  const isUnlimited = isHired || partner?.hiredByCurrentUser || user?.role === 'ROLE_COACH' || partner?.role === 'ROLE_USER';
  const trialStorageKey = `lifi_chat_trial_${user?.id}_${partner?.id}`;
  
  const [timeLeft, setTimeLeft] = useState(() => {
    if (isUnlimited) return 600;
    const stored = localStorage.getItem(trialStorageKey);
    return stored !== null ? parseInt(stored, 10) : 600;
  });

  useEffect(() => {
    if (isUnlimited) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          localStorage.setItem(trialStorageKey, '0');
          return 0;
        }
        const updated = prev - 1;
        localStorage.setItem(trialStorageKey, updated.toString());
        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isUnlimited, trialStorageKey]);

  useEffect(() => {
    if (!partner || !user) return;

    // Fetch historical messages
    chatApi.getHistory(partner.id)
      .then(res => setMessages(res.data))
      .catch(err => console.error('Failed to load chat history:', err));

    // Mark messages from partner as read
    chatApi.markAsRead(partner.id).catch(console.error);

    // Connect WebSocket
    const token = localStorage.getItem('token');

    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/user/queue/messages`, (msg) => {
          const newMsg = JSON.parse(msg.body);
          const isThisConversation =
            (newMsg.senderId === partner.id && newMsg.receiverId === user.id) ||
            (newMsg.senderId === user.id && newMsg.receiverId === partner.id);

          if (isThisConversation) {
            setMessages(prev => {
              if (prev.find(m => m.id === newMsg.id)) return prev;
              const filtered = prev.filter(m => !(String(m.id).startsWith('temp-') && m.content === newMsg.content && m.senderId === newMsg.senderId));
              return [...filtered, newMsg];
            });
          } else {
            if (onNewMessage) onNewMessage(newMsg);
          }
        });
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame.headers['message']);
        setConnected(false);
      },
      onDisconnect: () => setConnected(false),
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      client.deactivate();
      stompClientRef.current = null;
    };
  }, [partner?.id, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!isUnlimited && timeLeft <= 0) return;

    const client = stompClientRef.current;
    if (!newMessage.trim() || !client || !client.connected) return;

    const content = newMessage.trim();

    const chatMessage = {
      receiverId: partner.id,
      content: content,
    };

    client.publish({
      destination: '/app/chat.send',
      body: JSON.stringify(chatMessage),
    });

    const tempMsg = {
      id: 'temp-' + Date.now(),
      senderId: user.id,
      receiverId: partner.id,
      content: content,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setNewMessage('');
  };

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isTrialExpired = !isUnlimited && timeLeft <= 0;

  if (isMinimized) {
    return (
      <div className="chatbox-minimized-pill" onClick={() => setIsMinimized(false)}>
        <div className="pill-partner-info">
          <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
          <span className="pill-name">💬 Chat: {partner?.name}</span>
          {!isUnlimited && (
            <span className={`pill-timer ${timeLeft < 120 ? 'warning' : ''}`}>
              ⏱️ {formatTimer(timeLeft)}
            </span>
          )}
        </div>
        <button className="pill-expand-btn" title="Expand Chat">▲</button>
        {onClose && (
          <button 
            className="pill-close-btn" 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            title="Close"
          >
            &times;
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="chatbox-container fb-style-overlay">
      {/* Header */}
      <div className="chatbox-header">
        <div className="header-partner">
          <span className={`status-dot ${connected ? 'online' : 'offline'}`} title={connected ? 'Connected' : 'Connecting...'} />
          <div className="partner-details">
            <h3 className="partner-name">{partner?.name}</h3>
            <span className="partner-sub">
              {isUnlimited ? 'Active Member Chat' : (isTrialExpired ? '🔒 Free Trial Expired' : `Free Trial (${formatTimer(timeLeft)})`)}
            </span>
          </div>
        </div>

        <div className="header-controls">
          {!isUnlimited && (
            <div className={`trial-badge ${timeLeft < 120 ? 'urgent' : ''}`}>
              ⏱️ {formatTimer(timeLeft)}
            </div>
          )}
          <button className="chatbox-control-btn" onClick={() => setIsMinimized(true)} title="Minimize">
            _
          </button>
          {onClose && (
            <button className="chatbox-control-btn close" onClick={onClose} title="Close Chat">
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="chatbox-messages">
        {!isUnlimited && (
          <div className="trial-notice-banner">
            🎁 10-Minute Free Trial Chat with Coach {partner?.name}.
          </div>
        )}

        {messages.length === 0 ? (
          <div className="chatbox-empty">No messages yet. Ask any financial question!</div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === user.id;
            return (
              <div key={msg.id || index} className={`chatbox-message ${isMe ? 'message-sent' : 'message-received'}`}>
                <div className="message-content">{msg.content}</div>
                <div className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Expired Trial Lock / Input Area */}
      {isTrialExpired ? (
        <div className="chatbox-expired-lock">
          <div className="lock-msg">
            🔒 <strong>Free 10-minute trial chat ended.</strong>
            <span>Hire Coach {partner?.name} to unlock unlimited personal financial coaching.</span>
          </div>
          {onHireClick && (
            <button className="chat-hire-btn" onClick={onHireClick}>
              💳 Hire Coach & Pay Now
            </button>
          )}
        </div>
      ) : (
        <form className="chatbox-input-area" onSubmit={handleSend}>
          <input
            type="text"
            placeholder={connected ? 'Type a message...' : 'Connecting...'}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={!connected || isTrialExpired}
          />
          <button type="submit" disabled={!newMessage.trim() || !connected || isTrialExpired}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}
