import React from 'react';
import { PlaceholderWrap } from '../../../styles/AdminShellStyles';

const AdminPlaceholderPanel = ({ title, body, note }) => (
  <PlaceholderWrap>
    <div className="title">{title}</div>
    <div className="body">{body}</div>
    {note ? <div className="note">{note}</div> : null}
  </PlaceholderWrap>
);

export default AdminPlaceholderPanel;
