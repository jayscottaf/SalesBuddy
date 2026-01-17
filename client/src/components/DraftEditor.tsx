import { useState, useRef, useCallback } from 'react';
import './DraftEditor.css';

interface DraftEditorProps {
  title: string;
  icon: 'email' | 'phone';
  initialContent: string;
  recipientLabel?: string;
  recipientValue?: string;
  subjectLine?: string;
  onAiImprove?: (content: string) => Promise<string>;
}

export default function DraftEditor({
  title,
  icon,
  initialContent,
  recipientLabel = 'To',
  recipientValue = '',
  subjectLine,
  onAiImprove,
}: DraftEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [copied, setCopied] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const formatText = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }, []);

  const handleCopy = async () => {
    const text = editorRef.current?.innerText || content;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAiImprove = async () => {
    if (!onAiImprove) return;
    setIsImproving(true);
    try {
      const currentContent = editorRef.current?.innerText || content;
      const improved = await onAiImprove(currentContent);
      setContent(improved);
      if (editorRef.current) {
        editorRef.current.innerText = improved;
      }
    } catch (err) {
      console.error('AI improve failed:', err);
    } finally {
      setIsImproving(false);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
    }
  };

  const formatInitialContent = (text: string) => {
    return text
      .split('\n')
      .map(line => {
        // Check for numbered items like "1)" or "1."
        if (/^\d+[\)\.]\s/.test(line)) {
          return `<div class="draft-list-item">${line}</div>`;
        }
        // Check for bullet points
        if (/^[-•]\s/.test(line)) {
          return `<div class="draft-list-item">${line}</div>`;
        }
        // Subject line
        if (line.toLowerCase().startsWith('subject:')) {
          return `<div class="draft-subject-line">${line}</div>`;
        }
        // Greeting
        if (/^(hi|hello|dear|hey)\s/i.test(line)) {
          return `<div class="draft-greeting">${line}</div>`;
        }
        // Signature
        if (/^(best|regards|thanks|sincerely|cheers)/i.test(line)) {
          return `<div class="draft-signature">${line}</div>`;
        }
        return `<div>${line || '<br>'}</div>`;
      })
      .join('');
  };

  return (
    <div className={`draft-editor ${isEditing ? 'is-editing' : ''}`}>
      <div className="draft-header">
        <div className="draft-header-left">
          <span className={`draft-icon draft-icon--${icon}`}>
            {icon === 'email' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            )}
          </span>
          <span className="draft-title">{title}</span>
        </div>
        <div className="draft-header-actions">
          <button
            type="button"
            className="draft-action-btn"
            onClick={() => setIsEditing(!isEditing)}
            title={isEditing ? 'View mode' : 'Edit mode'}
          >
            {isEditing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            )}
          </button>
          <button
            type="button"
            className="draft-action-btn"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {(recipientValue || subjectLine) && (
        <div className="draft-meta">
          {recipientValue && (
            <div className="draft-meta-row">
              <span className="draft-meta-label">{recipientLabel}</span>
              <span className="draft-meta-value">{recipientValue}</span>
            </div>
          )}
          {subjectLine && (
            <div className="draft-meta-row">
              <span className="draft-meta-label">Subject</span>
              <span className="draft-meta-value draft-meta-subject">{subjectLine}</span>
            </div>
          )}
        </div>
      )}

      {isEditing && (
        <div className="draft-toolbar">
          <div className="draft-toolbar-group">
            <button
              type="button"
              className="draft-toolbar-btn"
              onClick={() => formatText('bold')}
              title="Bold (Ctrl+B)"
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              className="draft-toolbar-btn"
              onClick={() => formatText('italic')}
              title="Italic (Ctrl+I)"
            >
              <em>I</em>
            </button>
            <button
              type="button"
              className="draft-toolbar-btn"
              onClick={() => formatText('underline')}
              title="Underline (Ctrl+U)"
            >
              <u>U</u>
            </button>
          </div>
          <div className="draft-toolbar-divider" />
          <div className="draft-toolbar-group">
            <button
              type="button"
              className="draft-toolbar-btn"
              onClick={() => formatText('insertUnorderedList')}
              title="Bullet list"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <circle cx="3" cy="6" r="1" fill="currentColor"/>
                <circle cx="3" cy="12" r="1" fill="currentColor"/>
                <circle cx="3" cy="18" r="1" fill="currentColor"/>
              </svg>
            </button>
            <button
              type="button"
              className="draft-toolbar-btn"
              onClick={() => formatText('insertOrderedList')}
              title="Numbered list"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="10" y1="6" x2="21" y2="6"/>
                <line x1="10" y1="12" x2="21" y2="12"/>
                <line x1="10" y1="18" x2="21" y2="18"/>
                <text x="2" y="8" fontSize="8" fill="currentColor">1</text>
                <text x="2" y="14" fontSize="8" fill="currentColor">2</text>
                <text x="2" y="20" fontSize="8" fill="currentColor">3</text>
              </svg>
            </button>
          </div>
          <div className="draft-toolbar-divider" />
          <div className="draft-toolbar-group">
            <button
              type="button"
              className="draft-toolbar-btn draft-toolbar-btn--ai"
              onClick={handleAiImprove}
              disabled={isImproving || !onAiImprove}
              title="AI Improve"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              <span>{isImproving ? 'Improving...' : 'AI Improve'}</span>
            </button>
          </div>
          <div className="draft-toolbar-spacer" />
          <div className="draft-toolbar-group">
            <span className="draft-spellcheck-indicator">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Spell check on
            </span>
          </div>
        </div>
      )}

      <div
        ref={editorRef}
        className="draft-content"
        contentEditable={isEditing}
        suppressContentEditableWarning
        spellCheck={true}
        onInput={handleInput}
        dangerouslySetInnerHTML={{ __html: formatInitialContent(initialContent) }}
      />

      {isEditing && (
        <div className="draft-footer">
          <button type="button" className="draft-send-btn">
            {icon === 'email' ? 'Open in Gmail' : 'Copy Script'}
          </button>
          <span className="draft-hint">Press Ctrl+B for bold, Ctrl+I for italic</span>
        </div>
      )}
    </div>
  );
}
