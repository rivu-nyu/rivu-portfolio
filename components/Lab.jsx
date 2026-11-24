'use client';
import { useState } from 'react';

const words = ['The', 'robot', 'moves', 'toward', 'the', 'object'];

export default function Lab() {
  const [params, setParams] = useState(7), [bits, setBits] = useState(4), [token, setToken] = useState(2);
  return (
    <div className="labgrid">
      <article className="panel">
        <h3>Less memory, more possibility</h3>
        <p>Explore theoretical weight memory at different numerical precisions.</p>
        <label htmlFor="modelsize">Model size <strong>{params}B parameters</strong></label>
        <input id="modelsize" type="range" min="1" max="70" value={params} onChange={(e) => setParams(+e.target.value)} />
        <div className="choices">{[16, 8, 4].map((b) => <button key={b} aria-pressed={bits === b} onClick={() => setBits(b)}>{b === 16 ? 'FP16' : 'INT' + b}</button>)}</div>
        <div className="metric">{(params * bits / 8).toFixed(2)} <small>GB</small></div>
        <div className="bar"><i style={{ width: bits / 16 * 100 + '%' }} /></div>
        <p className="muted">{Math.round((1 - bits / 16) * 100)}% less weight memory vs FP16. Excludes runtime overhead and quantization metadata.</p>
      </article>
      <article className="panel">
        <h3>How tokens connect</h3>
        <p>Select a query token to explore an illustrative attention distribution.</p>
        <div className="choices">{words.map((w, i) => <button key={i} aria-pressed={token === i} onClick={() => setToken(i)}>{w}</button>)}</div>
        <div className="heatmap" role="img" aria-label="Illustrative attention heatmap">
          {words.map((w, i) => <div className="heatrow" key={i}><span>{w}</span>{words.map((_, j) => <i key={j} style={{ background: `rgba(255,141,69,${(i === token ? 0.95 : 0.35) * Math.exp(-Math.abs(j - i) * 0.48) + 0.05})` }} />)}</div>)}
        </div>
        <p className="muted">Synthetic visualization for education, not measured model attention.</p>
      </article>
    </div>
  );
}
