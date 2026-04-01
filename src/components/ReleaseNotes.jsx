import React, { memo, useState } from 'react';

/** Release notes list — reusable */
const ReleaseNotes = memo(function ReleaseNotes({ notes }) {
  const [expanded, setExpanded] = useState(false);
  if (!notes || !notes.length) return null;
  const items = Array.isArray(notes) ? notes : [notes];
  const visible = expanded ? items : items.slice(0, 3);

  return (
    <div className="mb-3 px-0.5">
      <ul className="space-y-1.5">
        {visible.map((note, i) => (
          <li key={i} className="flex items-start gap-2 text-[10px] text-white/50 leading-relaxed">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-flip-500/50 shrink-0" />
            <span>{note}</span>
          </li>
        ))}
      </ul>
      {items.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[9px] text-flip-400/50 hover:text-flip-400 mt-1.5 ml-3 transition-colors"
        >
          {expanded ? 'Show less' : `+${items.length - 3} more`}
        </button>
      )}
    </div>
  );
});

export default ReleaseNotes;
