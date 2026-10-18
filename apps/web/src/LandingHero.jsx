import Button from './Button.jsx';

function AdventureMap() {
  return <svg className="adventure-map" viewBox="0 0 480 480" fill="none" aria-hidden="true">
    <g className="map-contours">
      <path d="M-20 95C65 10 93 102 157 67S273 8 323 53s99-26 180 14M-20 121C58 45 105 136 170 94S269 41 320 82s109-15 183 16M-20 148C57 78 111 164 181 124s90-51 142-9 111-4 180 14" />
      <path d="M-20 351c77-39 92 25 155 17s117-82 181-61 93 58 187 12M-20 378c80-36 99 28 159 14s111-63 175-53 100 58 189 8M-20 405c88-36 102 32 166 11s112-46 170-36 79 57 167 0" />
      <path d="M60 180c-42 31-8 51-28 87s-24 60 3 71M82 191c-38 31-7 45-26 78s-15 40 4 51M406 158c-47 20 9 63-13 87s-33 42-8 69M428 149c-41 17 13 72-14 103s-25 48-3 67" />
    </g>
    <g className="map-landmarks" strokeLinecap="round" strokeLinejoin="round">
      <path d="m91 134 14-25 15 25m-9-10 11-22 20 32M105 109l4 9 5-1m194 249 13-26 18 26m-5-9 13-22 15 31" />
      <path d="M352 130v-25h8v-12h8v12h8v25m-20-12h16m-9 12v-9h7v9M112 344v-16l13-9 14 9v16h-27Zm10 0v-9h7v9" />
      <path d="m59 230 6-15 6 15h-12Zm6 0v7m-1 15 7-18 7 18H64Zm7 0v8m312 78 6-15 6 15h-12Zm6 0v8" />
    </g>
    <path className="map-route" d="M125 327c-37-74 55-37 60-95s110-30 129-64 32-14 49-40" strokeDasharray="4 7" strokeLinecap="round" />
    <g className="map-compass" transform="translate(377 380)"><circle r="30" /><circle r="24" strokeDasharray="1 5" /><path d="m0-39 7 32 32 7-32 7-7 32-7-32-32-7 32-7Z" /><path d="M0-24v48m-24-24h48" /><text y="-46" textAnchor="middle">N</text></g>
    <g className="map-seal">
      <circle cx="240" cy="234" r="110" /><circle cx="240" cy="234" r="98" strokeDasharray="2 8" />
      <path className="seal-face" d="m240 151 72 41v83l-72 41-72-41v-83Z" />
      <path d="m240 151 39 107h-78l39-107Zm-72 41 33 66-33 17m144-83-33 66 33 17m-111-17 39 58 39-58m-111-66 72 25 72-25" />
      <text x="240" y="248" textAnchor="middle">20</text>
    </g>
    <g className="map-stars"><path d="m165 87 3 8 8 3-8 3-3 8-3-8-8-3 8-3Zm159 211 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" /></g>
  </svg>;
}

export default function LandingHero({ onHost }) {
  return <><section className="landing-hero" aria-labelledby="home-title">
    <div className="hero-map-panel"><AdventureMap /><p className="map-caption"><span aria-hidden="true">✧</span> One table. Endless stories.</p></div>
    <div className="hero-copy">
      <p className="eyebrow">Gather your party</p>
      <h1 id="home-title">Every adventure<br />starts <em>at the table.</em></h1>
      <p className="hero-promise">Host a table or join your friends.</p>
      <p className="hero-description">Bring everyone together for a local Dungeons &amp; Dragons session.</p>
      <div className="hero-session-actions"><Button id="home-host-session" onClick={onHost}>Host a session <span aria-hidden="true">✦</span></Button></div>
    </div>
  </section><div className="landing-divider" aria-hidden="true"><span />✧<span /></div></>;
}
