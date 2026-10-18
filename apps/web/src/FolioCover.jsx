// Presentation adapted from CampaignLibrary's original book cover and line art.
export default function FolioCover({ title }) {
  return <div className="campaign-folio-cover">
    <svg className="campaign-folio-art" viewBox="0 0 120 64" fill="none" aria-hidden="true"><path d="M8 52h104M20 45l23-26 17 18 16-29 24 37M43 19l-5 17 11-5M76 8l-6 23 10-6 8 9" /><circle cx="26" cy="14" r="5" /><path d="M60 49v10M55 54h10" /></svg>
    <h3>{title}</h3>
  </div>;
}
