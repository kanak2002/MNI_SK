import { ShieldCheck } from "lucide-react";

export default function PersonaBadge({ persona }) {
  if (!persona) return null;

  return (
    <div className="persona-badge" aria-label={`Active persona: ${persona.name}`}>
      <ShieldCheck size={16} aria-hidden="true" />
      <span>{persona.name}</span>
      <small>{persona.tone}</small>
    </div>
  );
}
