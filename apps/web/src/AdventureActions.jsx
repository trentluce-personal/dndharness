import Button from './Button.jsx';

export default function AdventureActions({ onCharacter, onJoin, onCampaign, onDice }) {
  return <section className="adventure-actions" aria-labelledby="adventure-actions-title">
    <div className="section-heading"><div><p className="eyebrow">Your next adventure</p><h2 id="adventure-actions-title">What would you like to do?</h2></div></div>
    <div className="start-paths">
      <article><span className="path-symbol" aria-hidden="true">♧</span><h3>Join friends</h3><p>Bring your character to a shared adventure.</p><div className="heading-actions"><Button onClick={onJoin}>Join with an invite code</Button><Button className="secondary" onClick={onCharacter}>Import character sheet</Button></div></article>
      <article><span className="path-symbol" aria-hidden="true">✧</span><h3>Run a game</h3><p>Your adventure, your notes, your group.</p><Button className="secondary" onClick={onCampaign}>Create a campaign</Button></article>
    </div>
    <div className="guide-footer"><p>Need a quick roll?</p><Button className="text-button" onClick={onDice}>Roll dice →</Button></div>
  </section>;
}
