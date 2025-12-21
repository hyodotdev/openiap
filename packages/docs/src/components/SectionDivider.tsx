interface SectionDividerProps {
  title?: string;
}

function SectionDivider({ title }: SectionDividerProps) {
  if (!title) {
    return <hr className="section-divider" />;
  }

  return (
    <div className="section-divider">
      <span className="section-divider-title">{title}</span>
    </div>
  );
}

export default SectionDivider;
