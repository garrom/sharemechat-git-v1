import React from 'react';

const MessageBubble = ({ me, text, time }) => {
  return (
    <div style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
      <div style={{
        maxWidth: '70%',
        padding: '8px 10px',
        background: me ? '#e9f5ff' : '#f1f3f5',
        border: '1px solid #e5e7eb',
        borderRadius: 10
      }}>
        <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
        {time && <div style={{ fontSize: 11, color: '#6c757d', marginTop: 4 }}>{time}</div>}
      </div>
    </div>
  );
};

export default MessageBubble;
