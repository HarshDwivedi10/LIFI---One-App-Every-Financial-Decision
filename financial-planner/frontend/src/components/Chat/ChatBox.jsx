import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { chatApi } from '../../services/api';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

import './ChatBox.css';

export default function ChatBox({ partner, onClose, onNewMessage }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const stompClientRef = useRef(null);
  const messagesEndRef = useRef(null);

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
        // Subscribe to user's private message queue
        client.subscribe(`/user/queue/messages`, (msg) => {
          const newMsg = JSON.parse(msg.body);
          // Only show messages that belong to this conversation
          const isThisConversation =
            (newMsg.senderId === partner.id && newMsg.receiverId === user.id) ||
            (newMsg.senderId === user.id && newMsg.receiverId === partner.id);

          if (isThisConversation) {
            setMessages(prev => {
              if (prev.find(m => m.id === newMsg.id)) return prev;
              // Remove optimistic message if this is the confirmed real message
              const filtered = prev.filter(m => !(String(m.id).startsWith('temp-') && m.content === newMsg.content && m.senderId === newMsg.senderId));
              return [...filtered, newMsg];
            });
          } else {
            // It's from another sender — bubble up for badge notification
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

    // Optimistically update UI so sender instantly sees their message
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

  return (
    <div className="chatbox-container">
      <div className="chatbox-header">
        <h3>Chat with {partner?.name}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: connected ? '#22c55e' : '#f59e0b',
            display: 'inline-block'
          }} title={connected ? 'Connected' : 'Connecting...'} />
          {onClose && (
            <button className="chatbox-close" onClick={onClose} title="Close Chat">
              &times;
            </button>
          )}
        </div>
      </div>

      <div className="chatbox-messages">
        {messages.length === 0 ? (
          <div className="chatbox-empty">No messages yet. Say hi!</div>
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

      <form className="chatbox-input-area" onSubmit={handleSend}>
        <input
          type="text"
          placeholder={connected ? 'Type a message...' : 'Connecting...'}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={!connected}
        />
        <button type="submit" disabled={!newMessage.trim() || !connected}>
          Send
        </button>
      </form>
    </div>
  );
}
