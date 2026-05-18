import React, { useEffect, useRef } from 'react';

export default function HeroAnimation() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const lines = [
      { text: 'const share = async (code: string) => {', color: '#e8e8f0', indent: 0 },
      { text: '  const id = await createProject(code);', color: '#9090b0', indent: 0 },
      { text: '  const url = `https://pairdevo.com/${id}`;', color: '#00f5ff', indent: 0 },
      { text: '  return url;', color: '#00ff88', indent: 0 },
      { text: '};', color: '#e8e8f0', indent: 0 },
      { text: '', color: '', indent: 0 },
      { text: '// Share with the world ✦', color: '#5a5a7a', indent: 0 },
      { text: 'share(myCode).then(console.log);', color: '#bf00ff', indent: 0 },
    ];

    let lineIdx = 0;
    let charIdx = 0;
    let displayedLines: string[] = [];
    let cursor = true;

    const cursorInterval = setInterval(() => {
      cursor = !cursor;
      render();
    }, 530);

    function render() {
      const html = [...displayedLines, lines[lineIdx]?.text.slice(0, charIdx) ?? '']
        .map((line, i) => {
          const lineData = lines[i];
          if (!lineData) return '';
          return `<div class="font-mono text-sm leading-6" style="color:${lineData.color || '#5a5a7a'}">${escapeHtml(line)}${i === displayedLines.length ? `<span style="opacity:${cursor ? 1 : 0};color:#00f5ff">█</span>` : ''}</div>`;
        })
        .join('');
      el.innerHTML = html;
    }

    function escapeHtml(s: string) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const typeInterval = setInterval(() => {
      if (lineIdx >= lines.length) {
        clearInterval(typeInterval);
        return;
      }
      const line = lines[lineIdx];
      if (charIdx < line.text.length) {
        charIdx++;
        render();
      } else {
        displayedLines.push(line.text);
        lineIdx++;
        charIdx = 0;
        render();
      }
    }, 35);

    return () => {
      clearInterval(typeInterval);
      clearInterval(cursorInterval);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="p-6 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] font-mono text-sm leading-6 min-h-[200px]"
    />
  );
}
