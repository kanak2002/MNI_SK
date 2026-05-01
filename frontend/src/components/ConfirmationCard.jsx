import { Check, Eye, ShieldAlert, X } from "lucide-react";

export default function ConfirmationCard({ confirmation, disabled = false, onChoice }) {
  const dataRequired = confirmation.data_required || [];
  const protectedData = confirmation.protected_data || [];

  return (
    <section className="confirmation-card" aria-label="Privacy confirmation">
      <div className="card-heading">
        <div className="card-icon warning">
          <ShieldAlert size={20} aria-hidden="true" />
        </div>
        <div>
          <h2>{confirmation.title}</h2>
          <p>{confirmation.message}</p>
        </div>
      </div>

      <div className="approval-summary">
        <div>
          <span>Action needing approval</span>
          <strong>{confirmation.action}</strong>
        </div>
        {confirmation.third_party && (
          <div>
            <span>Destination</span>
            <strong>{confirmation.third_party}</strong>
          </div>
        )}
      </div>

      <div className="decision-columns">
        <div>
          <h3>Data to share</h3>
          {dataRequired.length > 0 ? (
            <ul>
              {dataRequired.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>No sensitive data required.</p>
          )}
        </div>
        <div>
          <h3>Stays protected</h3>
          {protectedData.length > 0 ? (
            <ul>
              {protectedData.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>No extra protected fields listed.</p>
          )}
        </div>
      </div>

      <div className="trust-note">
        {confirmation.trusted
          ? "This destination is treated as expected for the task, but approval is still required."
          : "This destination is not marked as trusted, so PersonaGuard will not proceed without approval."}
      </div>

      <div className="confirmation-actions">
        <button
          className="primary-action"
          disabled={disabled}
          onClick={() => onChoice("approve")}
          type="button"
        >
          <Check size={16} aria-hidden="true" />
          Yes, proceed
        </button>
        <button
          className="secondary-action"
          disabled={disabled}
          onClick={() => onChoice("cancel")}
          type="button"
        >
          <X size={16} aria-hidden="true" />
          No, cancel
        </button>
        <button
          className="secondary-action"
          disabled={disabled}
          onClick={() => onChoice("safer")}
          type="button"
        >
          <Eye size={16} aria-hidden="true" />
          See safer alternative
        </button>
      </div>
    </section>
  );
}
