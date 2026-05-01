import { LockKeyhole, Scale, Zap } from "lucide-react";
import { personas } from "../services/api.js";

const icons = {
  conservative: LockKeyhole,
  balanced: Scale,
  convenience: Zap,
};

const descriptions = {
  conservative: "Ask before sensitive sharing. Block risky third parties.",
  balanced: "Minimize exposed data while keeping tasks practical.",
  convenience: "Move quickly, but still flag high-risk actions.",
};

export default function PersonaCards({ disabled = false, selectedId, onSelect }) {
  return (
    <div className="persona-grid" role="list" aria-label="Privacy comfort levels">
      {personas.map((persona) => {
        const Icon = icons[persona.id];
        const isSelected = selectedId === persona.id;

        return (
          <button
            className={`persona-card ${isSelected ? "selected" : ""}`}
            disabled={disabled}
            key={persona.id}
            onClick={() => onSelect(persona)}
            type="button"
            aria-pressed={isSelected}
          >
            <span className="persona-icon">
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="persona-copy">
              <span className="persona-title-row">
                <span className="persona-name">{persona.name}</span>
                <span className="persona-tone">{persona.tone}</span>
              </span>
              <span className="persona-summary">
                {descriptions[persona.id] || persona.summary}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
