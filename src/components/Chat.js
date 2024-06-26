import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { AudioRecorder } from 'react-audio-voice-recorder';
import '../App.css';

const socket = io('http://localhost:5000'); // Update with your Flask server URL

const Chat = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [userId, setUserId] = useState('');
  const [audioBlob, setAudioBlob] = useState(null); // Store recorded audio blob
  const [menuOpenId, setMenuOpenId] = useState(null); // Track which menu is open
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [file, setFile] = useState(null); // Store selected file

  useEffect(() => {
    socket.on('connect', () => {
      setUserId(socket.id);
    });

    socket.on('message', (data) => {
      const { message, sender, timestamp } = data;
      if (message && message.trim() !== '') {
        setMessages((prevMessages) => [...prevMessages, { id: Date.now(), text: message, sender, timestamp, type: 'text' }]);
      }
    });

    socket.on('voice_message', (data) => {
      const { voice_data, sender, timestamp } = data;
      setMessages((prevMessages) => [...prevMessages, { id: Date.now(), type: 'voice', voice_data, sender, timestamp }]);
    });

    socket.on('file_message', (data) => {
      const { file_data, file_name, sender, timestamp } = data;
      setMessages((prevMessages) => [...prevMessages, { id: Date.now(), type: 'file', file_data, file_name, sender, timestamp }]);
    });

    return () => {
      socket.off('message');
      socket.off('connect');
      socket.off('voice_message');
      socket.off('file_message');
    };
  }, []);

  const sendMessage = (e) => {
    e.preventDefault();
    const timestamp = new Date().toLocaleTimeString();
    if (message.trim()) {
      if (editingMessageId) {
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === editingMessageId ? { ...msg, text: message, timestamp } : msg
          )
        );
        setEditingMessageId(null);
      } else {
        socket.emit('message', { message: message.trim(), sender: userId, timestamp });
      }
      setMessage(''); // Clear the input field for text message
    }
    if (audioBlob) {
      sendVoiceMessage(audioBlob);
      setAudioBlob(null); // Clear the recorded audio blob after sending
    }
    if (file) {
      sendFileMessage(file);
    }
  };

  const sendVoiceMessage = (voiceData) => {
    const timestamp = new Date().toLocaleTimeString();
    const reader = new FileReader();
    reader.onload = function () {
      const base64data = reader.result.split(',')[1]; // Get base64 encoded audio data
      socket.emit('voice_message', { voice_data: base64data, sender: userId, timestamp }); // Send the base64 encoded audio data
    };
    reader.readAsDataURL(voiceData); // Read the audio data as base64
  };

  const sendFileMessage = (fileData) => {
    const timestamp = new Date().toLocaleTimeString();
    const reader = new FileReader();
    reader.onload = function () {
      const base64data = reader.result.split(',')[1]; // Get base64 encoded file data
      socket.emit('file_message', { file_data: base64data, file_name: fileData.name, sender: userId, timestamp }); // Send the base64 encoded file data
      setFile(null); // Clear the selected file after sending
    };
    reader.readAsDataURL(fileData); // Read the file data as base64
  };

  const addAudioElement = (blob) => {
    setAudioBlob(blob); // Store the recorded audio blob
  };

  const renderVoiceMessage = (voiceData) => {
    try {
      const byteCharacters = atob(voiceData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/wav' });

      const audioUrl = URL.createObjectURL(blob);
      return (
        <audio controls>
          <source src={audioUrl} type="audio/wav" />
          Your browser does not support the audio element.
        </audio>
      );
    } catch (error) {
      console.error('Error decoding voice message:', error);
      return null; // Return null if there's an error decoding the voice message
    }
  };

  const renderFileMessage = (fileData, fileName) => {
    try {
      const byteCharacters = atob(fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray]);
  
      const fileUrl = URL.createObjectURL(blob);
      return (
        <div className="file-message">
          <a href={fileUrl} download={fileName}>
            <div className="file-icon">📄</div>
            <div className="file-name">{fileName}</div>
          </a>
        </div>
      );
    } catch (error) {
      console.error('Error decoding file message:', error);
      return null; // Return null if there's an error decoding the file message
    }
  };
  

  const handleEditMessage = (id, text) => {
    setMessage(text);
    setEditingMessageId(id);
    setMenuOpenId(null); // Close menu after selecting an option
  };

  const handleDeleteMessage = (id) => {
    setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== id));
    setMenuOpenId(null); // Close menu after selecting an option
  };

  const toggleMenu = (id) => {
    setMenuOpenId(menuOpenId === id ? null : id);
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Chat Application</h2>
      </div>
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender === userId ? 'sender' : 'receiver'}`}>
            <div className="message-header">
              <div className="message-sender">{msg.sender}</div>
              {msg.sender === userId && (
                <div className="message-actions">
                  <button onClick={() => toggleMenu(msg.id)}>⋮</button>
                  {menuOpenId === msg.id && (
                    <div className="dropdown-menu">
                      <button onClick={() => handleDeleteMessage(msg.id)}>Delete</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="message-text">
              {msg.type === 'text' ? msg.text : msg.type === 'voice' ? renderVoiceMessage(msg.voice_data) : renderFileMessage(msg.file_data, msg.file_name)}
            </div>
            <div className="message-timestamp">{msg.timestamp}</div>
          </div>
        ))}
      </div>
      <form className="chat-input" onSubmit={sendMessage}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          style={{ display: 'none' }}
          id="fileInput"
        />
        <label htmlFor="fileInput" className="file-input-label">
          📎
        </label>
        <AudioRecorder 
          onRecordingComplete={addAudioElement} 
          showVisualizer={true} 
        />
        <button type="submit">{editingMessageId ? 'Update' : 'Send'}</button>
      </form>
      <div className="voice-message-input">
        {audioBlob && (
          <button className="send-voice-button" onClick={sendMessage}>Send Voice Message</button>
        )}
      </div>
      {file && (
        <div className="file-message-input">
          <button className="send-file-button" onClick={() => sendFileMessage(file)}>Send File</button>
        </div>
      )}
    </div>
  );
};

export default Chat;
