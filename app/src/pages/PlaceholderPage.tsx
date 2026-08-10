interface PlaceholderPageProps {
  section: string;
}

export function PlaceholderPage({ section }: PlaceholderPageProps) {
  return (
    <div className="chq-page">
      <h1>{section}</h1>
      <div className="chq-attention-frame">
        What needs my attention: nothing wired up yet for {section}.
      </div>
    </div>
  );
}
