'use client';
import { useEffect, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { localAnswer } from './data';

const prompts = ['What did you research at NYU?', 'Tell me about LLM optimization', 'What are your publications?', 'How do I get in touch?'];
const signal = (state, seconds) => window.dispatchEvent(new CustomEvent('phoenix', { detail: { state, seconds } }));

export default function Twin() {
  const [messages, setMessages] = useState([]), [input, setInput] = useState(''), [state, setState] = useState('idle'), [shown, setShown] = useState(0);
  const log = useRef(null), timer = useRef(null), alive = useRef(true);
  const busy = state !== 'idle';

  useEffect(() => { alive.current = true; return () => { alive.current = false; clearInterval(timer.current); }; }, []);
  useEffect(() => { const n = log.current; if (n) n.scrollTop = n.scrollHeight; }, [messages, shown, state]);

  function speak(text) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now(), cps = 75;
    setMessages((m) => [...m, { role: 'assistant', text }]);
    setState('speaking'); setShown(reduced ? text.length : 0); signal('speaking', text.length / cps);
    const done = () => { clearInterval(timer.current); setShown(text.length); setState('idle'); signal('idle'); };
    if (reduced) return done();
    timer.current = setInterval(() => { const n = Math.floor((performance.now() - start) / 1000 * cps); if (n >= text.length) done(); else setShown(n); }, 33);
  }

  async function ask(q) {
    q = q.trim(); if (!q || busy) return;
    setInput(''); setState('thinking'); signal('thinking');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    let text = localAnswer(q);
    const pause = new Promise((r) => setTimeout(r, 900));
    try {
      const res = await fetch('/api/twin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }) });
      if (res.ok) { const data = await res.json(); if (data.answer) text = data.answer; }
    } catch {}
    await pause;
    if (alive.current) speak(text);
  }

  return (
    <div className={`oracle ${state}`}>
      <div className="messages" ref={log} tabIndex={0} aria-label="Conversation with the phoenix">
        <p className="said">Ask, and I will answer in fire. I know Rivujit’s research, work and publications.</p>
        {messages.map((m, i) => {
          if (m.role === 'user') return <p key={i} className="asked">{m.text}</p>;
          const n = i === messages.length - 1 ? shown : m.text.length;
          return <p key={i} className="said" aria-hidden={n < m.text.length || undefined}>{m.text.slice(0, n)}{n < m.text.length && <span className="hotedge">{m.text.slice(n, n + 3)}</span>}</p>;
        })}
        {state === 'thinking' && <p className="kindling"><i /><i /><i /><span className="sr">The phoenix is thinking</span></p>}
      </div>
      <div className="sr" aria-live="polite">{state === 'idle' && messages.length > 0 ? messages[messages.length - 1].text : ''}</div>
      <div className="prompts">{prompts.map((q) => <button type="button" disabled={busy} key={q} onClick={() => ask(q)}>{q}</button>)}</div>
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <input aria-label="Your question" placeholder="Ask the phoenix" value={input} maxLength={1000} onChange={(e) => setInput(e.target.value)} />
        <button disabled={busy || !input.trim()}><Flame size={18} /> Ask</button>
      </form>
    </div>
  );
}
