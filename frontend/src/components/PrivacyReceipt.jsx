import { CheckCircle2, ClipboardList, RotateCcw, ShieldCheck } from "lucide-react";

export default function PrivacyReceipt({ receipt }) {
  const shared = receipt.shared || [];
  const protectedItemsAll = receipt.protected || [];
  const blocked = receipt.blocked || [];
  const substitutions = receipt.substitutions || [];

  if (receipt.type === "summary" || receipt.compact) {
    const protectedItems = protectedItemsAll.slice(0, 3);

    return (
      <section className="privacy-receipt privacy-summary" aria-label="Privacy summary">
        <div className="card-heading">
          <div className="card-icon success">
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
          <div>
            <h2>Privacy Summary</h2>
            <p>Handled inside PersonaGuard chat</p>
          </div>
        </div>

        <div className="summary-points">
          <span>Nothing sensitive was shared.</span>
          <span>No confirmation needed.</span>
          {protectedItems.length > 0 && (
            <span>Protected: {protectedItems.join(", ")}</span>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="privacy-receipt" aria-label="Privacy receipt">
      <div className="card-heading">
        <div className="card-icon success">
          <CheckCircle2 size={20} aria-hidden="true" />
        </div>
        <div>
          <h2>Privacy Receipt</h2>
          <p>{receipt.completed ? "Task completed with privacy controls" : "Task paused"}</p>
        </div>
      </div>

      <div className="receipt-detail">
        <ClipboardList size={18} aria-hidden="true" />
        <span>{receipt.task}</span>
      </div>

      <div className="receipt-grid">
        <div>
          <h3>Shared</h3>
          {shared.length ? (
            <ul>
              {shared.map((item) => (
                <li key={`${item.data}-${item.party}`}>
                  {item.data} with {item.party}
                </li>
              ))}
            </ul>
          ) : (
            <p>Nothing sensitive was shared.</p>
          )}
        </div>
        <div>
          <h3>Protected</h3>
          {protectedItemsAll.length ? (
            <ul>
              {protectedItemsAll.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>No additional protected data listed.</p>
          )}
        </div>
      </div>

      {(blocked.length > 0 || substitutions.length > 0) && (
        <div className="receipt-grid">
          {substitutions.length > 0 && (
            <div>
              <h3>Substitutions</h3>
              <ul>
                {substitutions.map((item) => (
                  <li key={`${item.original}-${item.substitute}`}>
                    {item.original}: {item.substitute}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {blocked.length > 0 && (
            <div>
              <h3>Blocked</h3>
              <ul>
                {blocked.map((item) => (
                  <li key={`${item.data || item.party}-${item.reason}`}>
                    {item.data ? `${item.data}: ` : `${item.party}: `}
                    {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="receipt-footer">
        <span>
          <ShieldCheck size={16} aria-hidden="true" />
          Protected by PersonaGuard
        </span>
        {receipt.deleted_after_task && (
          <span>
            <RotateCcw size={16} aria-hidden="true" />
            Task data marked for deletion
          </span>
        )}
      </div>
    </section>
  );
}
