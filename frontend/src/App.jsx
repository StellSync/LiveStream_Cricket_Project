import React, { useEffect, useState } from 'react'

const field = (label, value, setValue, placeholder="") => (
  <label style={{display:'block', marginBottom:12}}>
    <div style={{fontSize:14, opacity:.8, marginBottom:4}}>{label}</div>
    <input
      value={value}
      onChange={e => setValue(e.target.value)}
      placeholder={placeholder}
      style={{padding:'10px 12px', width:'100%', borderRadius:8, border:'1px solid #ddd'}}
    />
  </label>
);

export default function App() {
  const [teamA, setTeamA] = useState('Team A');
  const [teamB, setTeamB] = useState('Team B');
  const [runsA, setRunsA] = useState('0');
  const [wicketsA, setWicketsA] = useState('0');
  const [runsB, setRunsB] = useState('0');
  const [wicketsB, setWicketsB] = useState('0');
  const [overs, setOvers] = useState('0.0');
  const [runRate, setRunRate] = useState('0.00');
  const [live, setLive] = useState(null);

  useEffect(() => {
    // SSE from backend on port 5000
    const es = new EventSource('http://localhost:5000/sse');
    es.onmessage = (e) => setLive(JSON.parse(e.data));
    return () => es.close();
  }, []);

  const submit = async () => {
    const payload = {
      teamA,
      teamB,
      runsA: Number(runsA),
      wicketsA: Number(wicketsA),
      runsB: Number(runsB),
      wicketsB: Number(wicketsB),
      overs,
      runRate
    };
    // POST to backend on port 5000
    await fetch('http://localhost:5000/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  };

  return (
    <div style={{fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif', padding:24, maxWidth:720, margin:'0 auto'}}>
      <h2 style={{margin:'6px 0 18px'}}>Scoreboard Admin (Demo)</h2>
      <p style={{marginTop:0, color:'#555'}}>
        Update below. Your OBS overlay at <code>http://localhost:5000/overlay</code> will update instantly.
      </p>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:16}}>
        {field('Team A', teamA, setTeamA)}
        {field('Team B', teamB, setTeamB)}
        {field('Runs A', runsA, setRunsA)}
        {field('Wickets A', wicketsA, setWicketsA)}
        {field('Runs B', runsB, setRunsB)}
        {field('Wickets B', wicketsB, setWicketsB)}
        {field('Overs', overs, setOvers, 'e.g. 12.3')}
        {field('Run Rate', runRate, setRunRate, 'e.g. 7.65')}
      </div>

      <button onClick={submit} style={{marginTop:16, padding:'10px 16px', borderRadius:10, border:'none', background:'#111', color:'#fff'}}>
        Update Score
      </button>

      <div style={{marginTop:24, padding:16, border:'1px dashed #ccc', borderRadius:12}}>
        <div style={{opacity:.7, fontSize:14, marginBottom:8}}>Live Preview (from SSE)</div>
        <div style={{display:'flex', alignItems:'center', gap:16}}>
          <strong>{live?.teamA ?? 'Team A'}</strong>
          <span>{(live?.runsA ?? 0) + '/' + (live?.wicketsA ?? 0)}</span>
          <span>vs</span>
          <strong>{live?.teamB ?? 'Team B'}</strong>
          <span>{(live?.runsB ?? 0) + '/' + (live?.wicketsB ?? 0)}</span>
          <span>Ov: {live?.overs ?? '0.0'}</span>
          <span>RR: {live?.runRate ?? '0.00'}</span>
        </div>
      </div>
    </div>
  );
}
