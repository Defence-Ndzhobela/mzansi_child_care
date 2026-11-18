import React from 'react';
import { Link } from 'react-router-dom';
import { ASSISTANT_LINKS } from '../../config/assistant';

const LINK_PATTERN = /\[([^\]\n]{1,80})\]\((?:(\/[a-z-]*\/?)|(https?:\/\/[^)\s]{1,200}))\)/g;

// Turns the assistant's reply into React nodes. Text is never inserted as HTML, so a reply cannot inject
// markup or scripts. The only links created are [label](/route) to the known public pages of this site.
function renderLine(line: string, onNavigate: () => void, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const text = line.replace(/\*\*(.+?)\*\*/g, '$1');
  LINK_PATTERN.lastIndex = 0;
  while ((match = LINK_PATTERN.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const [, label, rawPath] = match;
    // The model sometimes writes the full address of this site; treat that as the same page.
    let path = rawPath;
    if (path === undefined) {
      try {
        const url = new URL(match[3]);
        path = url.origin === window.location.origin ? url.pathname : '';
      } catch {
        path = '';
      }
    }
    path = path.length > 1 ? path.replace(/\/$/, '') : path;
    parts.push(
      ASSISTANT_LINKS.includes(path) ? (
        <Link
          key={`${keyPrefix}-${match.index}`}
          to={path}
          onClick={onNavigate}
          className="font-semibold text-[#006847] underline underline-offset-2 hover:text-[#005238]"
        >
          {label}
        </Link>
      ) : (
        label
      ),
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function MessageText({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, index) => (
        <p key={index} className={line.trim() ? 'whitespace-pre-wrap break-words' : 'h-2'}>
          {renderLine(line, onNavigate, String(index))}
        </p>
      ))}
    </>
  );
}
