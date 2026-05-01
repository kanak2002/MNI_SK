import { LockKeyhole, Scale, Zap } from "lucide-react";
import { personas } from "../services/api.js";

const icons = {
  conservative: LockKeyhole,
  balanced: Scale,
  convenience: Zap,
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
              <span className="persona-summary">{persona.summary}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
