import React, { useState } from 'react';
import ConversationList from './ConversationList';
import ConversationView from './ConversationView';

const MessagesPage = () => {
  const [partner, setPartner] = useState(null);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, height: '100%' }}>
      <div style={{ overflowY: 'auto' }}>
        <ConversationList
          onSelect={(p) => setPartner(p)}
          selectedId={partner?.id}
        />
      </div>
      <div>
        <ConversationView
          partner={partner}
          onBack={() => setPartner(null)}
        />
      </div>
    </div>
  );
};

export default MessagesPage;
